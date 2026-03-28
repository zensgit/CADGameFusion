#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUILD_DIR="build"
MODE="observe"   # observe|gate
REQUIRE_ON="0"   # when 1, missing Qt-enabled target in gate mode fails
OUT="build/qt_project_persistence_check.json"
FALLBACK_DIRS="build_vcpkg,build_editor_verify,build_qt"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --build-dir)
      BUILD_DIR="$2"; shift 2 ;;
    --mode)
      MODE="$2"; shift 2 ;;
    --require-on)
      REQUIRE_ON="$2"; shift 2 ;;
    --out)
      OUT="$2"; shift 2 ;;
    --fallback-dirs)
      FALLBACK_DIRS="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--build-dir <dir>] [--mode observe|gate] [--require-on 0|1] [--out <json>] [--fallback-dirs <csv>]"
      exit 0 ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2 ;;
  esac
done

if [[ "$MODE" != "observe" && "$MODE" != "gate" ]]; then
  echo "[QT-CHECK] invalid mode=$MODE (expected observe|gate)" >&2
  exit 2
fi
if [[ "$REQUIRE_ON" != "0" && "$REQUIRE_ON" != "1" ]]; then
  echo "[QT-CHECK] invalid require-on=$REQUIRE_ON (expected 0|1)" >&2
  exit 2
fi

json_escape() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

cache_bool() {
  local dir="$1"
  local cache="$dir/CMakeCache.txt"
  if [[ ! -f "$cache" ]]; then
    echo "MISSING"
    return 0
  fi
  local line
  line="$(rg -n '^BUILD_EDITOR_QT:BOOL=' "$cache" | head -n 1 | cut -d: -f2- || true)"
  if [[ -z "$line" ]]; then
    echo "UNKNOWN"
    return 0
  fi
  echo "${line#BUILD_EDITOR_QT:BOOL=}"
}

has_target() {
  local dir="$1"
  local target="$2"
  if [[ ! -f "$dir/build.ninja" ]]; then
    return 1
  fi
  ninja -C "$dir" -t targets all 2>/dev/null | rg -q "^${target}:"
}

ensure_parent_dir() {
  local out_path="$1"
  local out_dir
  out_dir="$(dirname "$out_path")"
  mkdir -p "$out_dir"
}

write_summary() {
  local status="$1"
  local reason="$2"
  local build_used="$3"
  local build_editor_qt="$4"
  local target_available="$5"
  local build_rc="${6:-0}"
  local test_rc="${7:-0}"
  local run_id
  run_id="$(date -u +%Y%m%d_%H%M%S)"
  ensure_parent_dir "$OUT"
  python3 - "$OUT" "$run_id" "$MODE" "$status" "$reason" "$build_used" "$build_editor_qt" "$target_available" "$build_rc" "$test_rc" <<'PY'
import json
import os
import sys
out_path, run_id, mode, status, reason, build_used, build_editor_qt, target_available, build_rc, test_rc = sys.argv[1:]
payload = {
  "run_id": run_id,
  "mode": mode,
  "status": status,
  "reason": reason,
  "build_dir": build_used,
  "build_editor_qt": build_editor_qt,
  "target_available": target_available == "true",
  "build_exit_code": int(build_rc),
  "test_exit_code": int(test_rc),
}
with open(out_path, "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
print(f"summary_json={os.path.abspath(out_path)}")
print(f"status={status}")
print(f"reason={reason}")
PY
}

declare -a candidates=()
candidates+=("$BUILD_DIR")
IFS=',' read -r -a extra_dirs <<<"$FALLBACK_DIRS"
for one in "${extra_dirs[@]}"; do
  one="${one// /}"
  [[ -z "$one" ]] && continue
  candidates+=("$one")
done

declare -A seen=()
selected_build=""
selected_flag=""
selected_has_target="false"
primary_flag="MISSING"

for dir in "${candidates[@]}"; do
  [[ -n "${seen[$dir]+x}" ]] && continue
  seen[$dir]=1
  if [[ ! -d "$dir" ]]; then
    continue
  fi
  flag="$(cache_bool "$dir")"
  if [[ "$dir" == "$BUILD_DIR" ]]; then
    primary_flag="$flag"
  fi
  target_ok="false"
  if has_target "$dir" "test_qt_project_roundtrip"; then
    target_ok="true"
  fi
  if [[ "$flag" == "ON" && "$target_ok" == "true" ]]; then
    selected_build="$dir"
    selected_flag="$flag"
    selected_has_target="$target_ok"
    break
  fi
done

if [[ -z "$selected_build" ]]; then
  reason="QT_TARGET_UNAVAILABLE"
  if [[ "$primary_flag" != "ON" ]]; then
    reason="BUILD_EDITOR_QT_OFF"
  fi
  write_summary "skipped" "$reason" "$BUILD_DIR" "$primary_flag" "false" 0 0
  if [[ "$MODE" == "gate" && "$REQUIRE_ON" == "1" ]]; then
    exit 2
  fi
  exit 0
fi

echo "[QT-CHECK] using build=$selected_build"
echo "[QT-CHECK] BUILD_EDITOR_QT=$selected_flag target_available=$selected_has_target"

set +e
cmake --build "$selected_build" --target test_qt_project_roundtrip test_qt_project_legacy_load
build_rc=$?
set -e
if [[ "$build_rc" -ne 0 ]]; then
  write_summary "fail" "BUILD_FAILED" "$selected_build" "$selected_flag" "$selected_has_target" "$build_rc" 0
  [[ "$MODE" == "gate" ]] && exit 2
  exit 0
fi

set +e
ctest --test-dir "$selected_build" -R "qt_project_roundtrip_run|qt_project_legacy_load_run" --output-on-failure
test_rc=$?
set -e
if [[ "$test_rc" -ne 0 ]]; then
  write_summary "fail" "TEST_FAILED" "$selected_build" "$selected_flag" "$selected_has_target" 0 "$test_rc"
  [[ "$MODE" == "gate" ]] && exit 2
  exit 0
fi

write_summary "pass" "" "$selected_build" "$selected_flag" "$selected_has_target" 0 0
exit 0
