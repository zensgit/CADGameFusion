#!/usr/bin/env bash
set -euo pipefail

# Validate weekly summary contract emitted by tools/editor_weekly_validation.sh.
#
# Usage:
#   bash tools/check_weekly_summary.sh [--summary <path>] [--dashboard <path>] [--require-dashboard]

SUMMARY_JSON="build/editor_weekly_validation_summary.json"
DASHBOARD_MD=""
REQUIRE_DASHBOARD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --summary)
      SUMMARY_JSON="${2:-}"
      if [[ -z "$SUMMARY_JSON" ]]; then
        echo "Missing value for --summary" >&2
        exit 2
      fi
      shift 2
      ;;
    --dashboard)
      DASHBOARD_MD="${2:-}"
      if [[ -z "$DASHBOARD_MD" ]]; then
        echo "Missing value for --dashboard" >&2
        exit 2
      fi
      shift 2
      ;;
    --require-dashboard)
      REQUIRE_DASHBOARD=true
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

[[ -f "$SUMMARY_JSON" ]] || {
  echo "[weekly-summary] Missing summary json: $SUMMARY_JSON" >&2
  exit 2
}

python3 - "$SUMMARY_JSON" "$DASHBOARD_MD" "$REQUIRE_DASHBOARD" <<'PY'
import base64
import json
import os
import sys
from pathlib import Path


def as_dict(value):
    return value if isinstance(value, dict) else {}


def as_float(value):
    try:
        return float(value)
    except Exception:
        return None


def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def decode_b64_json_list(value):
    text = str(value or "").strip()
    if not text:
        return []
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def decode_b64_json_dict(value):
    text = str(value or "").strip()
    if not text:
        return {}
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def fmt_proxy_kind_counts(value):
    counts = decode_b64_json_dict(value)
    pairs = []
    for key, raw_value in counts.items():
        try:
            numeric = int(raw_value)
        except Exception:
            continue
        if numeric > 0:
            pairs.append((str(key), numeric))
    pairs.sort(key=lambda item: (-item[1], item[0]))
    if not pairs:
        return "-"
    return ", ".join(f"{key}:{numeric}" for key, numeric in pairs)


def fmt_proxy_layout_kind_counts(value):
    layouts = decode_b64_json_dict(value)
    if not layouts:
        return "-"
    parts = []
    for layout, raw_inner in sorted(layouts.items(), key=lambda item: str(item[0])):
        pairs = []
        for key, raw_value in as_dict(raw_inner).items():
            try:
                numeric = int(raw_value)
            except Exception:
                continue
            if numeric > 0:
                pairs.append((str(key), numeric))
        pairs.sort(key=lambda item: (-item[1], item[0]))
        if not pairs:
            continue
        parts.append(f"{layout}[{', '.join(f'{key}:{numeric}' for key, numeric in pairs)}]")
    return "; ".join(parts) if parts else "-"


