#!/bin/bash
# Relaunch Comet with the CDP remote-debugging port so upload-cdp.js can attach.
# IMPORTANT: fully quit Comet first (Cmd+Q) — a running instance holds the profile lock
# and the debug flag only applies to a fresh launch. Your tabs/session are restored on relaunch.
PORT="${1:-9222}"

if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT already listening — Comet is likely already in debug mode. Nothing to do."
  exit 0
fi

if pgrep -x "Comet" >/dev/null 2>&1; then
  echo "Comet is running WITHOUT the debug port. Quit it fully (Cmd+Q) first, then re-run this."
  exit 1
fi

open -a "Comet" --args --remote-debugging-port="$PORT" --restore-last-session
echo "Launched Comet with --remote-debugging-port=$PORT. Give it a few seconds, then uploads can attach."
