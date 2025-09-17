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
  "${CLI}" --out "$ROOT/sample_exports" --spec "$SPEC" --gltf-holes full
  mkdir -p "$GOLDEN_DIR"
  for jf in "$OUT_DIR"/group_*.json; do [ -f "$jf" ] && cp -f "$jf" "$GOLDEN_DIR/"; done
  for mf in "$OUT_DIR"/mesh_group_*.gltf "$OUT_DIR"/mesh_group_*.bin; do [ -f "$mf" ] && cp -f "$mf" "$GOLDEN_DIR/"; done
  echo "Refreshed golden: $GOLDEN_DIR"
}

update_scene_from_cli() {
  local SCENE="$1"; shift
  local GOLDEN_DIR="$1"; shift
  local OUT_DIR="$ROOT/build/exports/scene_cli_${SCENE}"
  "${CLI}" --out "$ROOT/build/exports" --scene "$SCENE" --gltf-holes full
  mkdir -p "$GOLDEN_DIR"
  for jf in "$OUT_DIR"/group_*.json; do [ -f "$jf" ] && cp -f "$jf" "$GOLDEN_DIR/"; done
  for mf in "$OUT_DIR"/mesh_group_*.gltf "$OUT_DIR"/mesh_group_*.bin; do [ -f "$mf" ] && cp -f "$mf" "$GOLDEN_DIR/"; done
  echo "Refreshed golden: $GOLDEN_DIR"
}

update_scene_from_cli sample "$ROOT/sample_exports/scene_sample"
update_scene_from_cli holes "$ROOT/sample_exports/scene_holes"
update_scene_from_cli complex "$ROOT/sample_exports/scene_complex"

update_scene_from_spec "$ROOT/tools/specs/scene_concave_spec.json" "$ROOT/sample_exports/scene_concave"
update_scene_from_spec "$ROOT/tools/specs/scene_nested_holes_spec.json" "$ROOT/sample_exports/scene_nested_holes"

echo "Done. Validate with:\n  python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_sample --schema\n  python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_holes --schema\n  python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_complex --schema\n  python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_concave --schema\n  python3 $ROOT/tools/validate_export.py $ROOT/sample_exports/scene_nested_holes --schema"
