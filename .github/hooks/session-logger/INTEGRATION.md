# Session Logger Hook - Integration & Deployment Guide

## Quick Start

### 1. Initialize the Hook

```bash
# Run the setup script
./.github/hooks/session-logger/setup.sh
```

This will:
- Make all scripts executable
- Create the `.copilot/logs/` directory
- Add `.copilot/logs/` to `.gitignore`
- Verify the hook configuration

### 2. Commit the Configuration

```bash
git add .github/hooks/session-logger/ .gitignore
git commit -m "feat: add Session Logger hook for Copilot audit trail"
```

### 3. Start Your Session

Open VS Code with the Copilot editor and start coding. Logs will be created automatically.

### 4. View the Logs

```bash
# View session activity
tail -f .copilot/logs/session.log

# Analyze all activity
./.github/hooks/session-logger/analyze-logs.sh all

# Follow specific branches used
./.github/hooks/session-logger/analyze-logs.sh branches
```

## Hook Architecture

### Event-to-Handler Mapping

| Copilot Event | Handler Script | Output File | Captures |
|---------------|----------------|-------------|----------|
| `SessionStart` | `log-session-start.sh` | `session.log` | Timestamp, CWD, Git branch, Git commit |
| `Stop` | `log-session-end.sh` | `session.log` | Timestamp, event marker |
| `UserPromptSubmit` | `log-prompt.sh` | `prompts.log` | Timestamp, log level, optional prompt content |

### Configuration File

**Location**: `.github/hooks/session-logger/hooks.json`

Uses standard VS Code hook format:
- Event names follow Copilot's hook naming (SessionStart, Stop, UserPromptSubmit)
- Scripts are shell commands with timeout enforcement
- Environment variables control logging behavior

## Configuration Options

### Environment Variables

Set these in your shell profile, `.env`, or at runtime:

```bash
# Disable all logging
export SKIP_LOGGING=true

# Control logging verbosity (INFO is default)
export LOG_LEVEL=DEBUG
export LOG_LEVEL=ERROR

# Enable prompt content logging (privacy sensitive!)
export CAPTURE_PROMPT_TEXT=true
```

### Conditional Logging

The hooks respect `SKIP_LOGGING` globally. Use this for:
- Privacy-sensitive development
- Testing environments
- Reducing disk usage

## Log Analysis

### Built-in Analysis Tool

```bash
# Show all statistics
./.github/hooks/session-logger/analyze-logs.sh all

# Show specific information
./.github/hooks/session-logger/analyze-logs.sh sessions
./.github/hooks/session-logger/analyze-logs.sh prompts
./.github/hooks/session-logger/analyze-logs.sh branches
./.github/hooks/session-logger/analyze-logs.sh stats

# Follow logs in real-time
./.github/hooks/session-logger/analyze-logs.sh tail
```

### Manual Analysis with jq

```bash
# Count total sessions
jq 'select(.event == "sessionStart")' .copilot/logs/session.log | wc -l

# Get average prompts per session
jq '.timestamp[0:10]' .copilot/logs/prompts.log | uniq | wc -l

# Extract branch names used
jq '.git.branch' .copilot/logs/session.log | sort | uniq

# Find session duration by matching start/stop pairs
jq -s 'group_by(.session_id)' .copilot/logs/session.log
```

## Privacy & Security

### Default Behavior
- ✅ No prompt content logged
- ✅ No sensitive data capture
- ✅ Logs stored locally only
- ✅ Git info (branch/commit) captured for context

### Privacy Controls
- **Disable entirely**: `SKIP_LOGGING=true`
- **Restrict to errors**: `LOG_LEVEL=ERROR`
- **Keep out of git**: `.copilot/logs/` in `.gitignore`

### Compliance Notes
- Logs never leave your machine
- No telemetry sent externally
- GDPR/privacy-friendly by design
- Suitable for regulated environments

## Troubleshooting

### Logs Directory Missing

```bash
# Verify directory exists
ls -la .copilot/logs/

# Create if missing
mkdir -p .copilot/logs

# Fix permissions
chmod +x .github/hooks/session-logger/*.sh
```

### Hooks Not Triggering

```bash
# Check environment
echo "SKIP_LOGGING: $SKIP_LOGGING"
echo "LOG_LEVEL: $LOG_LEVEL"

# Verify hook configuration
cat .github/hooks/session-logger/hooks.json

# Ensure scripts are executable
chmod +x .github/hooks/session-logger/*.sh

# Check for errors
tail .copilot/logs/session.log
tail .copilot/logs/prompts.log
```

### Permission Denied Errors

```bash
# Fix all scripts
chmod +x .github/hooks/session-logger/*.sh

# Verify
ls -l .github/hooks/session-logger/
```

### Insufficient Disk Space

```bash
# Check log file sizes
du -sh .copilot/logs/*

# Archive old logs
gzip .copilot/logs/session.log

# Or disable logging
export SKIP_LOGGING=true
```

## Integration with CI/CD

The Session Logger hook is workspace-local only and does not affect CI/CD pipelines. To include session analytics in CI:

```bash
#!/bin/bash
# Example: CI job to report session metrics

if [[ -f .copilot/logs/session.log ]]; then
  echo "Session Metrics:"
  jq -s 'group_by(.event) | map({event: .[0].event, count: length})' .copilot/logs/session.log
fi
```

## Migration & Rollback

### Update Existing Installation

```bash
# Pull latest hook definitions
git pull

# Re-run setup to update scripts
./.github/hooks/session-logger/setup.sh

# Verify new configuration
cat .github/hooks/session-logger/hooks.json
```

### Disable the Hook

```bash
# Permanent disable
export SKIP_LOGGING=true

# Or remove hook configuration
rm .github/hooks/session-logger/hooks.json
```

### Archive Logs

```bash
# Create archive
tar -czf session-logs-$(date +%Y%m%d).tar.gz .copilot/logs/

# Clear logs
rm .copilot/logs/*.log
```

## Advanced Usage

### Custom Log Processing

```bash
# Stream logs to external system
tail -f .copilot/logs/session.log | curl -X POST -d @- https://your-logger.example.com

# Aggregate daily statistics
jq -s 'group_by(.timestamp[0:10])' .copilot/logs/session.log | jq 'map({date: .[0].timestamp[0:10], sessions: length})'

# Find longest sessions
jq -s 'sort_by(.timestamp)' .copilot/logs/session.log | jq -s 'group_by(.[0].git.branch) | map(length)'
```

### Hook Validation

```bash
# Validate hooks.json syntax
jq empty .github/hooks/session-logger/hooks.json && echo "✓ Valid JSON"

# Test script execution
bash -n .github/hooks/session-logger/log-session-start.sh && echo "✓ Script is valid"
```

## Support & Feedback

For issues or suggestions:
1. Check the Troubleshooting section above
2. Review `.copilot/logs/session.log` for error context
3. Open an issue in the repository
4. Include relevant log entries (sanitized if necessary)
