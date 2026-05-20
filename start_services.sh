#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV="$BACKEND_DIR/venv/bin/activate"
BACKEND_ENTRYPOINT="app.py"
BACKEND_DIR_Q="$(printf '%q' "$BACKEND_DIR")"
FRONTEND_DIR_Q="$(printf '%q' "$FRONTEND_DIR")"
BACKEND_VENV_Q="$(printf '%q' "$BACKEND_VENV")"
BACKEND_ENTRYPOINT_Q="$(printf '%q' "$BACKEND_ENTRYPOINT")"

open_terminal() {
  local title="$1"
  local command="$2"
  local safe_title="${title// /_}"
  local script_path
  script_path="$(mktemp "/tmp/team06a-${safe_title}-XXXXXX.sh")"
  cat > "$script_path" <<EOF
#!/usr/bin/env bash
set +e
$command
status=\$?
if [ \$status -ne 0 ]; then
  echo "Command failed with exit code \$status"
fi
exec bash
EOF
  chmod +x "$script_path"

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash "$script_path"
  elif command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash "$script_path"
  elif command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --title="$title" --command="bash '$script_path'"
  elif command -v konsole >/dev/null 2>&1; then
    konsole --new-tab -p tabtitle="$title" -e bash "$script_path"
  elif command -v xterm >/dev/null 2>&1; then
    xterm -T "$title" -e bash "$script_path"
  else
    echo "No supported terminal found (gnome-terminal/x-terminal-emulator/xfce4-terminal/konsole/xterm)."
    exit 1
  fi
}

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl command not found. This script requires a Linux system with systemd."
  exit 1
fi

if [ ! -f "$BACKEND_VENV" ]; then
  echo "Backend virtual environment not found at $BACKEND_VENV"
  echo "Create it first with: cd \"$BACKEND_DIR\" && python -m venv venv"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm command not found. Install Node.js and npm before starting the frontend."
  exit 1
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Frontend dependencies not found at $FRONTEND_DIR/node_modules"
  echo "Install them first with: cd \"$FRONTEND_DIR\" && npm install"
  exit 1
fi



open_terminal "Backend" "cd $BACKEND_DIR_Q && source $BACKEND_VENV_Q && python3 $BACKEND_ENTRYPOINT_Q"
open_terminal "Frontend" "cd $FRONTEND_DIR_Q && npm run dev"
