# Tool Guardian Hook - Quick Reference

## 📋 What This Hook Does

Blocks dangerous tool operations (rm -rf, git force push, DROP TABLE, chmod 777) before the Copilot agent executes them.

## 🚀 Getting Started (30 seconds)

```bash
./.github/hooks/tool-guardian/setup.sh
git add .github/hooks/tool-guardian/ .gitignore
git commit -m "feat: Tool Guardian safety hook"
# Start coding in VS Code
```

## 🎛️ Configuration

| Variable | Effect | Example |
|----------|--------|---------|
| `GUARD_MODE=block` | Block dangerous commands (default) | Production mode |
| `GUARD_MODE=warn` | Log only, don't block | Audit mode |
| `SKIP_TOOL_GUARD=true` | Disable entirely | Emergency bypass |

## 📊 Protected Patterns

- **Destructive file ops**: `rm -rf /`, `rm .env`, `rm .git`
- **Destructive git ops**: `git push --force` to main/master, `git reset --hard`
- **Database ops**: `DROP TABLE`, `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` without WHERE
- **Permission abuse**: `chmod 777`, `chmod -R 777`
- **Network exfil**: `curl | bash`, `wget | sh`, `curl --data @file`
- **System danger**: `sudo`, `npm publish`

## 📁 File Structure

```
.github/hooks/tool-guardian/
├── hooks.json                 # Hook configuration
├── guard-tool.sh              # Main guardian script
├── setup.sh                   # Initialization script
├── README.md                  # Feature overview
└── QUICK_REFERENCE.md         # This file

.copilot/logs/tool-guardian/
└── guard.log                  # Guardian events (auto-created)
```

## 🔍 Example Blocked Command

```bash
User: git push --force origin main
```

```
🛡️  Tool Guardian: 1 threat(s) detected

  CATEGORY                 SEVERITY   MATCH
  --------                 --------   -----
  destructive_git_ops      critical   git push --force origin main

🚫 Operation blocked. Use 'git push --force-with-lease' instead.
```

## ✅ Privacy Impact

- No external network calls
- Logs stored locally only
- Pattern-based detection (no code analysis)
- Add to `.gitignore` to prevent committing logs

## 🔧 Common Tasks

| Task | Command |
|------|---------|
| Initialize | `./.github/hooks/tool-guardian/setup.sh` |
| Check mode | `echo $GUARD_MODE` |
| Allow pattern | `TOOL_GUARD_ALLOWLIST="pattern" bash script.sh` |
| Disable | `export SKIP_TOOL_GUARD=true` |
| View logs | `tail -f .copilot/logs/tool-guardian/guard.log` |

## 📚 Related Files

- **Feature Overview**: See [README.md](./README.md)
- **Configuration**: See [hooks.json](./hooks.json)

## ⚡ Performance

- **Timeout**: 10 seconds (non-blocking)
- **CPU**: <1% impact
- **Dependencies**: None (standard Unix tools)

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Hook not triggering | Run `setup.sh`, verify `GUARD_MODE` env var |
| Permission denied | `chmod +x .github/hooks/tool-guardian/*.sh` |
| False positive | Add pattern to `TOOL_GUARD_ALLOWLIST` |