def fmt_text_kind_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(f"{lane}:{case_name}({fmt_proxy_kind_counts(encode_b64_json_dict(as_dict(item.get('text_kind_counts'))))})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)

def fmt_proxy_kind_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(f"{lane}:{case_name}({fmt_proxy_kind_counts(encode_b64_json_dict(as_dict(item.get('derived_proxy_kind_counts'))))})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_layout_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(
            f"{lane}:{case_name}({fmt_proxy_layout_kind_counts(encode_b64_json_dict(as_dict(item.get('derived_proxy_layout_kind_counts'))))})"
        )
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_viewport_proxy_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(
            f"{lane}:{case_name}({fmt_proxy_layout_kind_counts(encode_b64_json_dict(as_dict(item.get('derived_proxy_layout_kind_counts'))))})"
        )
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_source_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(
            f"{lane}:{case_name}({fmt_proxy_kind_counts(encode_b64_json_dict(as_dict(item.get('assembly_group_source_counts'))))})"
        )
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_layout_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(
            f"{lane}:{case_name}({fmt_proxy_layout_kind_counts(encode_b64_json_dict(as_dict(item.get('assembly_group_layout_source_counts'))))})"
        )
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_exploded_layout_case_details(value):
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts = []
    for item in details[:4]:
        lane = str(item.get("lane") or "lane")
        case_name = str(item.get("case_name") or "case")
        parts.append(
            f"{lane}:{case_name}({fmt_proxy_layout_kind_counts(encode_b64_json_dict(as_dict(item.get('exploded_origin_layout_source_counts'))))})"
        )
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def encode_b64_json_dict(value):
    try:
        return base64.b64encode(json.dumps(as_dict(value), sort_keys=True).encode("utf-8")).decode("ascii")
    except Exception:
        return ""


def resolve_summary_relative(raw):
    path = Path(str(raw or "").strip())
    if path.is_absolute():
        return path.resolve()
    cwd_candidate = (Path.cwd() / path).resolve()
    if cwd_candidate.exists():
        return cwd_candidate
    return (summary_root / path).resolve()


summary_path = Path(sys.argv[1]).resolve()
summary_root = summary_path.parent.parent if summary_path.parent.name == "build" else summary_path.parent
dashboard_path_text = str(sys.argv[2] or "").strip()
require_dashboard = str(sys.argv[3] or "").strip().lower() in {"1", "true", "yes", "on"}

try:
    payload = json.loads(summary_path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"[weekly-summary] Malformed json: {summary_path} ({exc})", file=sys.stderr)
    raise SystemExit(2)

if not isinstance(payload, dict):
    print(f"[weekly-summary] Root payload is not an object: {summary_path}", file=sys.stderr)
    raise SystemExit(2)

errors: list[str] = []
ui_stage = as_dict(payload.get("ui_flow_stage_trend"))
if not ui_stage:
    errors.append("missing ui_flow_stage_trend object")

status = str(ui_stage.get("status") or "").strip()
mode = str(ui_stage.get("recommended_gate_mode") or "").strip()
days = as_int(ui_stage.get("days"), 0)
enabled_samples = as_int(ui_stage.get("enabled_samples_in_window"), 0)
fail_ratio = as_float(ui_stage.get("fail_ratio"))
attr_ratio = as_float(ui_stage.get("attribution_ratio"))
summary_json = str(ui_stage.get("summary_json") or "").strip()
summary_md = str(ui_stage.get("summary_md") or "").strip()
stage_counts = ui_stage.get("failure_stage_counts")
first_stage_counts = ui_stage.get("first_failure_stage_counts")
setup_nonzero = ui_stage.get("setup_exit_nonzero_runs")

if days <= 0:
    errors.append(f"ui_flow_stage_trend.days invalid: {days}")
if not status:
    errors.append("ui_flow_stage_trend.status missing")
if mode not in {"observe", "gate"}:
    errors.append(f"ui_flow_stage_trend.recommended_gate_mode invalid: {mode or '<empty>'}")
if not summary_json:
    errors.append("ui_flow_stage_trend.summary_json missing")
if not summary_md:
    errors.append("ui_flow_stage_trend.summary_md missing")
if not isinstance(stage_counts, dict):
    errors.append("ui_flow_stage_trend.failure_stage_counts is not object")
if not isinstance(first_stage_counts, dict):
    errors.append("ui_flow_stage_trend.first_failure_stage_counts is not object")
if not isinstance(setup_nonzero, dict):
    errors.append("ui_flow_stage_trend.setup_exit_nonzero_runs is not object")
if enabled_samples > 0:
    if fail_ratio is None:
        errors.append("ui_flow_stage_trend.fail_ratio missing while enabled_samples_in_window > 0")
    if attr_ratio is None:
        errors.append("ui_flow_stage_trend.attribution_ratio missing while enabled_samples_in_window > 0")

if summary_json:
    trend_json_path = resolve_summary_relative(summary_json)
    if not trend_json_path.exists():
        errors.append(f"ui_flow_stage_trend.summary_json missing file: {summary_json}")
if summary_md:
    trend_md_path = resolve_summary_relative(summary_md)
    if not trend_md_path.exists():
        errors.append(f"ui_flow_stage_trend.summary_md missing file: {summary_md}")

dashboard_status = "skipped"
if dashboard_path_text:
    dashboard_path = resolve_summary_relative(dashboard_path_text)
    if dashboard_path.exists():
        dashboard_text = dashboard_path.read_text(encoding="utf-8")
        dashboard_status = "checked"
        if "weekly_ui_flow_stage_trend:" not in dashboard_text:
            errors.append("dashboard missing weekly_ui_flow_stage_trend line")
        else:
            if f"status={status}" not in dashboard_text:
                errors.append("dashboard weekly_ui_flow_stage_trend status mismatch")
            if f"recommended_gate_mode={mode}" not in dashboard_text:
                errors.append("dashboard weekly_ui_flow_stage_trend recommended_gate_mode mismatch")
        gate_preview_provenance = as_dict(payload.get("gate_preview_provenance_smoke"))
        if bool(gate_preview_provenance.get("enabled", False)):
            if "weekly_gate_preview_provenance_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_preview_provenance_smoke line")
            elif f"cases={as_int(gate_preview_provenance.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_preview_provenance_smoke case_count mismatch")
            else:
                entry_count = as_int(
                    gate_preview_provenance.get("deterministic_entry_case_count")
                    if gate_preview_provenance.get("deterministic_entry_case_count") is not None
                    else gate_preview_provenance.get("initial_entry_case_count"),
                    0,
                )
                if f"entry={entry_count}/{as_int(gate_preview_provenance.get('case_count'), 0)}" not in dashboard_text:
                    errors.append("dashboard weekly_gate_preview_provenance_smoke entry_count mismatch")
                if f"focus_checks={as_int(gate_preview_provenance.get('focus_check_case_count'), 0)}" not in dashboard_text:
                    errors.append("dashboard weekly_gate_preview_provenance_smoke focus_check_count mismatch")
        gate_dwg_open = as_dict(payload.get("gate_dwg_open_smoke"))
        if bool(gate_dwg_open.get("enabled", False)):
            if "weekly_gate_dwg_open_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_dwg_open_smoke line")
            elif f"validators_ok={as_int(gate_dwg_open.get('validator_ok_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_dwg_open_smoke validator_ok_count mismatch")
        gate_dwg_open_matrix = as_dict(payload.get("gate_dwg_open_matrix_smoke"))
        if bool(gate_dwg_open_matrix.get("enabled", False)):
            if "weekly_gate_dwg_open_matrix_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_dwg_open_matrix_smoke line")
            elif f"cases={as_int(gate_dwg_open_matrix.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_dwg_open_matrix_smoke case_count mismatch")
            elif f"validators_ok={as_int(gate_dwg_open_matrix.get('validator_ok_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_dwg_open_matrix_smoke validator_ok_count mismatch")
        gate_dwg_open_desktop = as_dict(payload.get("gate_dwg_open_desktop_smoke"))
        if bool(gate_dwg_open_desktop.get("enabled", False)):
            if "weekly_gate_dwg_open_desktop_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_dwg_open_desktop_smoke line")
            elif f"preview_artifacts={bool(gate_dwg_open_desktop.get('preview_artifacts_ok', False))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_dwg_open_desktop_smoke preview_artifacts mismatch")
            elif f"validators_ok={as_int(gate_dwg_open_desktop.get('validator_ok_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_dwg_open_desktop_smoke validator_ok_count mismatch")
        gate_constraints_basic_ctest = as_dict(payload.get("gate_constraints_basic_ctest"))
        if bool(gate_constraints_basic_ctest.get("enabled", False)):
            if "weekly_gate_constraints_basic_ctest:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_constraints_basic_ctest line")
            elif f"cases={as_int(gate_constraints_basic_ctest.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_constraints_basic_ctest case_count mismatch")
            elif f"missing={as_int(gate_constraints_basic_ctest.get('missing_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_constraints_basic_ctest missing_count mismatch")
        gate_solver_action_panel = as_dict(payload.get("gate_solver_action_panel_smoke"))
        if bool(gate_solver_action_panel.get("enabled", False)):
            if "weekly_gate_solver_action_panel_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_solver_action_panel_smoke line")
            elif f"panels={as_int(gate_solver_action_panel.get('panel_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke panel_count mismatch")
            elif f"flow_checks={as_int(gate_solver_action_panel.get('flow_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke flow_check_count mismatch")
            elif f"requests={as_int(gate_solver_action_panel.get('request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke request_count mismatch")
            elif f"invoke={as_int(gate_solver_action_panel.get('invoke_request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke invoke_request_count mismatch")
            elif f"focus={as_int(gate_solver_action_panel.get('focus_request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke focus_request_count mismatch")
            elif f"flow={as_int(gate_solver_action_panel.get('flow_request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke flow_request_count mismatch")
            elif f"replay={as_int(gate_solver_action_panel.get('replay_request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke replay_request_count mismatch")
            elif f"import_checks={as_int(gate_solver_action_panel.get('import_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke import_check_count mismatch")
            elif f"clear_checks={as_int(gate_solver_action_panel.get('clear_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke clear_check_count mismatch")
            elif f"jump_requests={as_int(gate_solver_action_panel.get('jump_request_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke jump_request_count mismatch")
            elif f"dom_events={as_int(gate_solver_action_panel.get('dom_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_event_count mismatch")
            elif f"dom_requests={as_int(gate_solver_action_panel.get('dom_request_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_request_event_count mismatch")
            elif f"dom_actions={as_int(gate_solver_action_panel.get('dom_action_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_action_event_count mismatch")
            elif f"dom_focus={as_int(gate_solver_action_panel.get('dom_focus_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_focus_event_count mismatch")
            elif f"dom_flow={as_int(gate_solver_action_panel.get('dom_flow_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_flow_event_count mismatch")
            elif f"dom_replay={as_int(gate_solver_action_panel.get('dom_replay_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke dom_replay_event_count mismatch")
            elif f"events={as_int(gate_solver_action_panel.get('event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke event_count mismatch")
            elif f"event_invoke={as_int(gate_solver_action_panel.get('invoke_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke invoke_event_count mismatch")
            elif f"event_focus={as_int(gate_solver_action_panel.get('focus_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke focus_event_count mismatch")
            elif f"event_flow={as_int(gate_solver_action_panel.get('flow_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke flow_event_count mismatch")
            elif f"event_replay={as_int(gate_solver_action_panel.get('replay_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke replay_event_count mismatch")
            elif f"next={as_int(gate_solver_action_panel.get('next_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke next_check_count mismatch")
            elif f"jump={as_int(gate_solver_action_panel.get('jump_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke jump_check_count mismatch")
            elif f"prev={as_int(gate_solver_action_panel.get('rewind_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke rewind_check_count mismatch")
            elif f"restart={as_int(gate_solver_action_panel.get('restart_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke restart_check_count mismatch")
            elif f"replay_checks={as_int(gate_solver_action_panel.get('replay_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke replay_check_count mismatch")
            elif f"event_focus_checks={as_int(gate_solver_action_panel.get('event_focus_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke event_focus_check_count mismatch")
            elif f"banner_checks={as_int(gate_solver_action_panel.get('banner_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke banner_check_count mismatch")
            elif f"banner_focus_clicks={as_int(gate_solver_action_panel.get('banner_focus_click_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke banner_focus_click_check_count mismatch")
            elif f"console={as_int(gate_solver_action_panel.get('console_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_check_count mismatch")
            elif f"console_flow={as_int(gate_solver_action_panel.get('console_flow_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_flow_check_count mismatch")
            elif f"console_event_focus={as_int(gate_solver_action_panel.get('console_event_focus_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_event_focus_check_count mismatch")
            elif f"console_replay={as_int(gate_solver_action_panel.get('console_replay_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_replay_check_count mismatch")
            elif f"console_event_click={as_int(gate_solver_action_panel.get('console_event_click_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_event_click_check_count mismatch")
            elif f"console_focus_click={as_int(gate_solver_action_panel.get('console_focus_click_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_focus_click_check_count mismatch")
            elif f"console_selection={as_int(gate_solver_action_panel.get('console_selection_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke console_selection_check_count mismatch")
            elif f"status_checks={as_int(gate_solver_action_panel.get('status_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke status_check_count mismatch")
            elif f"status_clicks={as_int(gate_solver_action_panel.get('status_click_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke status_click_check_count mismatch")
            elif f"keyboard={as_int(gate_solver_action_panel.get('keyboard_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke keyboard_check_count mismatch")
            elif f"panel_cycle={as_int(gate_solver_action_panel.get('panel_cycle_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke panel_cycle_check_count mismatch")
            elif f"panel_keyboard={as_int(gate_solver_action_panel.get('panel_keyboard_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke panel_keyboard_check_count mismatch")
            elif f"panel_keyboard_invoke={as_int(gate_solver_action_panel.get('panel_keyboard_invoke_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke panel_keyboard_invoke_check_count mismatch")
            elif f"panel_keyboard_flow={as_int(gate_solver_action_panel.get('panel_keyboard_flow_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke panel_keyboard_flow_check_count mismatch")
            elif f"keyboard_banner={as_int(gate_solver_action_panel.get('keyboard_banner_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke keyboard_banner_check_count mismatch")
            elif f"keyboard_jump={as_int(gate_solver_action_panel.get('keyboard_jump_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke keyboard_jump_check_count mismatch")
            elif f"keyboard_event_focus={as_int(gate_solver_action_panel.get('keyboard_event_focus_check_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke keyboard_event_focus_check_count mismatch")
            elif f"jump_events={as_int(gate_solver_action_panel.get('jump_event_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke jump_event_count mismatch")
            elif f"visited_panels={as_int(gate_solver_action_panel.get('visited_panel_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_solver_action_panel_smoke visited_panel_count mismatch")
        step186_preview_artifact_prep = as_dict(payload.get("step186_preview_artifact_prep"))
        if bool(step186_preview_artifact_prep.get("enabled", False)):
            if "weekly_step186_preview_artifact_prep:" not in dashboard_text:
                errors.append("dashboard missing weekly_step186_preview_artifact_prep line")
            elif f"cases={as_int(step186_preview_artifact_prep.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_step186_preview_artifact_prep case_count mismatch")
        gate_preview_artifact = as_dict(payload.get("gate_preview_artifact_smoke"))
        if bool(gate_preview_artifact.get("enabled", False)):
            if "weekly_gate_preview_artifact_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_preview_artifact_smoke line")
            elif f"cases={as_int(gate_preview_artifact.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_preview_artifact_smoke case_count mismatch")
        gate_assembly_roundtrip = as_dict(payload.get("gate_assembly_roundtrip_ctest"))
        if bool(gate_assembly_roundtrip.get("enabled", False)):
            if "weekly_gate_assembly_roundtrip_ctest:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_assembly_roundtrip_ctest line")
            elif f"cases={as_int(gate_assembly_roundtrip.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest case_count mismatch")
            elif f"missing={as_int(gate_assembly_roundtrip.get('missing_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest missing_count mismatch")
            elif f"tracked={as_int(gate_assembly_roundtrip.get('import_assembly_tracked_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest tracked_count mismatch")
            elif f"groups={as_int(gate_assembly_roundtrip.get('import_assembly_group_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_count mismatch")
            elif f"group_sources={fmt_proxy_kind_counts(gate_assembly_roundtrip.get('import_assembly_group_source_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_source_counts mismatch")
            elif f"group_source_cases={as_int(gate_assembly_roundtrip.get('import_assembly_group_source_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_source_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_assembly_group_source_case_count"), 0) > 0 and f"group_source_case_details={fmt_group_source_case_details(gate_assembly_roundtrip.get('import_assembly_group_source_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_source_case_details mismatch")
            elif f"group_layouts={fmt_proxy_layout_kind_counts(gate_assembly_roundtrip.get('import_assembly_group_layout_source_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_layout_source_counts mismatch")
            elif f"group_layout_cases={as_int(gate_assembly_roundtrip.get('import_assembly_group_layout_source_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_layout_source_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_assembly_group_layout_source_case_count"), 0) > 0 and f"group_layout_case_details={fmt_group_layout_case_details(gate_assembly_roundtrip.get('import_assembly_group_layout_source_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest group_layout_source_case_details mismatch")
            elif f"proxies={as_int(gate_assembly_roundtrip.get('import_derived_proxy_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_count mismatch")
            elif f"proxy_kinds={fmt_proxy_kind_counts(gate_assembly_roundtrip.get('import_proxy_kind_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_kind_counts mismatch")
            elif f"proxy_kind_cases={as_int(gate_assembly_roundtrip.get('import_proxy_kind_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_kind_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_proxy_kind_case_count"), 0) > 0 and f"proxy_kind_case_details={fmt_proxy_kind_case_details(gate_assembly_roundtrip.get('import_proxy_kind_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_kind_case_details mismatch")
            elif f"proxy_layouts={fmt_proxy_layout_kind_counts(gate_assembly_roundtrip.get('import_proxy_layout_kind_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_layout_kind_counts mismatch")
            elif f"proxy_layout_cases={as_int(gate_assembly_roundtrip.get('import_proxy_layout_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_layout_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_proxy_layout_case_count"), 0) > 0 and f"proxy_layout_case_details={fmt_proxy_layout_case_details(gate_assembly_roundtrip.get('import_proxy_layout_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest proxy_layout_case_details mismatch")
            elif f"text_kinds={fmt_proxy_kind_counts(gate_assembly_roundtrip.get('import_text_kind_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest text_kind_counts mismatch")
            elif f"text_kind_layouts={fmt_proxy_layout_kind_counts(gate_assembly_roundtrip.get('import_text_kind_layout_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest text_kind_layout_counts mismatch")
            elif f"text_kind_cases={as_int(gate_assembly_roundtrip.get('import_text_kind_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest text_kind_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_text_kind_case_count"), 0) > 0 and f"text_kind_case_details={fmt_text_kind_case_details(gate_assembly_roundtrip.get('import_text_kind_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest text_kind_case_details mismatch")
            elif f"exploded={as_int(gate_assembly_roundtrip.get('import_exploded_origin_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest exploded_count mismatch")
            elif f"exploded_layouts={fmt_proxy_layout_kind_counts(gate_assembly_roundtrip.get('import_exploded_layout_source_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest exploded_layout_source_counts mismatch")
            elif f"exploded_layout_cases={as_int(gate_assembly_roundtrip.get('import_exploded_layout_source_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest exploded_layout_source_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_exploded_layout_source_case_count"), 0) > 0 and f"exploded_layout_case_details={fmt_exploded_layout_case_details(gate_assembly_roundtrip.get('import_exploded_layout_source_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest exploded_layout_source_case_details mismatch")
            elif f"viewports={as_int(gate_assembly_roundtrip.get('import_viewport_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_count mismatch")
            elif f"viewport_layouts={as_int(gate_assembly_roundtrip.get('import_viewport_layout_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_layout_count mismatch")
            elif f"viewport_cases={as_int(gate_assembly_roundtrip.get('import_viewport_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_viewport_case_count"), 0) > 0 and "viewport_detail_cases=" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest missing viewport_detail_cases")
            elif f"viewport_proxy_kinds={fmt_proxy_kind_counts(gate_assembly_roundtrip.get('import_viewport_proxy_kind_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_proxy_kind_counts mismatch")
            elif f"viewport_proxy_layouts={fmt_proxy_layout_kind_counts(gate_assembly_roundtrip.get('import_viewport_proxy_layout_kind_counts_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_proxy_layout_kind_counts mismatch")
            elif f"viewport_proxy_cases={as_int(gate_assembly_roundtrip.get('import_viewport_proxy_case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_proxy_case_count mismatch")
            elif as_int(gate_assembly_roundtrip.get("import_viewport_proxy_case_count"), 0) > 0 and f"viewport_proxy_case_details={fmt_viewport_proxy_case_details(gate_assembly_roundtrip.get('import_viewport_proxy_case_details_b64'))}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest viewport_proxy_case_details mismatch")
            elif f"checked={as_int(gate_assembly_roundtrip.get('export_assembly_checked_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest checked_count mismatch")
            elif f"dense={str(gate_assembly_roundtrip.get('dense_status') or '-')}" not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest dense_status mismatch")
            elif "drift={metadata}/{group}".format(
                metadata=as_int(gate_assembly_roundtrip.get("export_metadata_drift_count"), 0),
                group=as_int(gate_assembly_roundtrip.get("export_group_drift_count"), 0),
            ) not in dashboard_text:
                errors.append("dashboard weekly_gate_assembly_roundtrip_ctest drift_count mismatch")
        gate_preview_artifact_injection = as_dict(payload.get("gate_preview_artifact_validator_failure_injection"))
        if bool(gate_preview_artifact_injection.get("enabled", False)):
            if "weekly_gate_preview_artifact_validator_failure_injection:" not in dashboard_text:
                errors.append("dashboard missing weekly_gate_preview_artifact_validator_failure_injection line")
            elif f"cases={as_int(gate_preview_artifact_injection.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_gate_preview_artifact_validator_failure_injection case_count mismatch")
        weekly_legacy_preview_prep = as_dict(payload.get("weekly_legacy_preview_artifact_prep"))
        if bool(weekly_legacy_preview_prep.get("enabled", False)):
            if "weekly_legacy_preview_artifact_prep:" not in dashboard_text:
                errors.append("dashboard missing weekly_legacy_preview_artifact_prep line")
            elif f"cases={as_int(weekly_legacy_preview_prep.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_legacy_preview_artifact_prep case_count mismatch")
        weekly_legacy_preview = as_dict(payload.get("weekly_legacy_preview_artifact_smoke"))
        if bool(weekly_legacy_preview.get("enabled", False)):
            if "weekly_legacy_preview_artifact_smoke:" not in dashboard_text:
                errors.append("dashboard missing weekly_legacy_preview_artifact_smoke line")
            elif f"cases={as_int(weekly_legacy_preview.get('case_count'), 0)}" not in dashboard_text:
                errors.append("dashboard weekly_legacy_preview_artifact_smoke case_count mismatch")
    elif require_dashboard:
        errors.append(f"dashboard missing file: {dashboard_path_text}")
    else:
        dashboard_status = "missing_ignored"
