#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$PROJECT_DIR/.canon/state.json"

mkdir -p "$PROJECT_DIR/.canon/execution"

# Initialize state
cat > "$STATE_FILE" <<EOF
{
  "phase": "initializing",
  "status": "starting",
  "strategy": "nba-oracle-bot",
  "signals": {
    "injury_scout": "idle",
    "crossmarket_arb": "idle",
    "series_probability": "idle"
  },
  "metrics": {
    "scans": 0,
    "opportunities_found": 0,
    "trades_executed": 0,
    "pnl_usdc": 0
  },
  "logs": []
}
EOF

source "$PROJECT_DIR/agent-shim.sh"

if command -v canon &>/dev/null; then
  canon run "$PROJECT_DIR"
else
  echo "Canon not found — falling back to tmux"
  tmux new-session -d -s nba-oracle -x 220 -y 50
  tmux split-window -h -t nba-oracle
  tmux send-keys -t nba-oracle:0.0 "cd $PROJECT_DIR && $AGENT_CMD" Enter
  tmux send-keys -t nba-oracle:0.1 "watch -n 2 'cat .canon/state.json | python3 -m json.tool'" Enter
  tmux attach-session -t nba-oracle
fi
