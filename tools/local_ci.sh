#!/usr/bin/env bash
set -euo pipefail

# Local CI runner replicating strict-exports workflow without GitHub Actions.
# Usage:
#   tools/local_ci.sh [--build-type Release|Debug] [--rtol 1e-6] [--gltf-holes outer|full] \
#       [--offline] [--no-pip] [--skip-compare] [--no-fields] [--no-struct-compare] \
#       [--scenes sample,complex] [--quick] [--summary-json] [--clean-exports] [--strict-exit]
#   tools/local_ci.sh -h|--help
#
# Defaults: Release, rtol=1e-6, holes outer (others full)
# New flags:
#   --offline            Skip pip installs and schema validation (best-effort offline)
#   --no-pip             Skip pip installs only
#   --skip-compare       Skip ALL compare phases (structure + field)
#   --no-fields          Skip field-level comparison only
#   --no-struct-compare  Skip structure (sample vs export) comparison only
#   --scenes list        Comma list overrides default scene set defined in ci_scenes.conf
#   --quick              Use quick scene subset from tools/ci_scenes.conf (if defined)
#   --summary-json       Emit machine-readable build/local_ci_summary.json
#   --clean-exports      Remove old build/exports before running (ensures clean subset)
#   --strict-exit        Non-zero exit if any validation / compare phase fails or scene missing

usage() {
  cat <<USAGE
Local CI runner (strict-exports parity)

Options:
  --build-type <Release|Debug>   Build type (default: Release)
  --rtol <value>                 Field comparison tolerance (default: 1e-6)
  --gltf-holes <outer|full>      Holes emission mode (default: full)
  --offline                      Skip pip and schema validation (best-effort offline)
  --no-pip                       Skip pip installs only
  --quick                        Use quick subset from tools/ci_scenes.conf
  -h, --help                     Show this help and exit

Examples:
  bash tools/local_ci.sh --build-type Release --rtol 1e-6 --gltf-holes full
  bash tools/local_ci.sh --offline
  bash tools/local_ci.sh --no-pip
USAGE
}

BUILD_TYPE="Release"
RTOL="1e-6"
# Default to full to reflect real topology locally; CI can still pin per-scene
GLTF_HOLES_DEFAULT="full"
OFFLINE=false
NO_PIP=false
SKIP_COMPARE=false
NO_FIELDS=false
NO_STRUCT_COMPARE=false
SCENES_OVERRIDE=""
QUICK=false
SUMMARY_JSON=false
CLEAN_EXPORTS=false
STRICT_EXIT=false
VALID_OK=0
VALID_FAIL=0
MISSING_SCENES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-type) BUILD_TYPE="$2"; shift 2;;
    --rtol) RTOL="$2"; shift 2;;
    --gltf-holes) GLTF_HOLES_DEFAULT="$2"; shift 2;;
    --offline) OFFLINE=true; NO_PIP=true; shift;;
    --no-pip) NO_PIP=true; shift;;
    --skip-compare) SKIP_COMPARE=true; shift;;
    --no-fields) NO_FIELDS=true; shift;;
    --no-struct-compare) NO_STRUCT_COMPARE=true; shift;;
    --scenes) SCENES_OVERRIDE="$2"; shift 2;;
    --quick) QUICK=true; shift;;
    --summary-json) SUMMARY_JSON=true; shift;;
    --clean-exports) CLEAN_EXPORTS=true; shift;;
    --strict-exit) STRICT_EXIT=true; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; exit 2;;
  esac
done

if [[ "$SKIP_COMPARE" == true ]]; then
  # Unified skipping implies both granular skips
  NO_FIELDS=true
  NO_STRUCT_COMPARE=true
fi

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

if [[ "$CLEAN_EXPORTS" == true ]]; then
  echo "[LOCAL-CI] Cleaning previous exports directory"
  rm -rf build/exports || true
fi
mkdir -p build/exports || true