elif require_dashboard:
    errors.append("require-dashboard set but dashboard path is empty")

case_selection = as_dict(payload.get("case_selection_trend"))
if case_selection:
    if not str(case_selection.get("windows") or "").strip():
        errors.append("case_selection_trend.windows missing")
    if not str(case_selection.get("status") or "").strip():
        errors.append("case_selection_trend.status missing")


def validate_preview_lane(name, payload, require_status=True, ok_field=False, allow_missing_summary_for_status=None):
    lane = as_dict(payload)
    if not lane:
        return
    enabled = bool(lane.get("enabled", False))
    if not enabled:
        return
    status = str(lane.get("status") or "").strip()
    if ok_field:
        ok = lane.get("ok")
        if not isinstance(ok, bool):
            errors.append(f"{name}.ok missing/bad")
    elif require_status and not status:
        errors.append(f"{name}.status missing")
    case_count = as_int(lane.get("case_count"), -1)
    pass_count = as_int(lane.get("pass_count"), -1)
    fail_count = as_int(lane.get("fail_count"), -1)
    if case_count < 0:
        errors.append(f"{name}.case_count invalid")
    if pass_count < 0:
        errors.append(f"{name}.pass_count invalid")
    if fail_count < 0:
        errors.append(f"{name}.fail_count invalid")
    if case_count >= 0 and pass_count >= 0 and fail_count >= 0 and pass_count + fail_count > case_count:
        errors.append(f"{name}.pass_count+fail_count exceeds case_count")
    initial_entry_case_count = lane.get("initial_entry_case_count")
    if initial_entry_case_count is not None:
        initial_entry_case_count = as_int(initial_entry_case_count, -1)
        if initial_entry_case_count < 0:
            errors.append(f"{name}.initial_entry_case_count invalid")
        elif case_count >= 0 and initial_entry_case_count > case_count:
            errors.append(f"{name}.initial_entry_case_count exceeds case_count")
    deterministic_entry_case_count = lane.get("deterministic_entry_case_count")
    if deterministic_entry_case_count is not None:
        deterministic_entry_case_count = as_int(deterministic_entry_case_count, -1)
        if deterministic_entry_case_count < 0:
            errors.append(f"{name}.deterministic_entry_case_count invalid")
        elif case_count >= 0 and deterministic_entry_case_count > case_count:
            errors.append(f"{name}.deterministic_entry_case_count exceeds case_count")
    focus_check_case_count = lane.get("focus_check_case_count")
    if focus_check_case_count is not None:
        focus_check_case_count = as_int(focus_check_case_count, -1)
        if focus_check_case_count < 0:
            errors.append(f"{name}.focus_check_case_count invalid")
        elif case_count >= 0 and focus_check_case_count > case_count:
            errors.append(f"{name}.focus_check_case_count exceeds case_count")
    summary_json = str(lane.get("summary_json") or "").strip()
    allowed = set(allow_missing_summary_for_status or [])
    effective_status = status.lower()
    if not summary_json and effective_status not in allowed:
        errors.append(f"{name}.summary_json missing")
    if summary_json:
        lane_path = resolve_summary_relative(summary_json)
        if not lane_path.exists():
            errors.append(f"{name}.summary_json missing file: {summary_json}")


