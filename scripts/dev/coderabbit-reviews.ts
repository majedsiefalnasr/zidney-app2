#!/usr/bin/env bun

/**
 * @script dev:pr:coderabbit
 * @domain dev
 * @category dev
 * @description Fetch CodeRabbit AI review threads from a GitHub PR via the GitHub GraphQL API.
 *   Outputs matching threads as Markdown or JSON. Optionally marks threads as resolved and/or
 *   saves output to a file. Requires `gh` CLI to be authenticated.
 * @usage bun run dev:pr:coderabbit <PR_NUMBER> [--resolved|--unresolved] [--json|--md] [--save <dir>] [--include-files] [--max-lines <n>] [--mark-resolved] [--mark-thread <id|id1,id2>] [--cleanup]
 * @flag --resolved boolean Show resolved threads instead of unresolved ones.
 * @flag --unresolved boolean Show unresolved threads (default).
 * @flag --json boolean Output matching threads as raw JSON.
 * @flag --md boolean Output matching threads as Markdown (default).
 * @flag --save string Save output to the specified directory instead of printing to stdout.
 * @flag --include-files boolean Append full file content for each file referenced in a thread.
 * @flag --max-lines number Maximum lines per file block before content is omitted. | bun run dev:pr:coderabbit 42 --max-lines 300
 * @flag --mark-resolved boolean Mark all matching CodeRabbit threads as resolved after fetching.
 * @flag --mark-thread string Mark specific thread(s) as resolved (comma-separated IDs or single ID). | bun run dev:pr:coderabbit 92 --mark-thread threadId1 or bun run dev:pr:coderabbit 92 --mark-thread id1,id2,id3
 * @flag --cleanup boolean Delete the saved output file after marking threads resolved.
 * @flag --ai boolean Emit machine-readable JSON summary to stdout instead of human output.
 * @flag --ci boolean Enable CI non-interactive mode. Disables spinners.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'

const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('dev:pr:coderabbit')
logger.setContext({ ci: isCi })
log.setScript('dev:pr:coderabbit')

interface Args {
  pr: number
  repo: string
  owner: string
  status: 'RESOLVED' | 'UNRESOLVED'
  format: 'json' | 'md'
  saveDir?: string
  markResolved: boolean
  markThreadIds: string[] // Specific thread IDs to mark as resolved
  cleanup: boolean
  includeFiles: boolean
  maxLines: number
}

const SYSTEM_INSTRUCTIONS = `# 🤖 AI AGENT INSTRUCTIONS
You are reviewing CodeRabbit AI feedback for this Pull Request.
1. **Analyze** the "Suggestion" and "Diff Context" provided below.
2. **Apply** the requested changes directly to the codebase if they improve the code.
3. **Ignore** suggestions that are hallucinations or contradict project requirements.
4. **Full File Content** is provided at the bottom for files under the line limit.
5. **Report** back once you have completed the refactoring.
---
`

function parseArgs(): Args {
  const config: Args = {
    pr: 0,
    repo: 'zidney-app2',
    owner: 'majedsiefalnasr',
    status: 'UNRESOLVED',
    format: 'md',
    markResolved: false,
    markThreadIds: [],
    cleanup: false,
    includeFiles: false,
    maxLines: 500,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--resolved') config.status = 'RESOLVED'
    else if (arg === '--unresolved') config.status = 'UNRESOLVED'
    else if (arg === '--json') config.format = 'json'
    else if (arg === '--md') config.format = 'md'
    else if (arg === '--save') config.saveDir = args[++i]
    else if (arg === '--mark-resolved') config.markResolved = true
    else if (arg === '--mark-thread') {
      const threadArg = args[++i] ?? ''
      if (!threadArg || threadArg.startsWith('-')) {
        log.error('Missing value for --mark-thread. Provide a comma-separated list of thread IDs.')
        exit(1)
      }
      config.markThreadIds = threadArg
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    } else if (arg === '--cleanup') config.cleanup = true
    else if (arg === '--include-files') config.includeFiles = true
    else if (arg === '--max-lines') config.maxLines = Number(args[++i])
    else if (!Number.isNaN(Number(arg)) && !arg.startsWith('-')) config.pr = Number(arg)
  }

  if (!config.pr) {
    log.error(
      'Missing PR number. Usage: bun run dev:pr:coderabbit <PR_NUMBER> [--resolved|--unresolved] [--json|--md] [--save <dir>] [--include-files] [--max-lines <n>] [--mark-resolved] [--mark-thread <id|id1,id2>] [--cleanup]'
    )
    exit(1)
  }
  return config
}

function runGql(query: string, variables: Record<string, string | number>): unknown | null {
  const cmdArgs = ['api', 'graphql']
  for (const [key, val] of Object.entries(variables)) {
    cmdArgs.push('-F', `${key}=${String(val)}`)
  }
  cmdArgs.push('-f', `query=${query}`)

  const result = Bun.spawnSync(['gh', ...cmdArgs], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  if (result.exitCode !== 0) {
    const stderr = result.stderr?.toString() ?? ''
    logger.error('gh API call failed', { exitCode: result.exitCode, stderr: stderr.slice(0, 500) })
    return null
  }

  try {
    return JSON.parse(result.stdout.toString())
  } catch {
    logger.error('Failed to parse gh API response as JSON', {})
    return null
  }
}

interface ReviewThread {
  id: string
  isResolved: boolean
  comments: {
    nodes: Array<{
      author: { login: string }
      body: string
      path: string
      line: number
      diffHunk: string
    }>
  }
}

function fetchThreads(config: Args): ReviewThread[] {
  const query = `
    query($owner: String!, $repo: String!, $pr: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $pr) {
          reviewThreads(first: 100) {
            nodes {
              id
              isResolved
              comments(first: 20) {
                nodes {
                  author { login }
                  body
                  path
                  line
                  diffHunk
                }
              }
            }
          }
        }
      }
    }
  `

  const result = runGql(query, {
    owner: config.owner,
    repo: config.repo,
    pr: config.pr,
  }) as {
    data?: { repository?: { pullRequest?: { reviewThreads?: { nodes: ReviewThread[] } } } }
  } | null

  if (!result?.data?.repository?.pullRequest) {
    logger.error('Unexpected response shape from GitHub API', {})
    return []
  }

  const nodes: ReviewThread[] = result.data.repository.pullRequest.reviewThreads?.nodes ?? []
  const targetStatus = config.status === 'RESOLVED'
  return nodes.filter((t) => t.isResolved === targetStatus)
}

function formatMarkdown(threads: ReviewThread[], config: Args): string {
  const coderabbitThreads = threads.filter((t) =>
    t.comments.nodes.some((c) => c.author.login.includes('coderabbit'))
  )
  if (coderabbitThreads.length === 0) return '# No matching CodeRabbit comments found.\n'

  let md = SYSTEM_INSTRUCTIONS
  const processedFiles = new Set<string>()

  for (const t of coderabbitThreads) {
    for (const c of t.comments.nodes.filter((c) => c.author.login.includes('coderabbit'))) {
      md += `\n## 📄 File: ${c.path} (Line: ${c.line})\n### 💡 Suggestion\n${c.body}\n### 🔍 Context\n\`\`\`diff\n${c.diffHunk}\n\`\`\`\n---\n`
      processedFiles.add(c.path)
    }
  }

  if (config.includeFiles) {
    md += `\n# 📂 FULL FILE CONTENT FOR CONTEXT\n`
    for (const filePath of processedFiles) {
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf8')
        const lineCount = content.split('\n').length
        if (lineCount <= config.maxLines) {
          md += `\n## File: ${filePath}\n\`\`\`${filePath.split('.').pop()}\n${content}\n\`\`\`\n`
        } else {
          md += `\n## File: ${filePath}\n> ⚠️ *Content omitted: ${lineCount} lines exceeds limit (${config.maxLines}).*\n`
        }
      }
    }
  }
  return md
}

function main(): void {
  const config = parseArgs()
  log.header(
    'CodeRabbit Reviews',
    `Fetching ${config.status.toLowerCase()} threads for PR #${config.pr}`
  )
  logger.info('Fetching review threads', {
    pr: config.pr,
    repo: `${config.owner}/${config.repo}`,
    status: config.status,
    format: config.format,
  })

  const threads = fetchThreads(config)
  const coderabbitThreads = threads.filter((t) =>
    t.comments.nodes.some((c) => c.author.login.includes('coderabbit'))
  )

  log.step(`Found ${coderabbitThreads.length} CodeRabbit thread(s) in ${threads.length} total`)

  const output =
    config.format === 'json'
      ? JSON.stringify(coderabbitThreads, null, 2)
      : formatMarkdown(threads, config)

  let savedPath = ''
  if (config.saveDir) {
    if (!existsSync(config.saveDir)) mkdirSync(config.saveDir, { recursive: true })
    savedPath = join(config.saveDir, `pr-${config.pr}-reviews.${config.format}`)
    writeFileSync(savedPath, output, 'utf8')
    log.success(`Saved to ${savedPath}`)
    logger.info('Output saved', { path: savedPath })
  } else {
    process.stdout.write(`${output}\n`)
  }

  if ((config.markResolved && coderabbitThreads.length > 0) || config.markThreadIds.length > 0) {
    const mutation = `
      mutation($id: ID!) {
        resolveReviewThread(input: { threadId: $id }) {
          thread { isResolved }
        }
      }
    `

    let threadsToMark: ReviewThread[] = []
    if (config.markThreadIds.length > 0) {
      // Mark only specific thread IDs
      threadsToMark = coderabbitThreads.filter((t) => config.markThreadIds.includes(t.id))
      if (threadsToMark.length === 0) {
        logger.warn('No matching threads found for specified IDs', {
          requestedIds: config.markThreadIds,
          availableIds: coderabbitThreads.map((t) => t.id),
        })
        log.warn(
          `⚠️  No matching threads found for IDs: ${config.markThreadIds.join(', ')}\n   Available IDs: ${coderabbitThreads.map((t) => t.id).join(', ')}`
        )
      }
    } else if (config.markResolved) {
      // Mark all fetched threads
      threadsToMark = coderabbitThreads
    }

    if (threadsToMark.length > 0) {
      log.step(`Marking ${threadsToMark.length} thread(s) as resolved…`)
      for (const t of threadsToMark) {
        runGql(mutation, { id: t.id })
        log.success(`Resolved thread: ${t.id}`)
        logger.info('Thread resolved', { threadId: t.id })
      }
    }
  }

  if (config.cleanup && savedPath && existsSync(savedPath)) {
    log.step(`Cleaning up ${savedPath}`)
    unlinkSync(savedPath)
    logger.info('Cleanup complete', { path: savedPath })
  }

  log.result({
    total: threads.length,
    passed: coderabbitThreads.length,
    failed: 0,
    message: `Found ${coderabbitThreads.length} CodeRabbit thread(s) in ${threads.length} total.`,
  })
}

main()
