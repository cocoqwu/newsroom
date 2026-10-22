#!/bin/bash
# Restart the dev server safely: stop the old one, wait until nothing holds the port or the
# database file, then start fresh. Used during the overnight build; `npm run dev` is fine by hand.
cd "$(dirname "$0")/.."
PORT=${PORT:-3100}
pkill -f "next dev" 2>/dev/null
for i in $(seq 1 20); do
  if ! lsof -ti tcp:$PORT >/dev/null 2>&1 && ! lsof -nP data/newsroom.db >/dev/null 2>&1; then break; fi
  sleep 0.5
done
LOG=${DEV_LOG:-/tmp/newsroom-dev.log}
nohup npm run dev -- --port $PORT > "$LOG" 2>&1 &
for i in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 http://localhost:$PORT/ ; then echo "dev server up on $PORT (log: $LOG)"; exit 0; fi
  sleep 1
done
echo "dev server did not come up; see $LOG"; exit 1