def validate_ctest_lane(name, payload):
    lane = as_dict(payload)
    if not lane:
        errors.append(f"{name} missing")
        return
    if not bool(lane.get("enabled", False)):
        return
    if not str(lane.get("status") or "").strip():
        errors.append(f"{name}.status missing")
    case_count = as_int(lane.get("case_count"), -1)
    pass_count = as_int(lane.get("pass_count"), -1)
    fail_count = as_int(lane.get("fail_count"), -1)
    missing_count = as_int(lane.get("missing_count"), -1)
    if min(case_count, pass_count, fail_count, missing_count) < 0:
        errors.append(f"{name}.counts invalid")
    elif pass_count + fail_count + missing_count != case_count:
        errors.append(f"{name}.counts mismatch")
    for key in ("model_status", "paperspace_status", "mixed_status"):
        if not str(lane.get(key) or "").strip():
            errors.append(f"{name}.{key} missing")
    summary_json_count = lane.get("summary_json_count")
    if summary_json_count is not None:
        summary_json_count = as_int(summary_json_count, -1)
        if summary_json_count < 0:
            errors.append(f"{name}.summary_json_count invalid")
        elif case_count >= 0 and summary_json_count > case_count:
            errors.append(f"{name}.summary_json_count exceeds case_count")
        elif str(lane.get("status") or "").strip().upper() == "PASS" and missing_count == 0 and summary_json_count != case_count:
            errors.append(f"{name}.summary_json_count mismatch for PASS lane")
    metric_keys = (
        "import_entity_count",
        "import_unsupported_count",
        "import_derived_proxy_count",
        "import_exploded_origin_count",
        "import_assembly_tracked_count",
        "import_assembly_group_count",
        "import_viewport_count",
        "import_viewport_layout_count",
        "import_viewport_case_count",
        "export_derived_proxy_checked_count",
        "export_exploded_checked_count",
        "export_assembly_checked_count",
        "export_assembly_group_count",
        "export_metadata_drift_count",
        "export_group_drift_count",
    )
    metric_values = {}
    for key in metric_keys:
        raw = lane.get(key)
        if raw is None:
            continue
        value = as_int(raw, -1)
        metric_values[key] = value
        if value < 0:
            errors.append(f"{name}.{key} invalid")
    if metric_values:
        if metric_values.get("import_derived_proxy_count", 0) > metric_values.get("import_entity_count", 0):
            errors.append(f"{name}.import_derived_proxy_count exceeds import_entity_count")
        if metric_values.get("import_exploded_origin_count", 0) > metric_values.get("import_entity_count", 0):
            errors.append(f"{name}.import_exploded_origin_count exceeds import_entity_count")
        if metric_values.get("import_assembly_tracked_count", 0) > metric_values.get("import_entity_count", 0):
            errors.append(f"{name}.import_assembly_tracked_count exceeds import_entity_count")
        if metric_values.get("import_assembly_group_count", 0) > metric_values.get("import_assembly_tracked_count", 0):
            errors.append(f"{name}.import_assembly_group_count exceeds import_assembly_tracked_count")
        if metric_values.get("export_derived_proxy_checked_count", 0) > metric_values.get("import_derived_proxy_count", 0):
            errors.append(f"{name}.export_derived_proxy_checked_count exceeds import_derived_proxy_count")
        if metric_values.get("export_exploded_checked_count", 0) > metric_values.get("import_exploded_origin_count", 0):
            errors.append(f"{name}.export_exploded_checked_count exceeds import_exploded_origin_count")
        if metric_values.get("export_assembly_checked_count", 0) > metric_values.get("import_assembly_tracked_count", 0):
            errors.append(f"{name}.export_assembly_checked_count exceeds import_assembly_tracked_count")
        if metric_values.get("export_assembly_group_count", 0) > metric_values.get("import_assembly_group_count", 0):
            errors.append(f"{name}.export_assembly_group_count exceeds import_assembly_group_count")
        if metric_values.get("export_metadata_drift_count", 0) > metric_values.get("export_assembly_checked_count", 0):
            errors.append(f"{name}.export_metadata_drift_count exceeds export_assembly_checked_count")
        if metric_values.get("export_group_drift_count", 0) > metric_values.get("export_assembly_group_count", 0):
            errors.append(f"{name}.export_group_drift_count exceeds export_assembly_group_count")
    viewport_case_details = decode_b64_json_list(lane.get("import_viewport_case_details_b64"))
    if viewport_case_details:
        if len(viewport_case_details) != as_int(lane.get("import_viewport_case_count"), 0):
            errors.append(f"{name}.import_viewport_case_details_b64 count mismatch")
        if sum(as_int(item.get("viewport_count"), 0) for item in viewport_case_details) != as_int(lane.get("import_viewport_count"), 0):
            errors.append(f"{name}.import_viewport_case_details_b64 viewport_count mismatch")
        if sum(as_int(item.get("viewport_layout_count"), 0) for item in viewport_case_details) != as_int(lane.get("import_viewport_layout_count"), 0):
            errors.append(f"{name}.import_viewport_case_details_b64 viewport_layout_count mismatch")
    viewport_proxy_kind_counts = decode_b64_json_dict(lane.get("import_viewport_proxy_kind_counts_b64"))
    if viewport_proxy_kind_counts:
        positive_sum = 0
        for key, raw_value in viewport_proxy_kind_counts.items():
            value = as_int(raw_value, -1)
            if not str(key).strip() or value < 0:
                errors.append(f"{name}.import_viewport_proxy_kind_counts_b64 invalid entry")
                continue
            positive_sum += value
        if positive_sum < 0:
            errors.append(f"{name}.import_viewport_proxy_kind_counts_b64 invalid sum")
    viewport_proxy_layout_kind_counts = decode_b64_json_dict(lane.get("import_viewport_proxy_layout_kind_counts_b64"))
    if viewport_proxy_layout_kind_counts:
        positive_sum = 0
        for layout_key, raw_inner in viewport_proxy_layout_kind_counts.items():
            if not str(layout_key).strip() or not isinstance(raw_inner, dict):
                errors.append(f"{name}.import_viewport_proxy_layout_kind_counts_b64 invalid layout entry")
                continue
            for proxy_key, raw_value in raw_inner.items():
                value = as_int(raw_value, -1)
                if not str(proxy_key).strip() or value < 0:
                    errors.append(f"{name}.import_viewport_proxy_layout_kind_counts_b64 invalid proxy entry")
                    continue
                positive_sum += value
        if positive_sum < 0:
            errors.append(f"{name}.import_viewport_proxy_layout_kind_counts_b64 invalid sum")
    viewport_proxy_case_details = decode_b64_json_list(lane.get("import_viewport_proxy_case_details_b64"))
    viewport_proxy_case_count = as_int(lane.get("import_viewport_proxy_case_count"), 0)
    if viewport_proxy_case_count != len(viewport_proxy_case_details):
        errors.append(f"{name}.import_viewport_proxy_case_details_b64 count mismatch")
    if viewport_proxy_case_details:
        detail_proxy_total = 0
        detail_layout_total = 0
        for item in viewport_proxy_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_viewport_proxy_case_details_b64 missing case_name")
            detail_proxy_total += sum(as_int(v, 0) for v in as_dict(item.get("derived_proxy_kind_counts")).values())
            for raw_inner in as_dict(item.get("derived_proxy_layout_kind_counts")).values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if viewport_proxy_kind_counts and detail_proxy_total != sum(as_int(v, 0) for v in viewport_proxy_kind_counts.values()):
            errors.append(f"{name}.import_viewport_proxy_case_details_b64 viewport_proxy_kind_count mismatch")
        if viewport_proxy_layout_kind_counts:
            expected_layout_total = 0
            for raw_inner in viewport_proxy_layout_kind_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_viewport_proxy_case_details_b64 viewport_proxy_layout_count mismatch")
    proxy_kind_counts = decode_b64_json_dict(lane.get("import_proxy_kind_counts_b64"))
    if proxy_kind_counts:
        positive_sum = 0
        for key, raw_value in proxy_kind_counts.items():
            value = as_int(raw_value, -1)
            if not str(key).strip() or value < 0:
                errors.append(f"{name}.import_proxy_kind_counts_b64 invalid entry")
                continue
            positive_sum += value
        if positive_sum != as_int(lane.get("import_derived_proxy_count"), 0):
            errors.append(f"{name}.import_proxy_kind_counts_b64 proxy_count mismatch")
    proxy_layout_kind_counts = decode_b64_json_dict(lane.get("import_proxy_layout_kind_counts_b64"))
    if proxy_layout_kind_counts:
        positive_sum = 0
        for layout_key, raw_inner in proxy_layout_kind_counts.items():
            if not str(layout_key).strip() or not isinstance(raw_inner, dict):
                errors.append(f"{name}.import_proxy_layout_kind_counts_b64 invalid layout entry")
                continue
            for proxy_key, raw_value in raw_inner.items():
                value = as_int(raw_value, -1)
                if not str(proxy_key).strip() or value < 0:
                    errors.append(f"{name}.import_proxy_layout_kind_counts_b64 invalid proxy entry")
                    continue
                positive_sum += value
        if positive_sum != as_int(lane.get("import_derived_proxy_count"), 0):
            errors.append(f"{name}.import_proxy_layout_kind_counts_b64 proxy_count mismatch")
    proxy_layout_case_details = decode_b64_json_list(lane.get("import_proxy_layout_case_details_b64"))
    if proxy_layout_case_details:
        if len(proxy_layout_case_details) != as_int(lane.get("import_proxy_layout_case_count"), 0):
            errors.append(f"{name}.import_proxy_layout_case_details_b64 count mismatch")
        detail_proxy_total = 0
        detail_layout_total = 0
        for item in proxy_layout_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_proxy_layout_case_details_b64 missing case_name")
            item_proxy_kind_counts = as_dict(item.get("derived_proxy_kind_counts"))
            item_proxy_layout_kind_counts = as_dict(item.get("derived_proxy_layout_kind_counts"))
            detail_proxy_total += sum(as_int(v, 0) for v in item_proxy_kind_counts.values())
            for raw_inner in item_proxy_layout_kind_counts.values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if proxy_kind_counts and detail_proxy_total != sum(as_int(v, 0) for v in proxy_kind_counts.values()):
            errors.append(f"{name}.import_proxy_layout_case_details_b64 proxy_kind_count mismatch")
        if proxy_layout_kind_counts:
            expected_layout_total = 0
            for raw_inner in proxy_layout_kind_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_proxy_layout_case_details_b64 proxy_layout_count mismatch")
    proxy_kind_case_details = decode_b64_json_list(lane.get("import_proxy_kind_case_details_b64"))
    if proxy_kind_case_details:
        if len(proxy_kind_case_details) != as_int(lane.get("import_proxy_kind_case_count"), 0):
            errors.append(f"{name}.import_proxy_kind_case_details_b64 count mismatch")
        detail_proxy_total = 0
        detail_layout_total = 0
        for item in proxy_kind_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_proxy_kind_case_details_b64 missing case_name")
            item_proxy_kind_counts = as_dict(item.get("derived_proxy_kind_counts"))
            item_proxy_layout_kind_counts = as_dict(item.get("derived_proxy_layout_kind_counts"))
            detail_proxy_total += sum(as_int(v, 0) for v in item_proxy_kind_counts.values())
            for raw_inner in item_proxy_layout_kind_counts.values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if proxy_kind_counts and detail_proxy_total != sum(as_int(v, 0) for v in proxy_kind_counts.values()):
            errors.append(f"{name}.import_proxy_kind_case_details_b64 proxy_kind_count mismatch")
        if proxy_layout_kind_counts:
            expected_layout_total = 0
            for raw_inner in proxy_layout_kind_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_proxy_kind_case_details_b64 proxy_layout_count mismatch")
    group_source_counts = decode_b64_json_dict(lane.get("import_assembly_group_source_counts_b64"))
    if group_source_counts:
        positive_sum = 0
        for key, raw_value in group_source_counts.items():
            value = as_int(raw_value, -1)
            if not str(key).strip() or value < 0:
                errors.append(f"{name}.import_assembly_group_source_counts_b64 invalid entry")
                continue
            positive_sum += value
        if positive_sum != as_int(lane.get("import_assembly_group_count"), 0):
            errors.append(f"{name}.import_assembly_group_source_counts_b64 group_count mismatch")
    group_layout_source_counts = decode_b64_json_dict(lane.get("import_assembly_group_layout_source_counts_b64"))
    if group_layout_source_counts:
        positive_sum = 0
        for layout_key, raw_inner in group_layout_source_counts.items():
            if not str(layout_key).strip() or not isinstance(raw_inner, dict):
                errors.append(f"{name}.import_assembly_group_layout_source_counts_b64 invalid layout entry")
                continue
            for source_key, raw_value in raw_inner.items():
                value = as_int(raw_value, -1)
                if not str(source_key).strip() or value < 0:
                    errors.append(f"{name}.import_assembly_group_layout_source_counts_b64 invalid source entry")
                    continue
                positive_sum += value
        if positive_sum != as_int(lane.get("import_assembly_group_count"), 0):
            errors.append(f"{name}.import_assembly_group_layout_source_counts_b64 group_count mismatch")
    group_source_case_details = decode_b64_json_list(lane.get("import_assembly_group_source_case_details_b64"))
    if group_source_case_details:
        if len(group_source_case_details) != as_int(lane.get("import_assembly_group_source_case_count"), 0):
            errors.append(f"{name}.import_assembly_group_source_case_details_b64 count mismatch")
        detail_group_total = 0
        detail_layout_total = 0
        for item in group_source_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_assembly_group_source_case_details_b64 missing case_name")
            item_group_source_counts = as_dict(item.get("assembly_group_source_counts"))
            item_group_layout_source_counts = as_dict(item.get("assembly_group_layout_source_counts"))
            detail_group_total += sum(as_int(v, 0) for v in item_group_source_counts.values())
            for raw_inner in item_group_layout_source_counts.values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if group_source_counts and detail_group_total != sum(as_int(v, 0) for v in group_source_counts.values()):
            errors.append(f"{name}.import_assembly_group_source_case_details_b64 group_source_count mismatch")
        if group_layout_source_counts:
            expected_layout_total = 0
            for raw_inner in group_layout_source_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_assembly_group_source_case_details_b64 group_layout_count mismatch")
    group_layout_source_case_details = decode_b64_json_list(lane.get("import_assembly_group_layout_source_case_details_b64"))
    if group_layout_source_case_details:
        if len(group_layout_source_case_details) != as_int(lane.get("import_assembly_group_layout_source_case_count"), 0):
            errors.append(f"{name}.import_assembly_group_layout_source_case_details_b64 count mismatch")
        detail_layout_total = 0
        detail_group_total = 0
        for item in group_layout_source_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_assembly_group_layout_source_case_details_b64 missing case_name")
            item_group_layout_source_counts = as_dict(item.get("assembly_group_layout_source_counts"))
            item_group_source_counts = as_dict(item.get("assembly_group_source_counts"))
            detail_group_total += sum(as_int(v, 0) for v in item_group_source_counts.values())
            for raw_inner in item_group_layout_source_counts.values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if group_layout_source_counts:
            expected_layout_total = 0
            for raw_inner in group_layout_source_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_assembly_group_layout_source_case_details_b64 group_layout_count mismatch")
        if group_source_counts and detail_group_total != sum(as_int(v, 0) for v in group_source_counts.values()):
            errors.append(f"{name}.import_assembly_group_layout_source_case_details_b64 group_source_count mismatch")
    text_kind_counts = decode_b64_json_dict(lane.get("import_text_kind_counts_b64"))
    if text_kind_counts:
        positive_sum = 0
        for key, raw_value in text_kind_counts.items():
            value = as_int(raw_value, -1)
            if not str(key).strip() or value < 0:
                errors.append(f"{name}.import_text_kind_counts_b64 invalid entry")
                continue
            positive_sum += value
        if positive_sum <= 0:
            errors.append(f"{name}.import_text_kind_counts_b64 empty positive_sum")
    text_kind_layout_counts = decode_b64_json_dict(lane.get("import_text_kind_layout_counts_b64"))
    if text_kind_layout_counts:
        positive_sum = 0
        for layout_key, raw_inner in text_kind_layout_counts.items():
            if not str(layout_key).strip() or not isinstance(raw_inner, dict):
                errors.append(f"{name}.import_text_kind_layout_counts_b64 invalid layout entry")
                continue
            for kind_key, raw_value in raw_inner.items():
                value = as_int(raw_value, -1)
                if not str(kind_key).strip() or value < 0:
                    errors.append(f"{name}.import_text_kind_layout_counts_b64 invalid text_kind entry")
                    continue
                positive_sum += value
        if text_kind_counts and positive_sum != sum(as_int(v, 0) for v in text_kind_counts.values()):
            errors.append(f"{name}.import_text_kind_layout_counts_b64 text_kind_count mismatch")
    text_kind_case_details = decode_b64_json_list(lane.get("import_text_kind_case_details_b64"))
    if text_kind_case_details:
        if len(text_kind_case_details) != as_int(lane.get("import_text_kind_case_count"), 0):
            errors.append(f"{name}.import_text_kind_case_details_b64 count mismatch")
        detail_kind_total = 0
        detail_layout_total = 0
        for item in text_kind_case_details:
            if not str(item.get("case_name") or "").strip():
                errors.append(f"{name}.import_text_kind_case_details_b64 missing case_name")
            item_text_kind_counts = as_dict(item.get("text_kind_counts"))
            item_text_kind_layout_counts = as_dict(item.get("text_kind_layout_counts"))
            detail_kind_total += sum(as_int(v, 0) for v in item_text_kind_counts.values())
            for raw_inner in item_text_kind_layout_counts.values():
                detail_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
        if text_kind_counts and detail_kind_total != sum(as_int(v, 0) for v in text_kind_counts.values()):
            errors.append(f"{name}.import_text_kind_case_details_b64 text_kind_count mismatch")
        if text_kind_layout_counts:
            expected_layout_total = 0
            for raw_inner in text_kind_layout_counts.values():
                expected_layout_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            if detail_layout_total != expected_layout_total:
                errors.append(f"{name}.import_text_kind_case_details_b64 text_kind_layout_count mismatch")


