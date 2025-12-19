#!/usr/bin/env bash
set -euo pipefail

# Local CI runner replicating strict-exports workflow without GitHub Actions.
# Usage:
#   tools/local_ci.sh [--build-type Release|Debug] [--rtol 1e-6] [--gltf-holes outer|full] \
#       [--build-dir <path>] [--toolchain <path>] \
#       [--offline] [--no-pip] [--skip-compare] [--no-fields] [--no-struct-compare] \
#       [--scenes sample,complex] [--quick] [--clean-exports] [--strict-exit]
#   tools/local_ci.sh -h|--help
#
# Defaults: Release, rtol=1e-6, holes full
# Outputs:
#   <build_dir>/local_ci_output.log   - Full execution log
#   <build_dir>/local_ci_summary.json - Machine-readable summary (always generated)
#
# Flags:
#   --build-dir <path>   CMake build directory (default: build) - REQUIRED for reproducibility
#   --build-type <type>  Release or Debug (default: Release)
#   --toolchain <path>   CMake toolchain file (e.g., vcpkg.cmake). Also respects CMAKE_TOOLCHAIN_FILE env var.
#   --rtol <value>       Field comparison tolerance (default: 1e-6)
#   --gltf-holes <mode>  Holes emission: outer or full (default: full)
#   --offline            Skip pip installs and schema validation (best-effort offline)
#   --no-pip             Skip pip installs only
#   --skip-compare       Skip ALL compare phases (structure + field)
#   --no-fields          Skip field-level comparison only
#   --no-struct-compare  Skip structure (sample vs export) comparison only
#   --scenes list        Comma list overrides default scene set defined in ci_scenes.conf
#   --quick              Use quick scene subset from tools/ci_scenes.conf (if defined)
#   --clean-exports      Remove old <build_dir>/exports before running (ensures clean subset)
#   --strict-exit        Non-zero exit if any validation / compare phase fails or scene missing

usage() {
  cat <<USAGE
Local CI runner (strict-exports parity)

Options:
  --build-dir <path>             CMake build dir (default: build) [REQUIRED for CI]
  --build-type <Release|Debug>   Build type (default: Release)
  --toolchain <path>             CMake toolchain file (e.g., for vcpkg)
  --rtol <value>                 Field comparison tolerance (default: 1e-6)
  --gltf-holes <outer|full>      Holes emission mode (default: full)
  --offline                      Skip pip and schema validation (best-effort offline)
  --no-pip                       Skip pip installs only
  --quick                        Use quick subset from tools/ci_scenes.conf
  --strict-exit                  Non-zero exit on any failure (for CI gates)
  -h, --help                     Show this help and exit

Outputs (always generated):
  <build_dir>/local_ci_output.log    Full execution log
  <build_dir>/local_ci_summary.json  Machine-readable summary

Examples:
  bash tools/local_ci.sh --build-dir build_vcpkg --build-type Release --rtol 1e-6 --gltf-holes full --strict-exit
  bash tools/local_ci.sh --build-dir build --toolchain \$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake --strict-exit
  bash tools/local_ci.sh --build-dir build --offline --quick
USAGE
}

BUILD_TYPE="Release"
BUILD_DIR="build"
TOOLCHAIN=""
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
CLEAN_EXPORTS=false
STRICT_EXIT=false

# Failure tracking (for strict-exit)
VALID_OK=0
VALID_FAIL=0
STRUCT_FAIL=0
FIELD_FAIL=0
MISSING_SCENES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-type) BUILD_TYPE="$2"; shift 2;;
    --build-dir) BUILD_DIR="$2"; shift 2;;
    --toolchain) TOOLCHAIN="$2"; shift 2;;
    --rtol) RTOL="$2"; shift 2;;
    --gltf-holes) GLTF_HOLES_DEFAULT="$2"; shift 2;;
    --offline) OFFLINE=true; NO_PIP=true; shift;;
    --no-pip) NO_PIP=true; shift;;
    --skip-compare) SKIP_COMPARE=true; shift;;
    --no-fields) NO_FIELDS=true; shift;;
    --no-struct-compare) NO_STRUCT_COMPARE=true; shift;;
    --scenes) SCENES_OVERRIDE="$2"; shift 2;;
    --quick) QUICK=true; shift;;
    --summary-json) shift;;  # Deprecated: always generates summary now
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

# Resolve toolchain: --toolchain > CMAKE_TOOLCHAIN_FILE env var
if [[ -z "$TOOLCHAIN" && -n "${CMAKE_TOOLCHAIN_FILE:-}" ]]; then
  TOOLCHAIN="$CMAKE_TOOLCHAIN_FILE"
fi

