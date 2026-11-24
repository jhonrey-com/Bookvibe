#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

FILE_ARG="${1:-}"
RELEASE_APP="$DIR/src-tauri/target/release/bundle/macos/Quillvibe.app/Contents/MacOS/quillvibe"
RELEASE_BIN="$DIR/src-tauri/target/release/quillvibe"
DEBUG_BIN="$DIR/src-tauri/target/debug/quillvibe"

launch_with_arg() {
  local bin="$1"
  if [[ -n "$FILE_ARG" ]]; then
    "$bin" "$FILE_ARG" >/dev/null 2>&1 &
  else
    "$bin" >/dev/null 2>&1 &
  fi
}

if [[ -x "$RELEASE_APP" ]]; then
  launch_with_arg "$RELEASE_APP"
  exit 0
elif [[ -x "$RELEASE_BIN" ]]; then
  launch_with_arg "$RELEASE_BIN"
  exit 0
elif [[ -x "$DEBUG_BIN" ]]; then
  launch_with_arg "$DEBUG_BIN"
  exit 0
fi

if [[ ! -d "node_modules" ]]; then
  npm install
fi

if command -v cargo >/dev/null 2>&1; then
  npm run tauri:build
  if [[ -x "$RELEASE_APP" ]]; then
    launch_with_arg "$RELEASE_APP"
    exit 0
  elif [[ -x "$RELEASE_BIN" ]]; then
    launch_with_arg "$RELEASE_BIN"
    exit 0
  fi
fi

(sleep 2 && open "http://localhost:1420") &
npm run dev
