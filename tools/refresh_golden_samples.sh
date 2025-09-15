#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
CLI_CAND=(
  "$ROOT/build/tools/export_cli"
  "$ROOT/build/tools/Release/export_cli.exe"
  "$ROOT/build/bin/export_cli"
  "$ROOT/build/Release/export_cli"
)

CLI=""
for p in "${CLI_CAND[@]}"; do
  if [ -f "$p" ]; then CLI="$p"; break; fi
done

if [ -z "$CLI" ]; then
  echo "export_cli not found. Build it first: cmake --build build --target export_cli" >&2
  exit 1
fi

echo "Using export_cli: $CLI"

update_scene_from_spec() {
  local SPEC="$1"; shift
  local GOLDEN_DIR="$1"; shift
  local STEM=$(basename "$SPEC" .json)
  local OUT_DIR="$ROOT/sample_exports/scene_cli_${STEM}"
  "${CLI}" --out "$ROOT/sample_exports" --spec "$SPEC"
  mkdir -p "$GOLDEN_DIR"
  cp -f "$OUT_DIR/group_0.json" "$GOLDEN_DIR/group_0.json"
  if [ -f "$OUT_DIR/mesh_group_0.gltf" ] && [ -f "$OUT_DIR/mesh_group_0.bin" ]; then
    cp -f "$OUT_DIR/mesh_group_0.gltf" "$GOLDEN_DIR/mesh_group_0.gltf"
    cp -f "$OUT_DIR/mesh_group_0.bin" "$GOLDEN_DIR/mesh_group_0.bin"
  fi
  echo "Refreshed golden: $GOLDEN_DIR"
}

update_scene_from_spec "$ROOT/tools/specs/scene_concave_spec.json" "$ROOT/sample_exports/scene_concave"
update_scene_from_spec "$ROOT/tools/specs/scene_nested_holes_spec.json" "$ROOT/sample_exports/scene_nested_holes"

echo "Done. You can run: python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_concave --schema"

