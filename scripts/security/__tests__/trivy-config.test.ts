import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ensureReportReadable,
  hasBlockingFindings,
  normalizeSeverity,
  sanitizeTrivyReport,
  visibleFindings,
} from '../trivy-config'

describe('normalizeSeverity', () => {
  it('normalizes known severities', () => {
    expect(normalizeSeverity('high')).toBe('HIGH')
    expect(normalizeSeverity('CRITICAL')).toBe('CRITICAL')
  })

  it('falls back to UNKNOWN', () => {
    expect(normalizeSeverity('weird')).toBe('UNKNOWN')
    expect(normalizeSeverity(undefined)).toBe('UNKNOWN')
  })
})

describe('sanitizeTrivyReport', () => {
  const report = sanitizeTrivyReport({
    Results: [
      {
        Target: 'package.json',
        Vulnerabilities: [
          {
            VulnerabilityID: 'CVE-1',
            PkgName: 'left-pad',
            Title: 'Bad package',
            Severity: 'HIGH',
          },
        ],
        Misconfigurations: [
          {
            AVDID: 'AVD-AWS-1',
            Title: 'Open security group',
            Severity: 'CRITICAL',
          },
        ],
        Secrets: [
          {
            RuleID: 'github-pat',
            Title: 'GitHub token',
            Severity: 'CRITICAL',
            StartLine: 12,
          },
        ],
      },
    ],
  })

  it('collects sanitized findings', () => {
    expect(report.findings).toHaveLength(3)
    expect(report.counts.HIGH).toBe(1)
    expect(report.counts.CRITICAL).toBe(2)
  })

  it('removes secret values from retained findings', () => {
    const secret = report.findings.find((finding) => finding.kind === 'secret')
    expect(secret).toBeTruthy()
    expect(secret).not.toHaveProperty('match')
    expect(secret?.identifier).toBe('github-pat')
    expect(secret?.line).toBe(12)
  })
})

describe('hasBlockingFindings', () => {
  const report = sanitizeTrivyReport({
    Results: [
      {
        Target: 'repo',
        Vulnerabilities: [
          { VulnerabilityID: 'CVE-LOW', PkgName: 'foo', Severity: 'LOW' },
          { VulnerabilityID: 'CVE-MED', PkgName: 'bar', Severity: 'MEDIUM' },
          { VulnerabilityID: 'CVE-HIGH', PkgName: 'baz', Severity: 'HIGH' },
        ],
        Misconfigurations: [
          { AVDID: 'AVD-MED', Severity: 'MEDIUM', Title: 'Medium misconfig' },
          { AVDID: 'AVD-CRIT', Severity: 'CRITICAL', Title: 'Critical misconfig' },
        ],
        Secrets: [{ RuleID: 'secret-rule', Severity: 'CRITICAL', Title: 'Secret' }],
      },
    ],
  })

  it('blocks deps on high vulnerabilities only', () => {
    expect(hasBlockingFindings(report, 'deps')).toBe(true)
  })

  it('blocks ci on high vulnerabilities, misconfigs, or secrets', () => {
    expect(hasBlockingFindings(report, 'ci')).toBe(true)
  })

  it('blocks orchestrator only on critical vulnerability or misconfig or secrets', () => {
    expect(hasBlockingFindings(report, 'orchestrator')).toBe(true)
  })

  it('does not block orchestrator on high-only dependency or misconfiguration findings', () => {
    const highOnlyReport = sanitizeTrivyReport({
      Results: [
        {
          Target: 'repo',
          Vulnerabilities: [{ VulnerabilityID: 'CVE-HIGH', PkgName: 'baz', Severity: 'HIGH' }],
          Misconfigurations: [{ AVDID: 'AVD-HIGH', Severity: 'HIGH', Title: 'High misconfig' }],
        },
      ],
    })

    expect(hasBlockingFindings(highOnlyReport, 'orchestrator')).toBe(false)
    expect(hasBlockingFindings(highOnlyReport, 'ci')).toBe(true)
  })
})

describe('visibleFindings', () => {
  it('suppresses low severities in formatted output data', () => {
    const report = sanitizeTrivyReport({
      Results: [
        {
          Target: 'repo',
          Vulnerabilities: [
            { VulnerabilityID: 'CVE-LOW', PkgName: 'foo', Severity: 'LOW' },
            { VulnerabilityID: 'CVE-MED', PkgName: 'bar', Severity: 'MEDIUM' },
          ],
        },
      ],
    })

    expect(visibleFindings(report)).toHaveLength(1)
    expect(visibleFindings(report)[0]?.severity).toBe('MEDIUM')
  })

  it('returns no findings for a clean report', () => {
    const report = sanitizeTrivyReport({ Results: [] })

    expect(report.findings).toHaveLength(0)
    expect(visibleFindings(report)).toHaveLength(0)
    expect(hasBlockingFindings(report, 'ci')).toBe(false)
  })
})

describe('ensureReportReadable', () => {
  it('fails closed on unreadable json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trivy-report-test-'))
    const filePath = join(dir, 'report.json')
    writeFileSync(filePath, '{not-json')

    expect(() => ensureReportReadable(filePath)).toThrow(/Unreadable report JSON/)
  })

  it('fails closed on malformed json that omits required fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'trivy-report-test-'))
    const filePath = join(dir, 'report.json')
    writeFileSync(filePath, JSON.stringify({ version: 1, generatedAt: '2026-03-24T00:00:00Z' }))

    expect(() => ensureReportReadable(filePath)).toThrow(/Malformed report JSON/)
  })
})