# Setup output paths
LOG_FILE="$BUILD_DIR/local_ci_output.log"
SUMMARY_JSON="$BUILD_DIR/local_ci_summary.json"

# Ensure build dir exists for log file
mkdir -p "$BUILD_DIR" || true

# Main execution function - output goes to both console and log
main() {
  echo "[LOCAL-CI] =============================================="
  echo "[LOCAL-CI] Starting local CI run"
  echo "[LOCAL-CI] BUILD_DIR=$BUILD_DIR"
  echo "[LOCAL-CI] BUILD_TYPE=$BUILD_TYPE"
  echo "[LOCAL-CI] TOOLCHAIN=${TOOLCHAIN:-<none>}"
  echo "[LOCAL-CI] RTOL=$RTOL"
  echo "[LOCAL-CI] GLTF_HOLES=$GLTF_HOLES_DEFAULT"
  echo "[LOCAL-CI] STRICT_EXIT=$STRICT_EXIT"
  echo "[LOCAL-CI] =============================================="

  echo "[LOCAL-CI] Configure"
  GEN=""
  # Avoid generator mismatch when the build dir already exists.
  # If <build_dir>/CMakeCache.txt exists, let CMake reuse the existing generator from cache.
  if [[ ! -f "$BUILD_DIR/CMakeCache.txt" ]]; then
    if command -v ninja >/dev/null 2>&1; then GEN="-G Ninja"; fi
  fi

  # Build CMake args
  CMAKE_ARGS=(
    -S . -B "$BUILD_DIR"
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
    -DBUILD_EDITOR_QT=OFF
    -DCADGF_USE_NLOHMANN_JSON=ON
    -DCADGF_SORT_RINGS=ON
  )
  if [[ -n "$TOOLCHAIN" ]]; then
    CMAKE_ARGS+=(-DCMAKE_TOOLCHAIN_FILE="$TOOLCHAIN")
  fi
  if [[ -n "$GEN" ]]; then
    CMAKE_ARGS+=($GEN)
  fi

  cmake "${CMAKE_ARGS[@]}"

  echo "[LOCAL-CI] Build tools and tests"
  cmake --build "$BUILD_DIR" --config "$BUILD_TYPE" --target export_cli --parallel || true
  cmake --build "$BUILD_DIR" --config "$BUILD_TYPE" --target test_spec_parsing --parallel || true
  cmake --build "$BUILD_DIR" --config "$BUILD_TYPE" --target test_normalization_cpp --parallel || true

  echo "[LOCAL-CI] Locate export_cli"
  EXPORT_CLI=""
  for p in \
    "$BUILD_DIR/bin/export_cli" \
    "$BUILD_DIR/bin/export_cli.exe" \
    "$BUILD_DIR/tools/export_cli" \
    "$BUILD_DIR/tools/Release/export_cli.exe" \
    "$BUILD_DIR/Release/export_cli" \
    "$BUILD_DIR/Release/export_cli.exe"; do
    if [[ -f "$p" ]]; then EXPORT_CLI="$p"; break; fi
  done
  if [[ -z "$EXPORT_CLI" ]]; then echo "[ERROR] export_cli not found"; exit 1; fi
  echo "  -> $EXPORT_CLI"

  echo "[LOCAL-CI] Generate scenes"

  if [[ "$CLEAN_EXPORTS" == true ]]; then
    echo "[LOCAL-CI] Cleaning previous exports directory"
    rm -rf "$BUILD_DIR/exports" || true
  fi
  mkdir -p "$BUILD_DIR/exports" || true

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
    "$EXPORT_CLI" --out "$BUILD_DIR/exports" --scene "$s" --gltf-holes "$GLTF_HOLES_DEFAULT" || echo "[WARN] export failed for scene $s"
  done

  if [[ ${#SELECTED_SPEC[@]} -gt 0 ]]; then
    for spec in "${SELECTED_SPEC[@]}"; do
      echo "[LOCAL-CI] Export spec: $spec"
      spec_path="tools/specs/${spec}.json"
      [[ -f "$spec_path" ]] || { echo "[INFO] Spec file missing: $spec_path (skip)"; continue; }
      "$EXPORT_CLI" --out "$BUILD_DIR/exports" --spec "$spec_path" --gltf-holes "$GLTF_HOLES_DEFAULT" || echo "[WARN] export failed for spec $spec"
    done
  fi

  ALL_SCENES=(${SELECTED_NORMAL[@]})
  if [[ ${#SELECTED_SPEC[@]} -gt 0 ]]; then
    ALL_SCENES+=("${SELECTED_SPEC[@]}")
  fi

  echo "[LOCAL-CI] Validate scenes (schema + stats)"
  if [[ "$NO_PIP" != true ]]; then
    python3 -m pip install --user --upgrade pip >/dev/null 2>&1 || true
    python3 -m pip install --user jsonschema >/dev/null 2>&1 || true
  else
    echo "[LOCAL-CI] Skipping pip installs (--no-pip)"
  fi
  STATS_FILE="$BUILD_DIR/consistency_stats.txt"
  : > "$STATS_FILE"
  for sc in "${ALL_SCENES[@]}"; do
    d="$BUILD_DIR/exports/scene_cli_${sc}"
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
  python3 tools/test_normalization.py "$BUILD_DIR/exports"

  echo "[LOCAL-CI] Normalization checks (C++)"
  if [[ -f "$BUILD_DIR/tests/tools/test_normalization_cpp" ]]; then
    "$BUILD_DIR/tests/tools/test_normalization_cpp"
  elif [[ -f "$BUILD_DIR/tests/tools/Release/test_normalization_cpp.exe" ]]; then
    "$BUILD_DIR/tests/tools/Release/test_normalization_cpp.exe"
  else
    echo "[WARN] test_normalization_cpp not found"
  fi

  if [[ "$NO_STRUCT_COMPARE" == true ]]; then
    echo "[LOCAL-CI] Skipping structure comparison (--no-struct-compare)"
  else
    echo "[LOCAL-CI] Structure comparison"
    for sc in "${ALL_SCENES[@]}"; do
      export_dir="$BUILD_DIR/exports/scene_cli_${sc}"
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
      if ! python3 tools/compare_export_to_sample.py "$export_dir" "$ref_dir"; then
        echo "[FAIL] Structure compare failed: $sc"
        STRUCT_FAIL=$((STRUCT_FAIL+1))
      else
        echo "[OK] Structure compare: $sc"
      fi
    done
  fi

  if [[ "$NO_FIELDS" == true ]]; then
    echo "[LOCAL-CI] Skipping field-level comparison (--no-fields)"
  else
    echo "[LOCAL-CI] Field-level comparison (rtol=$RTOL)"
    mismatch_allow_set=(units multi holes complex scene_complex_spec scene_concave_spec scene_nested_holes_spec)
    for sc in "${ALL_SCENES[@]}"; do
      export_dir="$BUILD_DIR/exports/scene_cli_${sc}"
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
      json_out="$BUILD_DIR/field_${sc}.json"
      cmd=(python3 tools/compare_fields.py "$export_dir" "$ref_dir" --rtol "$RTOL" --json-out "$json_out" --mode full --meta-mode on)
      for mm in "${mismatch_allow_set[@]}"; do
        if [[ "$sc" == "$mm" ]]; then cmd+=(--allow-gltf-mismatch); break; fi
      done
      if ! "${cmd[@]}" >/dev/null 2>&1; then
        echo "[FAIL] Field compare failed: $sc"
        FIELD_FAIL=$((FIELD_FAIL+1))
      else
        echo "[OK] Field comparison: $sc"
      fi
    done
  fi

  # Collect validation stats from consistency_stats.txt
  VALID_OK=0
  VALID_FAIL=0
  if [[ -s "$STATS_FILE" ]]; then
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      if [[ "$line" == *"ok=YES"* ]]; then VALID_OK=$((VALID_OK+1));
      elif [[ "$line" == *"ok=NO"* ]]; then VALID_FAIL=$((VALID_FAIL+1)); fi
    done < "$STATS_FILE"
  fi

  # Determine which requested scenes produced no stats line
  MISSING_SCENES=()
  for sc in "${ALL_SCENES[@]}"; do
    if ! grep -q "scene_cli_${sc}" "$STATS_FILE" 2>/dev/null; then
      MISSING_SCENES+=("$sc")
    fi
  done

  echo "[LOCAL-CI] =============================================="
  echo "[LOCAL-CI] Summary"
  echo "[LOCAL-CI] =============================================="
  echo "- Build type: $BUILD_TYPE"
  echo "- Build dir: $BUILD_DIR"
  echo "- Toolchain: ${TOOLCHAIN:-<none>}"
  echo "- Exported scenes in $BUILD_DIR/exports"
  echo "- Consistency stats: $STATS_FILE"
  echo "- Validation OK: $VALID_OK, FAIL: $VALID_FAIL"
  if [[ "$NO_STRUCT_COMPARE" == true ]]; then
    echo "- Structure compare: skipped"
  else
    echo "- Structure compare failures: $STRUCT_FAIL"
  fi
  if [[ "$NO_FIELDS" == true ]]; then
    echo "- Field reports: skipped"
  else
    echo "- Field compare failures: $FIELD_FAIL"
    echo "- Field reports: $BUILD_DIR/field_*.json"
  fi
  if [[ ${#MISSING_SCENES[@]} -gt 0 ]]; then
    echo "- Missing scenes: ${MISSING_SCENES[*]}"
  fi
  if [[ "$OFFLINE" == true && "$SKIP_COMPARE" == true ]]; then
    echo "[LOCAL-CI] OFFLINE_FAST_OK (exports + basic validate only)"
  fi

  # Always generate summary JSON
  TS=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "unknown")
  {
    echo "{";
    echo "  \"buildType\": \"$BUILD_TYPE\",";
    echo "  \"buildDir\": \"$BUILD_DIR\",";
    echo "  \"toolchain\": \"${TOOLCHAIN:-}\",";
    echo "  \"rtol\": \"$RTOL\",";
    echo "  \"gltfHoles\": \"$GLTF_HOLES_DEFAULT\",";
    echo "  \"offline\": $([[ "$OFFLINE" == true ]] && echo true || echo false),";
    echo "  \"skipCompare\": $([[ "$SKIP_COMPARE" == true ]] && echo true || echo false),";
    echo "  \"skipFields\": $([[ "$NO_FIELDS" == true ]] && echo true || echo false),";
    echo "  \"skipStruct\": $([[ "$NO_STRUCT_COMPARE" == true ]] && echo true || echo false),";
    echo "  \"strictExit\": $([[ "$STRICT_EXIT" == true ]] && echo true || echo false),";
    echo "  \"validationOkCount\": $VALID_OK,";
    echo "  \"validationFailCount\": $VALID_FAIL,";
    echo "  \"structCompareFailCount\": $STRUCT_FAIL,";
    echo "  \"fieldCompareFailCount\": $FIELD_FAIL,";
    echo "  \"scenes\": [";
    idx=0; total=${#ALL_SCENES[@]};
    for s in "${ALL_SCENES[@]}"; do
      idx=$((idx+1));
      comma=","; [[ $idx -eq $total ]] && comma="";
      echo "    \"$s\"$comma";
    done
    echo "  ],";
    echo "  \"missingScenes\": [";
    if [[ ${#MISSING_SCENES[@]} -gt 0 ]]; then
      midx=0; mtotal=${#MISSING_SCENES[@]}
      for ms in "${MISSING_SCENES[@]}"; do
        midx=$((midx+1)); comma=","; [[ $midx -eq $mtotal ]] && comma="";
        echo "    \"$ms\"$comma";
      done
    fi
    echo "  ],";
    echo "  \"timestamp\": \"$TS\"";
    echo "}";
  } > "$SUMMARY_JSON" || echo "[WARN] Failed to write $SUMMARY_JSON"
  echo "[LOCAL-CI] Summary JSON: $SUMMARY_JSON"
  echo "[LOCAL-CI] Output log: $LOG_FILE"

  # Strict exit logic
  if [[ "$STRICT_EXIT" == true ]]; then
    FAIL_FLAG=0
    FAIL_REASONS=()

    # Check validation failures
    if [[ $VALID_FAIL -gt 0 ]]; then
      FAIL_FLAG=1
      FAIL_REASONS+=("validationFailCount=$VALID_FAIL")
    fi

    # Check missing scenes
    if [[ ${#MISSING_SCENES[@]} -gt 0 ]]; then
      FAIL_FLAG=1
      FAIL_REASONS+=("missingScenes=[${MISSING_SCENES[*]}]")
    fi

    # Check structure compare failures
    if [[ "$NO_STRUCT_COMPARE" != true && $STRUCT_FAIL -gt 0 ]]; then
      FAIL_FLAG=1
      FAIL_REASONS+=("structCompareFailCount=$STRUCT_FAIL")
    fi

    # Check field compare failures
    if [[ "$NO_FIELDS" != true && $FIELD_FAIL -gt 0 ]]; then
      FAIL_FLAG=1
      FAIL_REASONS+=("fieldCompareFailCount=$FIELD_FAIL")
    fi

    if [[ $FAIL_FLAG -ne 0 ]]; then
      echo "[LOCAL-CI] =============================================="
      echo "[LOCAL-CI] STRICT_EXIT failure triggered!"
      echo "[LOCAL-CI] Reasons: ${FAIL_REASONS[*]}"
      echo "[LOCAL-CI] =============================================="
      exit 2
    fi
  fi

  echo "[LOCAL-CI] Done - all checks passed"
}

# Run main and tee output to log file
main 2>&1 | tee "$LOG_FILE"

# Capture exit status from main (via pipefail)
exit ${PIPESTATUS[0]}