def validate_simple_ctest_lane(name, payload):
    lane = as_dict(payload)
    if not lane:
        errors.append(f"{name} missing")
        return
    if not bool(lane.get("enabled", False)):
        return
    if not str(lane.get("status") or "").strip():
        errors.append(f"{name}.status missing")
    if not str(lane.get("test_name") or "").strip():
        errors.append(f"{name}.test_name missing")
    case_count = as_int(lane.get("case_count"), -1)
    pass_count = as_int(lane.get("pass_count"), -1)
    fail_count = as_int(lane.get("fail_count"), -1)
    missing_count = as_int(lane.get("missing_count"), -1)
    if min(case_count, pass_count, fail_count, missing_count) < 0:
        errors.append(f"{name}.counts invalid")
    elif pass_count + fail_count + missing_count != case_count:
        errors.append(f"{name}.counts mismatch")
    if not str(lane.get("build_dir") or "").strip():
        errors.append(f"{name}.build_dir missing")
    exploded_layout_source_counts = decode_b64_json_dict(lane.get("import_exploded_layout_source_counts_b64"))
    if exploded_layout_source_counts:
        positive_sum = 0
        for layout_key, raw_inner in exploded_layout_source_counts.items():
            if not str(layout_key).strip() or not isinstance(raw_inner, dict):
                errors.append(f"{name}.import_exploded_layout_source_counts_b64 invalid layout entry")
                continue
            for source_key, raw_value in raw_inner.items():
                value = as_int(raw_value, -1)
                if not str(source_key).strip() or value < 0:
                    errors.append(f"{name}.import_exploded_layout_source_counts_b64 invalid source entry")
                    continue
                positive_sum += value
        if positive_sum != as_int(lane.get("import_exploded_origin_count"), 0):
            errors.append(f"{name}.import_exploded_layout_source_counts_b64 exploded_count mismatch")
    exploded_layout_case_details = decode_b64_json_list(lane.get("import_exploded_layout_source_case_details_b64"))
    exploded_layout_case_count = as_int(lane.get("import_exploded_layout_source_case_count"), 0)
    if exploded_layout_case_count != len(exploded_layout_case_details):
        errors.append(f"{name}.import_exploded_layout_source_case_details_b64 case_count mismatch")
    if exploded_layout_case_details:
        detail_total = 0
        detail_exploded_total = 0
        for item in exploded_layout_case_details:
            counts = as_dict(item.get("exploded_origin_layout_source_counts"))
            for raw_inner in counts.values():
                detail_total += sum(as_int(v, 0) for v in as_dict(raw_inner).values())
            detail_exploded_total += as_int(item.get("exploded_origin_count"), 0)
        if exploded_layout_source_counts and detail_total != sum(sum(as_int(v, 0) for v in as_dict(raw_inner).values()) for raw_inner in exploded_layout_source_counts.values()):
            errors.append(f"{name}.import_exploded_layout_source_case_details_b64 exploded_layout_count mismatch")
        if detail_exploded_total != as_int(lane.get("import_exploded_origin_count"), 0):
            errors.append(f"{name}.import_exploded_layout_source_case_details_b64 exploded_origin_count mismatch")
    for key in ("model", "paperspace", "mixed"):
        summary_path = str(lane.get(f"{key}_summary_json") or "").strip()
        case_name = str(lane.get(f"{key}_case_name") or "").strip()
        if summary_path:
            resolved = resolve_summary_relative(summary_path)
            if not resolved.exists():
                errors.append(f"{name}.{key}_summary_json missing file: {summary_path}")
            if not case_name:
                errors.append(f"{name}.{key}_case_name missing")


