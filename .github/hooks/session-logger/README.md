---
name: 'Session Logger'
description: 'Logs all Copilot coding agent session activity for audit and analysis'
tags: ['logging', 'audit', 'analytics']
---

# Session Logger Hook

Comprehensive logging for GitHub Copilot coding agent sessions, tracking session starts, ends, and user prompts for audit trails and usage analytics.

## Overview

This hook provides detailed logging of Copilot coding agent activity:
- **Session Tracking**: Log session start/end times with working directory context
- **Prompt Logging**: Record when user prompts are submitted
- **Git Metadata**: Capture branch and commit information at session start
- **Structured Logging**: JSON format for easy parsing and analysis
- **Privacy Aware**: Configurable to disable logging or sensitive data capture

## Features

- **Session Tracking**: Log session start and end events with environment metadata
- **Prompt Logging**: Record when user prompts are submitted with optional content capture
- **Structured Logging**: JSONL (JSON Lines) format for easy parsing and stream processing
- **Privacy Aware**: Configurable to disable logging entirely or limit sensitive data collection
- **Git Integration**: Automatically capture current branch and commit SHA
- **Error Resilience**: Non-blocking errors prevent hook failures from breaking workflows
- **Configurable Log Levels**: DEBUG, INFO, ERROR levels for granular control

## Installation

### Quick Setup

```bash
# Ensure the hook files are executable
chmod +x .github/hooks/session-logger/*.sh

# Create the logs directory
mkdir -p .copilot/logs

# Add logs to .gitignore
echo ".copilot/logs/" >> .gitignore
```

### Verify Installation

The hooks are automatically loaded from `.github/hooks/session-logger/hooks.json` when the Copilot agent starts. No additional configuration is needed.

## Log Format

Session events are written to `.copilot/logs/session.log` and prompt events to `.copilot/logs/prompts.log` in JSONL (JSON Lines) format:

### Session Start
```json
{"timestamp":"2024-01-15T10:30:00Z","event":"sessionStart","cwd":"/workspace/project","git":{"branch":"main","commit":"a1b2c3d"},"level":"INFO"}
```

### Session Stop
```json
{"timestamp":"2024-01-15T10:35:45Z","event":"sessionStop","level":"INFO"}
```

### Prompt Submission
```json
{"timestamp":"2024-01-15T10:32:00Z","event":"userPromptSubmit","level":"INFO"}
```

## Configuration

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `SKIP_LOGGING` | `true` / `false` | `false` | Disable logging entirely |
| `LOG_LEVEL` | `DEBUG`, `INFO`, `ERROR` | `INFO` | Control verbosity |
| `CAPTURE_PROMPT_TEXT` | `true` / `false` | `false` | Include full prompt content (privacy concern) |

### Setting Environment Variables

```bash
# Disable logging for a session
export SKIP_LOGGING=true

# Enable debug-level logging  
export LOG_LEVEL=DEBUG

# Enable prompt content capture (use with caution)
export CAPTURE_PROMPT_TEXT=true
```

## Privacy & Security

- **Default Privacy**: Logs do not include prompt content by default
- **Local Storage**: Logs are stored in `.copilot/logs/` on disk only
- **.gitignore**: Add `.copilot/logs/` to `.gitignore` to prevent committing session data
- **Disable Globally**: Set `SKIP_LOGGING=true` to disable logging
- **Compliance**: No data is sent externally; all logging is local

## Log Analysis

### View Recent Sessions
```bash
tail -20 .copilot/logs/session.log
```

### Count Prompts by Date
```bash
grep "userPromptSubmit" .copilot/logs/prompts.log | jq -s 'group_by(.timestamp[0:10]) | map({date: .[0].timestamp[0:10], count: length})'
```

### Extract Git Branch Distribution
```bash
jq '.git.branch' .copilot/logs/session.log | sort | uniq -c
```

## Troubleshooting

**Logs directory not created**: Ensure `.github/hooks/session-logger/` scripts are executable:
```bash
chmod +x .github/hooks/session-logger/*.sh
```

**Logs not appearing**: Check environment variables:
```bash
echo $SKIP_LOGGING
echo $LOG_LEVEL
```

**Permission denied**: Verify script execution permissions:
```bash
ls -la .github/hooks/session-logger/
```

## Architecture

| Event | Handler | Output |
|-------|---------|--------|
| `SessionStart` | `log-session-start.sh` | `.copilot/logs/session.log` |
| `Stop` | `log-session-end.sh` | `.copilot/logs/session.log` |
| `UserPromptSubmit` | `log-prompt.sh` | `.copilot/logs/prompts.log` |

Hook configuration: `.github/hooks/session-logger/hooks.json`
