#!/usr/bin/env bash
set -euo pipefail

# Local CI runner replicating strict-exports workflow without GitHub Actions.
# Usage:
#   tools/local_ci.sh [--build-type Release|Debug] [--rtol 1e-6] [--gltf-holes outer|full]
#
# Defaults: Release, rtol=1e-6, holes outer (others full)

BUILD_TYPE="Release"
RTOL="1e-6"
# Default to full to reflect real topology locally; CI can still pin per-scene
GLTF_HOLES_DEFAULT="full"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-type) BUILD_TYPE="$2"; shift 2;;
    --rtol) RTOL="$2"; shift 2;;
    --gltf-holes) GLTF_HOLES_DEFAULT="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

echo "[LOCAL-CI] Configure (BUILD_TYPE=$BUILD_TYPE)"
GEN=""
if command -v ninja >/dev/null 2>&1; then GEN="-G Ninja"; fi
cmake -S . -B build -DCMAKE_BUILD_TYPE="$BUILD_TYPE" -DBUILD_EDITOR_QT=OFF -DCADGF_USE_NLOHMANN_JSON=ON -DCADGF_SORT_RINGS=ON $GEN

echo "[LOCAL-CI] Build tools and tests"
cmake --build build --config "$BUILD_TYPE" --target export_cli --parallel || true
cmake --build build --config "$BUILD_TYPE" --target test_spec_parsing --parallel || true
cmake --build build --config "$BUILD_TYPE" --target test_normalization_cpp --parallel || true

echo "[LOCAL-CI] Locate export_cli"
EXPORT_CLI=""
for p in \
  build/bin/export_cli \
  build/bin/export_cli.exe \
  build/tools/export_cli \
  build/tools/Release/export_cli.exe \
  build/Release/export_cli \
  build/Release/export_cli.exe; do
  if [[ -f "$p" ]]; then EXPORT_CLI="$p"; break; fi
done
if [[ -z "$EXPORT_CLI" ]]; then echo "export_cli not found"; exit 1; fi
echo "  -> $EXPORT_CLI"

echo "[LOCAL-CI] Generate scenes"
SCENES=(sample holes multi units complex)
for s in "${SCENES[@]}"; do
  "$EXPORT_CLI" --out build/exports --scene "$s" --gltf-holes "$GLTF_HOLES_DEFAULT"
done
[[ -f tools/specs/scene_complex_spec.json ]] && "$EXPORT_CLI" --out build/exports --spec tools/specs/scene_complex_spec.json --gltf-holes "$GLTF_HOLES_DEFAULT" || true
[[ -f tools/specs/scene_concave_spec.json ]] && "$EXPORT_CLI" --out build/exports --spec tools/specs/scene_concave_spec.json --gltf-holes "$GLTF_HOLES_DEFAULT" || true
[[ -f tools/specs/scene_nested_holes_spec.json ]] && "$EXPORT_CLI" --out build/exports --spec tools/specs/scene_nested_holes_spec.json --gltf-holes "$GLTF_HOLES_DEFAULT" || true

echo "[LOCAL-CI] Validate scenes (schema + stats)"
python3 -m pip install --user --upgrade pip >/dev/null 2>&1 || true
python3 -m pip install --user jsonschema >/dev/null 2>&1 || true
STATS_FILE=build/consistency_stats.txt
: > "$STATS_FILE"
for d in build/exports/scene_cli_*; do
  [[ -d "$d" ]] || continue
  python3 tools/validate_export.py "$d" --schema --stats-out "$STATS_FILE"
done

echo "[LOCAL-CI] Normalization checks (Python)"
python3 tools/test_normalization.py build/exports

echo "[LOCAL-CI] Normalization checks (C++)"
if [[ -f build/tests/tools/test_normalization_cpp ]]; then
  build/tests/tools/test_normalization_cpp
elif [[ -f build/tests/tools/Release/test_normalization_cpp.exe ]]; then
  build/tests/tools/Release/test_normalization_cpp.exe
else
  echo "[WARN] test_normalization_cpp not found"
fi

echo "[LOCAL-CI] Structure comparison"
python3 tools/compare_export_to_sample.py build/exports/scene_cli_sample sample_exports/scene_sample
python3 tools/compare_export_to_sample.py build/exports/scene_cli_holes sample_exports/scene_holes
python3 tools/compare_export_to_sample.py build/exports/scene_cli_complex sample_exports/scene_complex
python3 tools/compare_export_to_sample.py build/exports/scene_cli_scene_concave_spec sample_exports/scene_concave
python3 tools/compare_export_to_sample.py build/exports/scene_cli_scene_nested_holes_spec sample_exports/scene_nested_holes

echo "[LOCAL-CI] Field-level comparison (rtol=$RTOL)"
python3 tools/compare_fields.py build/exports/scene_cli_sample sample_exports/scene_sample --rtol "$RTOL" --json-out build/field_sample.json --meta-mode on --mode full
python3 tools/compare_fields.py build/exports/scene_cli_holes sample_exports/scene_holes --rtol "$RTOL" --json-out build/field_holes.json --meta-mode on --mode full
python3 tools/compare_fields.py build/exports/scene_cli_complex sample_exports/scene_complex --rtol "$RTOL" --json-out build/field_complex.json --meta-mode on --mode full
python3 tools/compare_fields.py build/exports/scene_cli_scene_complex_spec sample_exports/scene_complex --rtol "$RTOL" --json-out build/field_spec_complex.json --meta-mode on --mode full
python3 tools/compare_fields.py build/exports/scene_cli_units sample_exports/scene_units --rtol "$RTOL" --json-out build/field_units.json --mode full --meta-mode on --allow-gltf-mismatch
python3 tools/compare_fields.py build/exports/scene_cli_scene_concave_spec sample_exports/scene_concave --rtol "$RTOL" --json-out build/field_concave.json --mode full --meta-mode on --allow-gltf-mismatch
python3 tools/compare_fields.py build/exports/scene_cli_scene_nested_holes_spec sample_exports/scene_nested_holes --rtol "$RTOL" --json-out build/field_nested_holes.json --mode full --meta-mode on --allow-gltf-mismatch
python3 tools/compare_fields.py build/exports/scene_cli_multi sample_exports/scene_multi_groups --rtol "$RTOL" --json-out build/field_multi.json --mode full --meta-mode on --allow-gltf-mismatch

echo "[LOCAL-CI] Summary"
echo "- Build type: $BUILD_TYPE"
echo "- Exported scenes in build/exports"
echo "- Consistency stats: $STATS_FILE"
echo "- Field reports: build/field_*.json"
echo "[LOCAL-CI] Done"
