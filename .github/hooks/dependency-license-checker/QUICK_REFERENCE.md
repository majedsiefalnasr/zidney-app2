# Dependency License Checker Hook - Quick Reference

## 📋 What This Hook Does

Scans newly added dependencies for license compliance (GPL, AGPL, SSPL) at session end before committing.

## 🚀 Getting Started (30 seconds)

```bash
./.github/hooks/dependency-license-checker/setup.sh
git add .github/hooks/dependency-license-checker/ .gitignore
git commit -m "feat: License Checker compliance hook"
# Start coding in VS Code
```

## 🎛️ Configuration

| Variable | Effect | Example |
|----------|--------|---------|
| `LICENSE_MODE=warn` | Log only (default) | Audit mode |
| `LICENSE_MODE=block` | Block commits with violations | Production mode |
| `SKIP_LICENSE_CHECK=true` | Disable entirely | Emergency bypass |
| `BLOCKED_LICENSES` | Custom SPDX list | `GPL-3.0,AGPL-3.0` |
| `LICENSE_ALLOWLIST` | Skip packages | `readline-sync,glibc` |

## 📊 Default Blocked Licenses

- **GPL**: GPL-2.0, GPL-3.0 (all variants)
- **AGPL**: AGPL-1.0, AGPL-3.0 (all variants)
- **LGPL**: LGPL-2.0, LGPL-2.1, LGPL-3.0 (all variants)
- **Other**: SSPL-1.0, EUPL-1.1/1.2, OSL-3.0, CPAL-1.0
- **Creative Commons**: CC-BY-SA-4.0, CC-BY-NC-*, CC-BY-NC-SA-*

## 📁 File Structure

```
.github/hooks/dependency-license-checker/
├── hooks.json                 # Hook configuration
├── check-licenses.sh          # Main checker script
├── setup.sh                   # Initialization script
├── README.md                  # Feature overview
└── QUICK_REFERENCE.md         # This file

.copilot/logs/license-checker/
└── check.log                  # Check events (auto-created)
```

## 🔍 Example Finding

```
🔍 Checking licenses for 2 new dependency(ies)...

  PACKAGE          ECOSYSTEM   LICENSE          STATUS
  -------          ---------   -------          ------
  react            npm         MIT              OK
  readline-sync    npm         GPL-3.0          BLOCKED

⚠️  Found 1 license violation(s)
  - readline-sync (npm): GPL-3.0

🚫 Session blocked (LICENSE_MODE=block).
```

## ✅ Privacy Impact

- No external network calls (CLI lookups may happen)
- Logs stored locally only
- No sensitive data captured
- Add to `.gitignore` to prevent committing logs

## 🔧 Common Tasks

| Task | Command |
|------|---------|
| Initialize | `./.github/hooks/dependency-license-checker/setup.sh` |
| Check mode | `echo $LICENSE_MODE` |
| Allow package | `LICENSE_ALLOWLIST="readline-sync" bash script.sh` |
| Custom blocked | `BLOCKED_LICENSES="GPL-3.0,MIT" bash script.sh` |
| Disable | `export SKIP_LICENSE_CHECK=true` |
| View logs | `tail -f .copilot/logs/license-checker/check.log` |

## 📚 Related Files

- **Feature Overview**: See [README.md](./README.md)
- **Configuration**: See [hooks.json](./hooks.json)

## 🌍 Supported Ecosystems

| Ecosystem | Manifest | Detection |
|-----------|----------|-----------|
| npm/yarn/pnpm | package.json | ✅ Excellent |
| pip | requirements.txt, pyproject.toml | ✅ Good |
| Go | go.mod | ⚠️ Basic |
| Ruby | Gemfile | ⚠️ Basic |
| Rust | Cargo.toml | ✅ Good |

## ⚡ Performance

- **Timeout**: 60 seconds (non-blocking)
- **CPU**: <2% impact
- **Dependencies**: None mandatory (jq optional)

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Hook not triggering | Run `setup.sh`, verify `LICENSE_MODE` env var |
| False positives | Add package to `LICENSE_ALLOWLIST` |
| Ecosystem not detected | Check manifest file format |
| Permission denied | `chmod +x .github/hooks/dependency-license-checker/*.sh` |