def validate_solver_action_lane(name, payload):
    lane = as_dict(payload)
    if not lane:
        return
    if not bool(lane.get("enabled", False)):
        return
    ok = lane.get("ok")
    if not isinstance(ok, bool):
        errors.append(f"{name}.ok missing/bad")
    for field in ("panel_count", "flow_check_count", "request_count", "invoke_request_count", "focus_request_count", "flow_request_count", "replay_request_count", "import_check_count", "clear_check_count", "jump_request_count", "dom_event_count", "dom_request_event_count", "dom_action_event_count", "dom_focus_event_count", "dom_flow_event_count", "dom_replay_event_count", "event_count", "invoke_event_count", "focus_event_count", "flow_event_count", "replay_event_count", "jump_event_count", "next_check_count", "jump_check_count", "rewind_check_count", "restart_check_count", "replay_check_count", "event_focus_check_count", "banner_check_count", "banner_event_focus_check_count", "banner_focus_click_check_count", "console_check_count", "console_flow_check_count", "console_event_focus_check_count", "console_replay_check_count", "console_event_click_check_count", "console_focus_click_check_count", "console_selection_check_count", "status_check_count", "status_click_check_count", "keyboard_check_count", "panel_cycle_check_count", "panel_keyboard_check_count", "panel_keyboard_invoke_check_count", "panel_keyboard_flow_check_count", "keyboard_banner_check_count", "keyboard_jump_check_count", "keyboard_event_focus_check_count", "visited_panel_count"):
        value = as_int(lane.get(field), -1)
        if value < 0:
            errors.append(f"{name}.{field} invalid")
    summary_json = str(lane.get("summary_json") or "").strip()
    if not summary_json:
        errors.append(f"{name}.summary_json missing")
    else:
        resolved = resolve_summary_relative(summary_json)
        if not resolved.exists():
            errors.append(f"{name}.summary_json missing file: {summary_json}")


