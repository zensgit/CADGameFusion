#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VCPKG_DIR="$ROOT_DIR/vcpkg"

echo "[bootstrap] Repo root: $ROOT_DIR"

if [ ! -d "$VCPKG_DIR" ]; then
  echo "[bootstrap] Cloning vcpkg into $VCPKG_DIR ..."
  git clone https://github.com/microsoft/vcpkg.git "$VCPKG_DIR"
else
  echo "[bootstrap] vcpkg already exists at $VCPKG_DIR"
fi

echo "[bootstrap] Bootstrapping vcpkg ..."
"$VCPKG_DIR/bootstrap-vcpkg.sh"

echo
echo "[bootstrap] Done. Set VCPKG_ROOT and build, e.g.:"
echo "  export VCPKG_ROOT=\"$VCPKG_DIR\""
echo "  ./scripts/build_core.sh"
echo "  ./scripts/build_editor.sh /path/to/Qt/6.x/<platform>"

