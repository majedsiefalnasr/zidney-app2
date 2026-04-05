# Secrets Scanner Hook - Quick Reference

## 📋 What This Hook Does

Scans modified files for leaked secrets (API keys, passwords, tokens) at session end before committing.

## 🚀 Getting Started (30 seconds)

```bash
./.github/hooks/secrets-scanner/setup.sh
git add .github/hooks/secrets-scanner/ .gitignore
git commit -m "feat: Secrets Scanner safety hook"
# Start coding in VS Code
```

## 🎛️ Configuration

| Variable | Effect | Example |
|----------|--------|---------|
| `SCAN_MODE=warn` | Log only (default) | Audit mode |
| `SCAN_MODE=block` | Block commits with secrets | Production mode |
| `SCAN_SCOPE=diff` | Check uncommitted changes | Default |
| `SCAN_SCOPE=staged` | Check only staged files | Strict mode |
| `SKIP_SECRETS_SCAN=true` | Disable entirely | Emergency bypass |

## 📊 Detected Secret Types

- AWS access keys, GCP service accounts, Azure secrets
- GitHub PATs, npm tokens, Slack tokens, Stripe keys
- Private keys (RSA, EC, OpenSSH, PGP, DSA)
- Database connection strings (PostgreSQL, MongoDB, MySQL, Redis)
- API keys, passwords, bearer tokens, JWTs
- Internal IP addresses with ports

## 📁 File Structure

```
.github/hooks/secrets-scanner/
├── hooks.json                 # Hook configuration
├── scan-secrets.sh            # Main scanner script
├── setup.sh                   # Initialization script
├── README.md                  # Feature overview
└── QUICK_REFERENCE.md         # This file

.copilot/logs/secrets/
└── scan.log                   # Scanner events (auto-created)
```

## 🔍 Example Finding

```
🔍 Scanning 3 modified file(s) for secrets...

⚠️  Found 1 potential secret(s):

  FILE                      LINE   PATTERN              SEVERITY
  ----                      ----   -------              --------
  src/config.ts             12     GITHUB_PAT           critical

🚫 Session blocked (SCAN_MODE=block).
```

## ✅ Privacy Impact

- No external network calls
- Logs stored locally only
- Full prompts never logged
- Secrets truncated in logs (never full exposure)
- Add to `.gitignore` to prevent committing logs

## 🔧 Common Tasks

| Task | Command |
|------|---------|
| Initialize | `./.github/hooks/secrets-scanner/setup.sh` |
| Check mode | `echo $SCAN_MODE` |
| Skip pattern | `SECRETS_ALLOWLIST="test_key" bash script.sh` |
| Disable | `export SKIP_SECRETS_SCAN=true` |
| View logs | `tail -f .copilot/logs/secrets/scan.log` |

## 📚 Related Files

- **Feature Overview**: See [README.md](./README.md)
- **Configuration**: See [hooks.json](./hooks.json)

## ⚡ Performance

- **Timeout**: 30 seconds (non-blocking)
- **CPU**: <2% impact
- **Dependencies**: None (standard Unix tools)

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Hook not triggering | Run `setup.sh`, verify `SCAN_MODE` env var |
| False positives | Add pattern to `SECRETS_ALLOWLIST` |
| Permission denied | `chmod +x .github/hooks/secrets-scanner/*.sh` |