def validate_dwg_lane(name, payload, *, desktop=False):
    lane = as_dict(payload)
    if not lane:
        return
    if not bool(lane.get("enabled", False)):
        return
    case_count = as_int(lane.get("case_count"), 0)
    ok = lane.get("ok")
    if not isinstance(ok, bool):
        errors.append(f"{name}.ok missing/bad")
    summary_json = str(lane.get("summary_json") or "").strip()
    if not summary_json:
        errors.append(f"{name}.summary_json missing")
    else:
        resolved = resolve_summary_relative(summary_json)
        if not resolved.exists():
            errors.append(f"{name}.summary_json missing file: {summary_json}")
    if case_count <= 0 and not str(lane.get("input_dwg") or "").strip():
        errors.append(f"{name}.input_dwg missing")
    if desktop:
        for field in ("desktop_ok", "manifest_ok", "preview_artifacts_ok"):
            if not isinstance(lane.get(field), bool):
                errors.append(f"{name}.{field} missing/bad")
        if as_int(lane.get("validator_ok_count"), -1) < 0:
            errors.append(f"{name}.validator_ok_count invalid")
    else:
        if case_count > 0:
            for field in ("pass_count", "fail_count", "validator_ok_count", "dwg_convert_ok_count", "router_ok_count", "convert_ok_count", "viewer_ok_count"):
                if as_int(lane.get(field), -1) < 0:
                    errors.append(f"{name}.{field} invalid")
            if as_int(lane.get("pass_count"), 0) + as_int(lane.get("fail_count"), 0) != case_count:
                errors.append(f"{name}.pass_fail_count mismatch")
        else:
            for field in ("dwg_convert_ok", "router_ok", "convert_ok", "viewer_ok"):
                if not isinstance(lane.get(field), bool):
                    errors.append(f"{name}.{field} missing/bad")
        if as_int(lane.get("validator_ok_count"), -1) < 0:
            errors.append(f"{name}.validator_ok_count invalid")


