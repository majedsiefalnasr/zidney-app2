# Session Logger Hook - Quick Reference

## 📋 What This Hook Does

Logs all GitHub Copilot coding agent activity (sessions, prompts) to local JSON files for audit and analytics.

## 🚀 Getting Started (30 seconds)

```bash
./.github/hooks/session-logger/setup.sh
git add .github/hooks/session-logger/ .gitignore
git commit -m "feat: Session Logger hook"
# Start coding in VS Code
```

## 📊 View Logs

```bash
# Real-time monitoring
tail -f .copilot/logs/session.log

# Get session stats
./.github/hooks/session-logger/analyze-logs.sh all

# View specific metrics
./.github/hooks/session-logger/analyze-logs.sh sessions
./.github/hooks/session-logger/analyze-logs.sh prompts
./.github/hooks/session-logger/analyze-logs.sh branches
```

## 🎛️ Configuration

| Variable | Effect | Example |
|----------|--------|---------|
| `SKIP_LOGGING=true` | Disable all logging | Privacy mode |
| `LOG_LEVEL=DEBUG` | Verbose logging | Detailed analysis |
| `CAPTURE_PROMPT_TEXT=true` | Include prompt content | Risky for privacy |

## 📁 File Structure

```
.github/hooks/session-logger/
├── hooks.json                 # Hook configuration
├── log-session-start.sh       # Session start handler  
├── log-session-end.sh         # Session end handler
├── log-prompt.sh              # Prompt logging handler
├── setup.sh                   # Initialization script
├── analyze-logs.sh            # Log analysis utility
├── README.md                  # Feature overview
├── INTEGRATION.md             # Detailed guide
└── QUICK_REFERENCE.md         # This file

.copilot/logs/
├── session.log                # Session events (auto-created)
└── prompts.log                # Prompt events (auto-created)
```

## 🔍 Log Format Examples

### Session Start
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "sessionStart",
  "cwd": "/workspace/project",
  "git": {
    "branch": "main",
    "commit": "a1b2c3d"
  },
  "level": "INFO"
}
```

### Prompt Submission
```json
{
  "timestamp": "2024-01-15T10:32:00Z",
  "event": "userPromptSubmit",
  "level": "INFO"
}
```

### Session End
```json
{
  "timestamp": "2024-01-15T10:35:45Z",
  "event": "sessionStop",
  "level": "INFO"
}
```

## ✅ Privacy by Default

- ✓ No prompt content logged
- ✓ No sensitive data captured
- ✓ Logs never leave your machine
- ✓ Easily disable with `SKIP_LOGGING=true`

## 🔧 Common Tasks

| Task | Command |
|------|---------|
| Initialize | `./.github/hooks/session-logger/setup.sh` |
| View logs | `tail -f .copilot/logs/session.log` |
| Analyze | `./.github/hooks/session-logger/analyze-logs.sh all` |
| Disable | `export SKIP_LOGGING=true` |
| Archive | `tar -czf logs.tar.gz .copilot/logs/` |
| Count sessions | `grep sessionStart .copilot/logs/session.log \| wc -l` |

## 📚 Related Files

- **Setup Guide**: See [INTEGRATION.md](./INTEGRATION.md)
- **Feature Overview**: See [README.md](./README.md)
- **Hook Config**: See [hooks.json](./hooks.json)

## ⚡ Performance Impact

- **Minimal**: Scripts timeout at 5 seconds (non-blocking)
- **Disk**: ~1KB per session + 0.1KB per prompt
- **CPU**: <1% impact

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Logs not appearing | Run `setup.sh` and verify scripts are executable |
| Permission denied | `chmod +x .github/hooks/session-logger/*.sh` |
| No .copilot/logs | Run `setup.sh` or `mkdir -p .copilot/logs` |

## 📞 Need Help?

1. Run diagnosis: `./.github/hooks/session-logger/analyze-logs.sh all`
2. Check config: `cat .github/hooks/session-logger/hooks.json`
3. View guide: See [INTEGRATION.md](./INTEGRATION.md)
4. Check permissions: `ls -l .github/hooks/session-logger/`
