#!/usr/bin/env sh
# Terminal installer for Quillvibe (macOS & Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/jhonrey-com/Quillvibe/main/scripts/install.sh | sh

set -eu

REPO="jhonrey-com/Quillvibe"
INSTALL_DIR="${QUILLVIBE_INSTALL_DIR:-$HOME/.local/share/quillvibe}"
BIN_DIR="${HOME}/.local/bin"
FROM_SOURCE=0

for arg in "$@"; do
  case "$arg" in
    --from-source) FROM_SOURCE=1 ;;
  esac
done

OS="$(uname -s)"
echo "Quillvibe Terminal Installer (${OS})"

if [ "$FROM_SOURCE" -eq 0 ]; then
  API_URL="https://api.github.com/repos/${REPO}/releases/latest"
  ASSET_URL=""
  if command -v curl >/dev/null 2>&1; then
    JSON="$(curl -fsSL "$API_URL" 2>/dev/null || true)"
    case "$OS" in
      Darwin)
        ASSET_URL="$(printf '%s' "$JSON" | tr ',' '\n' | grep 'browser_download_url' | grep -E '\.dmg"' | head -n 1 | cut -d '"' -f 4 || true)"
        ;;
      Linux)
        ASSET_URL="$(printf '%s' "$JSON" | tr ',' '\n' | grep 'browser_download_url' | grep -E '\.AppImage"' | head -n 1 | cut -d '"' -f 4 || true)"
        ;;
    esac
  fi

  if [ -n "$ASSET_URL" ]; then
    mkdir -p "$INSTALL_DIR" "$BIN_DIR"
    FNAME="$(basename "$ASSET_URL")"
    OUT_FILE="${INSTALL_DIR}/${FNAME}"
    echo "Downloading ${FNAME}..."
    curl -fL "$ASSET_URL" -o "$OUT_FILE"
    if [ "$OS" = "Linux" ]; then
      chmod +x "$OUT_FILE"
      ln -sf "$OUT_FILE" "${BIN_DIR}/quillvibe"
      echo "Installed to ${BIN_DIR}/quillvibe"
    else
      open "$OUT_FILE"
      echo "Opened macOS disk image at ${OUT_FILE}"
    fi
    exit 0
  else
    echo "No public release asset found on GitHub Releases."
  fi
fi

echo "Preparing Quillvibe source checkout at ${INSTALL_DIR}..."
for cmd in git npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing '${cmd}'. Install Git and Node.js 22+ to run Quillvibe from source." >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$INSTALL_DIR")"
if [ -d "${INSTALL_DIR}/.git" ]; then
  git -C "$INSTALL_DIR" pull --ff-only
else
  git clone "https://github.com/${REPO}.git" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install
echo "Quillvibe is ready in ${INSTALL_DIR}."
echo "Run 'npm run dev' or 'npm run tauri:dev' to start."
