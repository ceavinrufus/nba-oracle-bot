#!/usr/bin/env bash
# Detect available AI agent provider

if command -v claude &>/dev/null; then
  AGENT_CMD="claude --dangerously-skip-permissions"
  AGENT_PROVIDER="claude"
elif command -v codex &>/dev/null; then
  AGENT_CMD="codex"
  AGENT_PROVIDER="codex"
elif command -v opencode &>/dev/null; then
  AGENT_CMD="opencode"
  AGENT_PROVIDER="opencode"
else
  echo "Warning: No AI agent found. Install claude, codex, or opencode."
  AGENT_CMD="echo 'No agent available'"
  AGENT_PROVIDER="none"
fi

export AGENT_CMD
export AGENT_PROVIDER