# Load scenes from config
CONF_FILE="tools/ci_scenes.conf"
DEFAULT_SCENES=(sample holes multi units complex)
SPEC_SCENES=(scene_complex_spec scene_concave_spec scene_nested_holes_spec)
if [[ -f "$CONF_FILE" ]]; then
  REQ_LIST=""
  QUICK_LIST=""
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    if [[ "$line" =~ ^required= ]]; then
      REQ_LIST=${line#required=}
    elif [[ "$line" =~ ^quick= ]]; then
      QUICK_LIST=${line#quick=}
    fi
  done < "$CONF_FILE"
  # Choose which list to use
  SEL_LIST="$REQ_LIST"
  if [[ "$QUICK" == true && -n "$QUICK_LIST" ]]; then
    SEL_LIST="$QUICK_LIST"
  fi
  if [[ -n "$SEL_LIST" ]]; then
    IFS=',' read -r -a cfg_array <<< "$SEL_LIST"
    DEFAULT_SCENES=()
    SPEC_SCENES=()
    for it in "${cfg_array[@]}"; do
      [[ -z "$it" ]] && continue
      if [[ "$it" == *"_spec" ]]; then
        SPEC_SCENES+=("$it")
      else
        DEFAULT_SCENES+=("$it")
      fi
    done
  fi
fi

SELECTED_NORMAL=()
SELECTED_SPEC=()
if [[ -n "$SCENES_OVERRIDE" ]]; then
  IFS=',' read -r -a ov_array <<< "$SCENES_OVERRIDE"
  for it in "${ov_array[@]}"; do
    trimmed="$it"
    [[ -z "$trimmed" ]] && continue
    if [[ "$trimmed" == *"_spec" ]]; then
      SELECTED_SPEC+=("$trimmed")
    else
      SELECTED_NORMAL+=("$trimmed")
    fi
  done
else
  for n in "${DEFAULT_SCENES[@]}"; do SELECTED_NORMAL+=("$n"); done
  if [[ -n "${SPEC_SCENES+_}" ]]; then
    for s in "${SPEC_SCENES[@]}"; do SELECTED_SPEC+=("$s"); done
  fi
fi

for s in "${SELECTED_NORMAL[@]}"; do
  echo "[LOCAL-CI] Export scene: $s"
  "$EXPORT_CLI" --out build/exports --scene "$s" --gltf-holes "$GLTF_HOLES_DEFAULT" || echo "[WARN] export failed for scene $s"
done

if [[ ${#SELECTED_SPEC[@]} -gt 0 ]]; then
  for spec in "${SELECTED_SPEC[@]}"; do
    echo "[LOCAL-CI] Export spec: $spec"
    spec_path="tools/specs/${spec}.json"
    [[ -f "$spec_path" ]] || { echo "[INFO] Spec file missing: $spec_path (skip)"; continue; }
    "$EXPORT_CLI" --out build/exports --spec "$spec_path" --gltf-holes "$GLTF_HOLES_DEFAULT" || echo "[WARN] export failed for spec $spec"
  done
fi

ALL_SCENES=(${SELECTED_NORMAL[@]})
if [[ ${#SELECTED_SPEC[@]:-0} -gt 0 ]]; then
  ALL_SCENES+=("${SELECTED_SPEC[@]}")
fi

echo "[LOCAL-CI] Validate scenes (schema + stats)"
if [[ "$NO_PIP" != true ]]; then
  python3 -m pip install --user --upgrade pip >/dev/null 2>&1 || true
  python3 -m pip install --user jsonschema >/dev/null 2>&1 || true
else
  echo "[LOCAL-CI] Skipping pip installs (--no-pip)"
fi
STATS_FILE=build/consistency_stats.txt
: > "$STATS_FILE"
for sc in "${ALL_SCENES[@]}"; do
  d="build/exports/scene_cli_${sc}"
  [[ -d "$d" ]] || { echo "[INFO] Skip validate (missing export dir for $sc)"; continue; }
  if [[ "$OFFLINE" == true ]]; then
    python3 tools/validate_export.py "$d" --stats-out "$STATS_FILE" || true
  else
    python3 tools/validate_export.py "$d" --schema --stats-out "$STATS_FILE" || true
  fi
done
if [[ ! -s "$STATS_FILE" ]]; then
  echo "[WARN] No stats lines written (check scenes / exports)"
fi

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

if [[ "$NO_STRUCT_COMPARE" == true ]]; then
  echo "[LOCAL-CI] Skipping structure comparison (--no-struct-compare)"
else
  echo "[LOCAL-CI] Structure comparison"
  for sc in "${ALL_SCENES[@]}"; do
    export_dir="build/exports/scene_cli_${sc}"
    [[ -d "$export_dir" ]] || { echo "[INFO] Skip missing export $sc"; continue; }
    ref_dir=""
    if [[ "$sc" == *"_spec" ]]; then
      base=${sc%_spec}
      ref_dir="sample_exports/${base}"
    else
      case "$sc" in
        sample) ref_dir="sample_exports/scene_sample";;
        holes) ref_dir="sample_exports/scene_holes";;
        multi) ref_dir="sample_exports/scene_multi_groups";;
        units) ref_dir="sample_exports/scene_units";;
        complex) ref_dir="sample_exports/scene_complex";;
        *) ref_dir="sample_exports/scene_${sc}";;
      esac
    fi
    if [[ ! -d "$ref_dir" ]]; then
      echo "[WARN] Missing reference for $sc -> $ref_dir (skip)"; continue;
    fi
    python3 tools/compare_export_to_sample.py "$export_dir" "$ref_dir" || echo "[FAIL] Structure compare failed: $sc"
  done
fi

if [[ "$NO_FIELDS" == true ]]; then
  echo "[LOCAL-CI] Skipping field-level comparison (--no-fields)"
else
  echo "[LOCAL-CI] Field-level comparison (rtol=$RTOL)"
  mismatch_allow_set=(units scene_concave_spec scene_nested_holes_spec multi)
  for sc in "${ALL_SCENES[@]}"; do
    export_dir="build/exports/scene_cli_${sc}"
    [[ -d "$export_dir" ]] || { echo "[INFO] Skip missing export $sc"; continue; }
    ref_dir=""
    if [[ "$sc" == *"_spec" ]]; then
      base=${sc%_spec}
      ref_dir="sample_exports/${base}"
    else
      case "$sc" in
        sample) ref_dir="sample_exports/scene_sample";;
        holes) ref_dir="sample_exports/scene_holes";;
        multi) ref_dir="sample_exports/scene_multi_groups";;
        units) ref_dir="sample_exports/scene_units";;
        complex) ref_dir="sample_exports/scene_complex";;
        *) ref_dir="sample_exports/scene_${sc}";;
      esac
    fi
    [[ -d "$ref_dir" ]] || { echo "[WARN] Missing reference for fields $sc -> $ref_dir (skip)"; continue; }
    json_out="build/field_${sc}.json"
    cmd=(python3 tools/compare_fields.py "$export_dir" "$ref_dir" --rtol "$RTOL" --json-out "$json_out" --mode full --meta-mode on)
    for mm in "${mismatch_allow_set[@]}"; do
      if [[ "$sc" == "$mm" ]]; then cmd+=(--allow-gltf-mismatch); break; fi
    done
    if ! "${cmd[@]}" >/dev/null 2>&1; then
      echo "[FAIL] Field compare failed: $sc"
    else
      echo "[OK] Field comparison: $sc"
    fi
  done