gate_preview_provenance = payload.get("gate_preview_provenance_smoke")
validate_preview_lane("gate_preview_provenance_smoke", gate_preview_provenance, require_status=False, ok_field=True)

gate_dwg_open = payload.get("gate_dwg_open_smoke")
validate_dwg_lane("gate_dwg_open_smoke", gate_dwg_open)

gate_dwg_open_matrix = payload.get("gate_dwg_open_matrix_smoke")
validate_dwg_lane("gate_dwg_open_matrix_smoke", gate_dwg_open_matrix)

gate_dwg_open_desktop = payload.get("gate_dwg_open_desktop_smoke")
validate_dwg_lane("gate_dwg_open_desktop_smoke", gate_dwg_open_desktop, desktop=True)

gate_solver_action_panel = payload.get("gate_solver_action_panel_smoke")
validate_solver_action_lane("gate_solver_action_panel_smoke", gate_solver_action_panel)

step186_preview_artifact_prep = payload.get("step186_preview_artifact_prep")
validate_preview_lane(
    "step186_preview_artifact_prep",
    step186_preview_artifact_prep,
    allow_missing_summary_for_status={"skipped"},
)

gate_preview_provenance_injection = payload.get("gate_preview_provenance_failure_injection")
validate_preview_lane("gate_preview_provenance_failure_injection", gate_preview_provenance_injection, allow_missing_summary_for_status={"skipped"})

gate_preview_artifact = payload.get("gate_preview_artifact_smoke")
validate_preview_lane("gate_preview_artifact_smoke", gate_preview_artifact)

gate_constraints_basic_ctest = payload.get("gate_constraints_basic_ctest")
validate_simple_ctest_lane("gate_constraints_basic_ctest", gate_constraints_basic_ctest)

gate_assembly_roundtrip_ctest = payload.get("gate_assembly_roundtrip_ctest")
validate_ctest_lane("gate_assembly_roundtrip_ctest", gate_assembly_roundtrip_ctest)

gate_preview_artifact_injection = payload.get("gate_preview_artifact_validator_failure_injection")
validate_preview_lane("gate_preview_artifact_validator_failure_injection", gate_preview_artifact_injection)

weekly_legacy_preview_prep = payload.get("weekly_legacy_preview_artifact_prep")
validate_preview_lane(
    "weekly_legacy_preview_artifact_prep",
    weekly_legacy_preview_prep,
    allow_missing_summary_for_status={"skipped", "skipped_missing_sources"},
)
if isinstance(weekly_legacy_preview_prep, dict) and weekly_legacy_preview_prep.get("enabled", False):
    cases_path = str(weekly_legacy_preview_prep.get("cases_path") or "").strip()
    if not cases_path:
        errors.append("weekly_legacy_preview_artifact_prep.cases_path missing")
    if as_int(weekly_legacy_preview_prep.get("missing_input_count"), -1) < 0:
        errors.append("weekly_legacy_preview_artifact_prep.missing_input_count invalid")
    if as_int(weekly_legacy_preview_prep.get("missing_manifest_count"), -1) < 0:
        errors.append("weekly_legacy_preview_artifact_prep.missing_manifest_count invalid")

weekly_legacy_preview = payload.get("weekly_legacy_preview_artifact_smoke")
validate_preview_lane(
    "weekly_legacy_preview_artifact_smoke",
    weekly_legacy_preview,
    allow_missing_summary_for_status={"missing_cases", "invalid_cases", "skipped_missing_targets", "skipped"},
)
if isinstance(weekly_legacy_preview, dict) and bool(weekly_legacy_preview.get("enabled", False)):
    if not str(weekly_legacy_preview.get("cases_path") or "").strip():
        errors.append("weekly_legacy_preview_artifact_smoke.cases_path missing")
    missing_target_count = as_int(weekly_legacy_preview.get("missing_target_count"), -1)
    if missing_target_count < 0:
        errors.append("weekly_legacy_preview_artifact_smoke.missing_target_count invalid")

if errors:
    for one in errors:
        print(f"[weekly-summary] ERROR {one}", file=sys.stderr)
    raise SystemExit(2)

print(
    "[weekly-summary] OK status={status} mode={mode} days={days} enabled_samples={enabled} "
    "fail_ratio={fail_ratio} attribution_ratio={attr_ratio} dashboard={dashboard}".format(
        status=status,
        mode=mode,
        days=days,
        enabled=enabled_samples,
        fail_ratio=(f"{fail_ratio:.3f}" if fail_ratio is not None else "n/a"),
        attr_ratio=(f"{attr_ratio:.3f}" if attr_ratio is not None else "n/a"),
        dashboard=dashboard_status,
    )
)
PY
