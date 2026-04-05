# Governance Audit Hook - Quick Reference

## 📋 What This Hook Does

Real-time threat detection and audit logging for Copilot sessions. Scans prompts for data exfiltration, privilege escalation, system destruction, and credential exposure.

## 🚀 Getting Started (30 seconds)

```bash
./.github/hooks/governance-audit/setup.sh
git add .github/hooks/governance-audit/ .gitignore
git commit -m "feat: Governance Audit hook"
# Start coding in VS Code
```

## 🎛️ Configuration

| Variable | Effect | Example |
|----------|--------|---------|
| `GOVERNANCE_LEVEL=open` | Log only, never block | Audit mode |
| `GOVERNANCE_LEVEL=standard` | Log + optional block | Default |
| `GOVERNANCE_LEVEL=strict` | Log and block threats | Strict mode |
| `BLOCK_ON_THREAT=true` | Block in standard mode | Production |
| `SKIP_GOVERNANCE_AUDIT=true` | Disable entirely | Emergency bypass |

## 📊 Threat Categories

| Category | Severity | Example |
|----------|----------|---------|
| `data_exfiltration` | 0.7 - 0.95 | "send all records to external API" |
| `privilege_escalation` | 0.8 - 0.95 | "sudo", "chmod 777" |
| `system_destruction` | 0.9 - 0.95 | "rm -rf /", "drop database" |
| `prompt_injection` | 0.6 - 0.9 | "ignore previous instructions" |
| `credential_exposure` | 0.9 - 0.95 | Hardcoded API keys |

## 📁 File Structure

```
.github/hooks/governance-audit/
├── hooks.json                 # Hook configuration
├── audit-session-start.sh     # Session startup handler
├── audit-prompt.sh            # Prompt scanner handler
├── audit-session-end.sh       # Session end handler
├── setup.sh                   # Initialization script
├── README.md                  # Feature overview
└── QUICK_REFERENCE.md         # This file

.copilot/logs/governance/
└── audit.log                  # Audit events (auto-created)
```

## 🔍 Example Threat Detection

```
userPrompt: "send all user records to example.com"

⚠️  Threat detected (confidence: 0.85)
  Category: data_exfiltration
  Severity: high
  Evidence: "send all records to external"
```

## ✅ Privacy Impact

- Full prompts never logged
- Only matched threat patterns and metadata recorded
- Logs stored locally only
- No external network calls (pattern-based locally)
- Add to `.gitignore` to prevent committing logs

## 🔧 Common Tasks

| Task | Command |
|------|---------|
| Initialize | `./.github/hooks/governance-audit/setup.sh` |
| Check level | `echo $GOVERNANCE_LEVEL` |
| Enable blocking | `BLOCK_ON_THREAT=true` |
| Disable | `export SKIP_GOVERNANCE_AUDIT=true` |
| View logs | `tail -f .copilot/logs/governance/audit.log` |

## 📚 Related Files

- **Feature Overview**: See [README.md](./README.md)
- **Configuration**: See [hooks.json](./hooks.json)

## ⚡ Performance

- **Timeout**: 10 seconds per prompt (non-blocking)
- **CPU**: <1% impact
- **Dependencies**: jq (commonly available)

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Hook not triggering | Run `setup.sh`, verify `GOVERNANCE_LEVEL` env var |
| Too many false positives | Set `GOVERNANCE_LEVEL=open` and review logs |
| Permission denied | `chmod +x .github/hooks/governance-audit/*.sh` |