fi

echo "[LOCAL-CI] Summary"
echo "- Build type: $BUILD_TYPE"
echo "- Exported scenes in build/exports"
echo "- Consistency stats: $STATS_FILE"
if [[ "$NO_FIELDS" == true ]]; then
  echo "- Field reports: skipped"
else
  echo "- Field reports: build/field_*.json"
fi
if [[ "$NO_STRUCT_COMPARE" == true ]]; then
  echo "- Structure compare: skipped"
fi
if [[ "$OFFLINE" == true && "$SKIP_COMPARE" == true ]]; then
  echo "[LOCAL-CI] OFFLINE_FAST_OK (exports + basic validate only)"
fi

if [[ "$SUMMARY_JSON" == true ]]; then
  SUM_JSON=build/local_ci_summary.json
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "unknown")
  mkdir -p build || true
  # Collect simple validation stats (count ok/no) from consistency_stats.txt
  VALID_OK=0
  VALID_FAIL=0
  MISSING_SCENES=()
  if [[ -s "$STATS_FILE" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      if [[ "$line" == *"ok=YES"* ]]; then VALID_OK=$((VALID_OK+1));
      elif [[ "$line" == *"ok=NO"* ]]; then VALID_FAIL=$((VALID_FAIL+1)); fi
    done < "$STATS_FILE"
  fi
  # Determine which requested scenes produced no stats line
  for sc in "${ALL_SCENES[@]}"; do
    if ! grep -q "scene_cli_${sc}" "$STATS_FILE" 2>/dev/null; then
      MISSING_SCENES+=("$sc")
    fi
  done
  {
    echo "{";
    echo "  \"buildType\": \"$BUILD_TYPE\",";
    echo "  \"rtol\": \"$RTOL\",";
    echo "  \"offline\": $([[ "$OFFLINE" == true ]] && echo true || echo false),";
    echo "  \"skipCompare\": $([[ "$SKIP_COMPARE" == true ]] && echo true || echo false),";
    echo "  \"skipFields\": $([[ "$NO_FIELDS" == true ]] && echo true || echo false),";
    echo "  \"skipStruct\": $([[ "$NO_STRUCT_COMPARE" == true ]] && echo true || echo false),";
    echo "  \"validationOkCount\": $VALID_OK,";
    echo "  \"validationFailCount\": $VALID_FAIL,";
    echo "  \"scenes\": [";
    idx=0; total=${#ALL_SCENES[@]};
    for s in "${ALL_SCENES[@]}"; do
      idx=$((idx+1));
      comma=","; [[ $idx -eq $total ]] && comma="";
      echo "    \"$s\"$comma";
    done
    echo "  ],";
    echo "  \"missingScenes\": [";
    if [[ -n "${MISSING_SCENES[*]-}" ]]; then
      midx=0; mtotal=${#MISSING_SCENES[@]}
      for ms in "${MISSING_SCENES[@]}"; do
        midx=$((midx+1)); comma=","; [[ $midx -eq $mtotal ]] && comma="";
        echo "    \"$ms\"$comma";
      done
    fi
    echo "  ],";
    echo "  \"timestamp\": \"$TS\"";
    echo "}";
  } > "$SUM_JSON" || echo "[WARN] Failed to write $SUM_JSON"
  echo "[LOCAL-CI] Summary JSON: $SUM_JSON"
fi

# Strict exit logic
if [[ "$STRICT_EXIT" == true ]]; then
  FAIL_FLAG=0
  # Basic validation failures
  if [[ $VALID_FAIL -gt 0 ]]; then FAIL_FLAG=1; fi
  # Missing scenes requested
  if [[ -n "${MISSING_SCENES[*]-}" ]]; then FAIL_FLAG=1; fi
  # If comparisons were not skipped, scan field/structure compare logs for FAIL markers
  if [[ "$SKIP_COMPARE" != true ]]; then
    if grep -q '\[FAIL\] Field compare failed' build/local_ci_output.log 2>/dev/null || \
       grep -q '\[FAIL\] Structure compare failed' build/local_ci_output.log 2>/dev/null; then
       FAIL_FLAG=1
    fi
  fi
  if [[ $FAIL_FLAG -ne 0 ]]; then
    echo "[LOCAL-CI] STRICT_EXIT failure triggered" >&2
    exit 2
  fi
fi

echo "[LOCAL-CI] Done"
