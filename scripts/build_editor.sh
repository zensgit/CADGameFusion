#!/usr/bin/env bash
set -euo pipefail

QT_PREFIX="${1:-}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/build"

# Resolve cmake binary
CMAKE_BIN="${CMAKE_BIN:-cmake}"
if ! command -v "$CMAKE_BIN" >/dev/null 2>&1; then
  if [ -x "/Applications/CMake.app/Contents/bin/cmake" ]; then
    CMAKE_BIN="/Applications/CMake.app/Contents/bin/cmake"
  fi
fi
if ! command -v "$CMAKE_BIN" >/dev/null 2>&1; then
  echo "[build_editor] cmake not found. Install CMake or set CMAKE_BIN to cmake path." >&2
  exit 1
fi

if [ -z "$QT_PREFIX" ]; then
  # Try to auto-detect common Qt6 locations
  if [ -d "/Applications/Qt" ]; then
    QT_PREFIX=$(ls -d /Applications/Qt/6.*/* 2>/dev/null | grep -E "/(macos|clang_64)$" | sort -Vr | head -n1 || true)
  elif [ -d "$HOME/Qt" ]; then
    QT_PREFIX=$(ls -d "$HOME"/Qt/6.*/* 2>/dev/null | grep -E "/(macos|clang_64|gcc_64)$" | sort -Vr | head -n1 || true)
  fi
fi

if [ -z "$QT_PREFIX" ]; then
  echo "[build_editor] Qt6 prefix not provided and auto-detect failed. Pass it explicitly, e.g.:" >&2
  echo "  $0 /Applications/Qt/6.x/macos" >&2
  exit 1
fi

if [ -z "${VCPKG_ROOT:-}" ]; then
  echo "[build_editor] VCPKG_ROOT not set. Run scripts/bootstrap_vcpkg.sh first or set it manually." >&2
  exit 1
fi

# Select generator
GEN_ARGS=()
UNAME_OUT="$(uname -s || echo unknown)"
if command -v ninja >/dev/null 2>&1; then
  GEN_ARGS+=( -G "Ninja Multi-Config" )
elif [ "$UNAME_OUT" = "Darwin" ]; then
  GEN_ARGS+=( -G Xcode )
fi

# Ensure compilers are set when needed
export CC="${CC:-clang}"
export CXX="${CXX:-clang++}"

"$CMAKE_BIN" -S "$ROOT_DIR" -B "$BUILD_DIR" \
  -DBUILD_EDITOR_QT=ON \
  -DCMAKE_PREFIX_PATH="$QT_PREFIX" \
  -DCMAKE_TOOLCHAIN_FILE="$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake" \
  -DVCPKG_MANIFEST_MODE=ON \
  ${GEN_ARGS[@]}

"$CMAKE_BIN" --build "$BUILD_DIR" --config Release --parallel

echo "[build_editor] Done. Run: $BUILD_DIR/bin/editor_qt"
