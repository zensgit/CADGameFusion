#!/usr/bin/env python3
"""Write a compact Markdown summary for CI artifacts and failure attribution."""

from __future__ import annotations

import argparse
import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


def load_json(path: str) -> Dict[str, Any]:
    if not path:
        return {}
    p = Path(path)
    if not p.is_file():
        return {}
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def as_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def as_str(value: Any) -> str:
    return str(value or "").strip()


def decode_b64_json_list(value: Any) -> List[Dict[str, Any]]:
    text = str(value or "").strip()
    if not text:
        return []
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def decode_b64_json_dict(value: Any) -> Dict[str, Any]:
    text = str(value or "").strip()
    if not text:
        return {}
    try:
        raw = base64.b64decode(text.encode("ascii"), validate=True).decode("utf-8")
        data = json.loads(raw)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def encode_b64_json_dict(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    try:
        raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return base64.b64encode(raw.encode("utf-8")).decode("ascii")
    except Exception:
        return ""


def fmt_viewport_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        viewport_count = as_int(item.get("viewport_count"), 0)
        layout_count = as_int(item.get("viewport_layout_count"), 0)
        parts.append(f"{lane}:{case_name}({viewport_count}/{layout_count})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_text_kind_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        text_kinds = fmt_counts(as_dict(item.get("text_kind_counts")))
        parts.append(f"{lane}:{case_name}({text_kinds})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        proxy_kinds = fmt_counts(as_dict(item.get("derived_proxy_kind_counts")))
        parts.append(f"{lane}:{case_name}({proxy_kinds})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        proxy_layouts = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({proxy_layouts})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_viewport_proxy_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        proxy_layouts = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("derived_proxy_layout_kind_counts")))
        parts.append(f"{lane}:{case_name}({proxy_layouts})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_source_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        group_sources = fmt_counts(as_dict(item.get("assembly_group_source_counts")))
        parts.append(f"{lane}:{case_name}({group_sources})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_group_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: List[str] = []
    for item in details[:4]:
        lane = str(item.get("lane") or "").strip() or "lane"
        case_name = str(item.get("case_name") or "").strip() or "case"
        group_layouts = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("assembly_group_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({group_layouts})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_exploded_layout_case_details(value: Any) -> str:
    details = decode_b64_json_list(value)
    if not details:
        return "-"
    parts: list[str] = []
    for item in details[:4]:
        lane = as_str(item.get("lane") or "lane")
        case_name = as_str(item.get("case_name") or "case")
        rendered = fmt_proxy_layout_kind_counts(encode_b64_json_dict(item.get("exploded_origin_layout_source_counts")))
        parts.append(f"{lane}:{case_name}({rendered})")
    if len(details) > 4:
        parts.append(f"+{len(details) - 4}")
    return ", ".join(parts)


def fmt_proxy_kind_counts(value: Any) -> str:
    counts = decode_b64_json_dict(value)
    pairs = non_empty_counts(counts)
    if not pairs:
        return "-"
    return ", ".join(f"{key}:{count}" for key, count in pairs)


def fmt_proxy_layout_kind_counts(value: Any) -> str:
    layouts = decode_b64_json_dict(value)
    if not layouts:
        return "-"
    parts: List[str] = []
    for layout, raw_inner in sorted(layouts.items(), key=lambda item: str(item[0])):
        inner_pairs = non_empty_counts(as_dict(raw_inner))
        if not inner_pairs:
            continue
        parts.append(f"{layout}[{', '.join(f'{key}:{count}' for key, count in inner_pairs)}]")
    return "; ".join(parts) if parts else "-"


def non_empty_counts(raw: Dict[str, Any]) -> List[Tuple[str, int]]:
    pairs: List[Tuple[str, int]] = []
    for key, value in raw.items():
        try:
            ivalue = int(value)
        except Exception:
            continue
        if ivalue > 0:
            pairs.append((str(key), ivalue))
    pairs.sort(key=lambda item: (-item[1], item[0]))
    return pairs


def fmt_counts(raw: Dict[str, Any]) -> str:
    pairs = non_empty_counts(raw)
    if not pairs:
        return "none"
    return ", ".join(f"{key}={value}" for key, value in pairs)


def fmt_bool_coverage(raw: Dict[str, Any]) -> str:
    if not isinstance(raw, dict) or not raw:
        return "none"
    pairs: List[str] = []
    for key in sorted(raw.keys()):
        pairs.append(f"{key}={bool_text(raw.get(key))}")
    return ", ".join(pairs)


def find_first_roundtrip_failure(summary: Dict[str, Any]) -> Tuple[str, str]:
    for item in as_list(summary.get("results")):
        one = as_dict(item)
        if str(one.get("status") or "").upper() != "FAIL":
            continue
        name = str(one.get("name") or "")
        codes = [str(code).strip() for code in as_list(one.get("failure_codes")) if str(code).strip()]
        if codes:
            return (codes[0], name)
        return ("FAIL", name)
    return ("", "")


def bool_text(value: Any) -> str:
    return "true" if bool(value) else "false"

def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default

def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default

def collect_ui_flow_run_ids(ui_flow: Dict[str, Any]) -> List[str]:
    direct = [str(x).strip() for x in as_list(ui_flow.get("run_ids")) if str(x).strip()]
    if direct:
        return direct
    out: List[str] = []
    for one in as_list(ui_flow.get("runs")):
        row = as_dict(one)
        run_id = str(row.get("run_id") or "").strip()
        if run_id:
            out.append(run_id)
    return out

def fmt_ui_flow_setup_exits(payload: Dict[str, Any]) -> str:
    open_rc = as_int(payload.get("open_exit_code"), 0)
    resize_rc = as_int(payload.get("resize_exit_code"), 0)
    run_code_rc = as_int(payload.get("run_code_exit_code"), 0)
    stage = str(payload.get("first_failure_stage") or payload.get("failure_stage") or "").strip()
    if not (open_rc or resize_rc or run_code_rc or stage):
        return "-"
    return "open={open_rc} resize={resize_rc} run_code={run_code_rc} stage={stage}".format(
        open_rc=open_rc,
        resize_rc=resize_rc,
        run_code_rc=run_code_rc,
        stage=(stage or "-"),
    )

def fmt_stage_counts(raw: Dict[str, Any]) -> str:
    if not isinstance(raw, dict) or not raw:
        return "-"
    parts: List[str] = []
    for key in sorted(raw.keys()):
        value = as_int(raw.get(key), 0)
        if value > 0:
            parts.append(f"{key}={value}")
    return " ".join(parts) if parts else "-"


def append_preview_lane_line(
    lines: List[str],
    label: str,
    payload: Dict[str, Any],
    status_key: str = "status",
    enabled_key: str = "enabled",
) -> None:
    if not isinstance(payload, dict) or not payload:
        return
    status = str(payload.get(status_key) or "").strip()
    lowered = status.lower()
    if lowered == "ok":
        status = "PASS"
    elif lowered == "pass":
        status = "PASS"
    elif lowered == "fail":
        status = "FAIL"
    elif lowered == "skipped":
        status = "SKIPPED"
    enabled = payload.get(enabled_key)
    run_id = str(payload.get("run_id") or "").strip()
    case_count = as_int(payload.get("case_count"), 0)
    pass_count = as_int(payload.get("pass_count"), 0)
    fail_count = as_int(payload.get("fail_count"), 0)
    first_failed_case = str(payload.get("first_failed_case") or "").strip()
    summary_json = str(payload.get("summary_json") or "").strip()
    if not status and enabled is None and not run_id and not case_count and not pass_count and not fail_count and not summary_json:
        return
    lines.append(
        "- {label}: `{body}`".format(
            label=label,
            body=" ".join(
                [
                    f"enabled={bool_text(enabled if enabled is not None else True)}",
                    f"status={status or 'unknown'}",
                    f"run_id={run_id or '-'}",
                    f"cases={case_count}",
                    f"pass={pass_count}",
                    f"fail={fail_count}",
                    f"first_failed_case={first_failed_case or '-'}",
                ]
                + (
                    [
                        "entry={initial}/{cases}".format(
                            initial=as_int(
                                payload.get("deterministic_entry_case_count")
                                if payload.get("deterministic_entry_case_count") is not None
                                else payload.get("initial_entry_case_count"),
                                0,
                            ),
                            cases=case_count,
                        ),
                        f"focus_checks={as_int(payload.get('focus_check_case_count'), 0)}",
                    ]
                    if payload.get("deterministic_entry_case_count") is not None
                    or payload.get("initial_entry_case_count") is not None
                    or payload.get("focus_check_case_count") is not None
                    else []
                )
            ),
        )
    )
    if summary_json:
        lines.append(f"- {label}_summary: `{summary_json}`")


def append_dwg_lane_line(lines: List[str], label: str, payload: Dict[str, Any], *, desktop: bool = False) -> None:
    if not isinstance(payload, dict) or not payload:
        return
    enabled = payload.get("enabled")
    ok = payload.get("ok")
    status = str(payload.get("status") or "").strip()
    run_id = str(payload.get("run_id") or "").strip()
    summary_json = str(payload.get("summary_json") or "").strip()
    if enabled is False and not run_id and not summary_json:
        return
    if not status and isinstance(ok, bool) and enabled is not False:
        status = "PASS" if ok else "FAIL"
    if not status and enabled is None and not run_id and not summary_json:
        return
    input_dwg = str(payload.get("input_dwg") or "").strip()
    case_count = as_int(payload.get("case_count"), 0)
    pass_count = as_int(payload.get("pass_count"), 0)
    fail_count = as_int(payload.get("fail_count"), 0)
    first_failed_case = str(payload.get("first_failed_case") or "").strip()
    if case_count > 0 and not desktop:
        lines.append(
            "- {label}: `enabled={enabled}` `status={status}` `run_id={run_id}` `cases={cases}` `pass={passed}` `fail={failed}` `dwg_convert_ok={dwg_convert_ok}` `router_ok={router_ok}` `convert_ok={convert_ok}` `viewer_ok={viewer_ok}` `validators_ok={validators_ok}` `first_failed_case={first_failed}` `error={error}`".format(
                label=label,
                enabled=bool_text(enabled if enabled is not None else True),
                status=(status or "unknown"),
                run_id=(run_id or "-"),
                cases=case_count,
                passed=pass_count,
                failed=fail_count,
                dwg_convert_ok=as_int(payload.get("dwg_convert_ok_count"), 0),
                router_ok=as_int(payload.get("router_ok_count"), 0),
                convert_ok=as_int(payload.get("convert_ok_count"), 0),
                viewer_ok=as_int(payload.get("viewer_ok_count"), 0),
                validators_ok=as_int(payload.get("validator_ok_count"), 0),
                first_failed=(first_failed_case or "-"),
                error=(str(payload.get("error") or "").strip() or "-"),
            )
        )
    elif desktop:
        lines.append(
            "- {label}: `enabled={enabled}` `status={status}` `run_id={run_id}` `desktop_ok={desktop_ok}` `manifest_ok={manifest_ok}` `preview_artifacts_ok={preview_artifacts_ok}` `validators_ok={validators_ok}` `input={input}` `error={error}`".format(
                label=label,
                enabled=bool_text(enabled if enabled is not None else True),
                status=(status or "unknown"),
                run_id=(run_id or "-"),
                desktop_ok=bool_text(payload.get("desktop_ok", False)),
                manifest_ok=bool_text(payload.get("manifest_ok", False)),
                preview_artifacts_ok=bool_text(payload.get("preview_artifacts_ok", False)),
                validators_ok=int(payload.get("validator_ok_count", 0) or 0),
                input=(input_dwg or "-"),
                error=(str(payload.get("error") or "").strip() or "-"),
            )
        )
    else:
        lines.append(
            "- {label}: `enabled={enabled}` `status={status}` `run_id={run_id}` `dwg_convert_ok={dwg_convert_ok}` `router_ok={router_ok}` `convert_ok={convert_ok}` `viewer_ok={viewer_ok}` `validators_ok={validators_ok}` `input={input}` `error={error}`".format(
                label=label,
                enabled=bool_text(enabled if enabled is not None else True),
                status=(status or "unknown"),
                run_id=(run_id or "-"),
                dwg_convert_ok=bool_text(payload.get("dwg_convert_ok", False)),
                router_ok=bool_text(payload.get("router_ok", False)),
                convert_ok=bool_text(payload.get("convert_ok", False)),
                viewer_ok=bool_text(payload.get("viewer_ok", False)),
                validators_ok=as_int(payload.get("validator_ok_count"), 0),
                input=(input_dwg or "-"),
                error=(str(payload.get("error") or "").strip() or "-"),
            )
        )
    if case_count > 0 and input_dwg:
        lines.append(
            "- {label}_matrix: `cases={cases}` `pass={passed}` `fail={failed}` `validators_ok={validators}` `first_failed_case={first_failed}`".format(
                label=label,
                cases=case_count,
                passed=pass_count,
                failed=fail_count,
                validators=as_int(payload.get("validator_ok_count"), 0),
                first_failed=(first_failed_case or "-"),
            )
        )
    if summary_json:
        lines.append(f"- {label}_summary: `{summary_json}`")


def append_ctest_lane_line(lines: List[str], label: str, payload: Dict[str, Any]) -> None:
    if not isinstance(payload, dict) or not payload:
        return
    status = str(payload.get("status") or "").strip() or "unknown"
    enabled = payload.get("enabled")
    case_count = as_int(payload.get("case_count"), 0)
    pass_count = as_int(payload.get("pass_count"), 0)
    fail_count = as_int(payload.get("fail_count"), 0)
    missing_count = as_int(payload.get("missing_count"), 0)
    first_failed_case = str(payload.get("first_failed_case") or "").strip()
    build_dir = str(payload.get("build_dir") or "").strip()
    model_status = str(payload.get("model_status") or "").strip()
    paperspace_status = str(payload.get("paperspace_status") or "").strip()
    mixed_status = str(payload.get("mixed_status") or "").strip()
    dense_status = str(payload.get("dense_status") or "").strip()
    summary_json_count = payload.get("summary_json_count")
    import_tracked = payload.get("import_assembly_tracked_count")
    import_groups = payload.get("import_assembly_group_count")
    import_proxies = payload.get("import_derived_proxy_count")
    import_proxy_kinds = payload.get("import_proxy_kind_counts_b64")
    import_proxy_kind_cases = payload.get("import_proxy_kind_case_count")
    import_proxy_kind_case_details = payload.get("import_proxy_kind_case_details_b64")
    import_proxy_layout_case_details = payload.get("import_proxy_layout_case_details_b64")
    import_exploded = payload.get("import_exploded_origin_count")
    import_viewports = payload.get("import_viewport_count")
    import_viewport_layouts = payload.get("import_viewport_layout_count")
    import_viewport_cases = payload.get("import_viewport_case_count")
    import_viewport_case_details = payload.get("import_viewport_case_details_b64")
    import_viewport_proxy_kind_counts = payload.get("import_viewport_proxy_kind_counts_b64")
    import_viewport_proxy_layout_kind_counts = payload.get("import_viewport_proxy_layout_kind_counts_b64")
    import_viewport_proxy_cases = payload.get("import_viewport_proxy_case_count")
    import_viewport_proxy_case_details = payload.get("import_viewport_proxy_case_details_b64")
    import_group_source_cases = payload.get("import_assembly_group_source_case_count")
    import_group_source_case_details = payload.get("import_assembly_group_source_case_details_b64")
    import_text_kind_cases = payload.get("import_text_kind_case_count")
    import_text_kind_case_details = payload.get("import_text_kind_case_details_b64")
    export_checked = payload.get("export_assembly_checked_count")
    export_group_count = payload.get("export_assembly_group_count")
    export_metadata_drift = payload.get("export_metadata_drift_count")
    export_group_drift = payload.get("export_group_drift_count")
    lines.append(
        "- {label}: `enabled={enabled}` `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing={missing}` `first_failed_case={first_failed}` `model={model}` `paperspace={paperspace}` `mixed={mixed}` `dense={dense}`{metrics}{build}".format(
            label=label,
            enabled=bool_text(enabled if enabled is not None else True),
            status=status,
            cases=case_count,
            passed=pass_count,
            failed=fail_count,
            missing=missing_count,
            first_failed=(first_failed_case or "-"),
            model=(model_status or "-"),
            paperspace=(paperspace_status or "-"),
            mixed=(mixed_status or "-"),
            dense=(dense_status or "-"),
            metrics=(
                ""
                if summary_json_count is None
                else " `summaries={summaries}` `tracked={tracked}` `groups={groups}` `group_sources={group_sources}` `group_source_cases={group_source_cases}` `group_source_case_details={group_source_case_details}` `group_layouts={group_layouts}` `group_layout_cases={group_layout_cases}` `group_layout_case_details={group_layout_case_details}` `proxies={proxies}` `proxy_kinds={proxy_kinds}` `proxy_kind_cases={proxy_kind_cases}` `proxy_kind_case_details={proxy_kind_case_details}` `proxy_layouts={proxy_layouts}` `proxy_layout_cases={proxy_layout_cases}` `proxy_layout_case_details={proxy_layout_case_details}` `text_kinds={text_kinds}` `text_kind_layouts={text_kind_layouts}` `text_kind_cases={text_kind_cases}` `text_kind_case_details={text_kind_case_details}` `exploded={exploded}` `exploded_layouts={exploded_layouts}` `exploded_layout_cases={exploded_layout_cases}` `exploded_layout_case_details={exploded_layout_case_details}` `viewports={viewports}` `viewport_layouts={viewport_layouts}` `viewport_cases={viewport_cases}` `viewport_detail_cases={viewport_detail_cases}` `viewport_proxy_kinds={viewport_proxy_kinds}` `viewport_proxy_layouts={viewport_proxy_layouts}` `viewport_proxy_cases={viewport_proxy_cases}` `viewport_proxy_case_details={viewport_proxy_case_details}` `checked={checked}` `export_groups={export_groups}` `drift={metadata_drift}/{group_drift}`".format(
                    summaries=as_int(summary_json_count, 0),
                    tracked=as_int(import_tracked, 0),
                    groups=as_int(import_groups, 0),
                    group_sources=fmt_proxy_kind_counts(payload.get("import_assembly_group_source_counts_b64")),
                    group_source_cases=as_int(import_group_source_cases, 0),
                    group_source_case_details=fmt_group_source_case_details(import_group_source_case_details),
                    group_layouts=fmt_proxy_layout_kind_counts(payload.get("import_assembly_group_layout_source_counts_b64")),
                    group_layout_cases=as_int(payload.get("import_assembly_group_layout_source_case_count"), 0),
                    group_layout_case_details=fmt_group_layout_case_details(payload.get("import_assembly_group_layout_source_case_details_b64")),
                    proxies=as_int(import_proxies, 0),
                    proxy_kinds=fmt_proxy_kind_counts(import_proxy_kinds),
                    proxy_kind_cases=as_int(import_proxy_kind_cases, 0),
                    proxy_kind_case_details=fmt_proxy_kind_case_details(import_proxy_kind_case_details),
                    proxy_layouts=fmt_proxy_layout_kind_counts(payload.get("import_proxy_layout_kind_counts_b64")),
                    proxy_layout_cases=as_int(payload.get("import_proxy_layout_case_count"), 0),
                    proxy_layout_case_details=fmt_proxy_layout_case_details(import_proxy_layout_case_details),
                    text_kinds=fmt_proxy_kind_counts(payload.get("import_text_kind_counts_b64")),
                    text_kind_layouts=fmt_proxy_layout_kind_counts(payload.get("import_text_kind_layout_counts_b64")),
                    text_kind_cases=as_int(import_text_kind_cases, 0),
                    text_kind_case_details=fmt_text_kind_case_details(import_text_kind_case_details),
                    exploded=as_int(import_exploded, 0),
                    exploded_layouts=fmt_proxy_layout_kind_counts(payload.get("import_exploded_layout_source_counts_b64")),
                    exploded_layout_cases=as_int(payload.get("import_exploded_layout_source_case_count"), 0),
                    exploded_layout_case_details=fmt_exploded_layout_case_details(payload.get("import_exploded_layout_source_case_details_b64")),
                    viewports=as_int(import_viewports, 0),
                    viewport_layouts=as_int(import_viewport_layouts, 0),
                    viewport_cases=as_int(import_viewport_cases, 0),
                    viewport_detail_cases=fmt_viewport_case_details(import_viewport_case_details),
                    viewport_proxy_kinds=fmt_proxy_kind_counts(import_viewport_proxy_kind_counts),
                    viewport_proxy_layouts=fmt_proxy_layout_kind_counts(import_viewport_proxy_layout_kind_counts),
                    viewport_proxy_cases=as_int(import_viewport_proxy_cases, 0),
                    viewport_proxy_case_details=fmt_viewport_proxy_case_details(import_viewport_proxy_case_details),
                    checked=as_int(export_checked, 0),
                    export_groups=as_int(export_group_count, 0),
                    metadata_drift=as_int(export_metadata_drift, 0),
                    group_drift=as_int(export_group_drift, 0),
                )
            ),
            build=(f" `build_dir={build_dir}`" if build_dir else ""),
        )
    )
    for lane_key in ("model", "paperspace", "mixed", "dense"):
        summary_json = str(payload.get(f"{lane_key}_summary_json") or "").strip()
        case_name = str(payload.get(f"{lane_key}_case_name") or "").strip()
        if summary_json:
            lines.append(f"- {label}_{lane_key}: `case={case_name or '-'}` `summary={summary_json}`")


def append_simple_ctest_lane_line(lines: List[str], label: str, payload: Dict[str, Any]) -> None:
    if not isinstance(payload, dict) or not payload:
        return
    enabled = payload.get("enabled")
    status = str(payload.get("status") or "").strip()
    if enabled is False and not status:
        return
    build_dir = str(payload.get("build_dir") or "").strip()
    lines.append(
        "- {label}: `enabled={enabled}` `status={status}` `cases={cases}` `pass={passed}` `fail={failed}` `missing={missing}` `first_failed_case={first_failed}` `test={test}`{build}".format(
            label=label,
            enabled=bool_text(enabled if enabled is not None else True),
            status=(status or "unknown"),
            cases=as_int(payload.get("case_count"), 0),
            passed=as_int(payload.get("pass_count"), 0),
            failed=as_int(payload.get("fail_count"), 0),
            missing=as_int(payload.get("missing_count"), 0),
            first_failed=(str(payload.get("first_failed_case") or "").strip() or "-"),
            test=(str(payload.get("test_name") or "").strip() or "-"),
            build=(f" `build_dir={build_dir}`" if build_dir else ""),
        )
    )


def append_solver_action_lane_line(lines: List[str], label: str, payload: Dict[str, Any]) -> None:
    if not isinstance(payload, dict) or not payload:
        return
    enabled = payload.get("enabled")
    ok = payload.get("ok")
    status = str(payload.get("status") or "").strip()
    run_id = str(payload.get("run_id") or "").strip()
    summary_json = str(payload.get("summary_json") or "").strip()
    if enabled is False and not run_id and not summary_json:
        return
    if not status and isinstance(ok, bool) and enabled is not False:
        status = "PASS" if ok else "FAIL"
    if not status and enabled is None and not run_id and not summary_json:
        return
    lines.append(
        "- {label}: `enabled={enabled}` `status={status}` `run_id={run_id}` `panels={panels}` `flow_checks={flow_checks}` `requests={requests}` `invoke={invoke_count}` `focus={focus_count}` `flow={flow_count}` `replay={replay_count}` `import_checks={import_checks}` `clear_checks={clear_checks}` `jump_requests={jump_request_count}` `dom_events={dom_event_count}` `dom_requests={dom_request_count}` `dom_actions={dom_action_count}` `dom_focus={dom_focus_count}` `dom_flow={dom_flow_count}` `dom_replay={dom_replay_count}` `events={event_count}` `event_invoke={event_invoke_count}` `event_focus={event_focus_count}` `event_flow={event_flow_count}` `event_replay={event_replay_count}` `jump_events={jump_event_count}` `next={next_count}` `jump={jump_count}` `prev={prev_count}` `restart={restart_count}` `replay_checks={replay_checks}` `event_focus_checks={event_focus_checks}` `banner_checks={banner_checks}` `banner_event_focus={banner_event_focus_checks}` `banner_focus_clicks={banner_focus_clicks}` `console={console_checks}` `console_flow={console_flow_checks}` `console_event_focus={console_event_focus_checks}` `console_replay={console_replay_checks}` `console_event_click={console_event_click_checks}` `console_focus_click={console_focus_click_checks}` `console_selection={console_selection_checks}` `status_checks={status_checks}` `status_clicks={status_click_checks}` `keyboard={keyboard_checks}` `panel_cycle={panel_cycle_checks}` `panel_keyboard={panel_keyboard_checks}` `panel_keyboard_invoke={panel_keyboard_invoke_checks}` `panel_keyboard_flow={panel_keyboard_flow_checks}` `keyboard_banner={keyboard_banner_checks}` `keyboard_jump={keyboard_jump_checks}` `keyboard_event_focus={keyboard_event_focus_checks}` `visited_panels={visited}`".format(
            label=label,
            enabled=bool_text(enabled if enabled is not None else True),
            status=(status or "unknown"),
            run_id=(run_id or "-"),
            panels=as_int(payload.get("panel_count"), 0),
            flow_checks=as_int(payload.get("flow_check_count"), 0),
            requests=as_int(payload.get("request_count"), 0),
            invoke_count=as_int(payload.get("invoke_request_count"), 0),
            focus_count=as_int(payload.get("focus_request_count"), 0),
            flow_count=as_int(payload.get("flow_request_count"), 0),
            replay_count=as_int(payload.get("replay_request_count"), 0),
            import_checks=as_int(payload.get("import_check_count"), 0),
            clear_checks=as_int(payload.get("clear_check_count"), 0),
            jump_request_count=as_int(payload.get("jump_request_count"), 0),
            dom_event_count=as_int(payload.get("dom_event_count"), 0),
            dom_request_count=as_int(payload.get("dom_request_event_count"), 0),
            dom_action_count=as_int(payload.get("dom_action_event_count"), 0),
            dom_focus_count=as_int(payload.get("dom_focus_event_count"), 0),
            dom_flow_count=as_int(payload.get("dom_flow_event_count"), 0),
            dom_replay_count=as_int(payload.get("dom_replay_event_count"), 0),
            event_count=as_int(payload.get("event_count"), 0),
            event_invoke_count=as_int(payload.get("invoke_event_count"), 0),
            event_focus_count=as_int(payload.get("focus_event_count"), 0),
            event_flow_count=as_int(payload.get("flow_event_count"), 0),
            event_replay_count=as_int(payload.get("replay_event_count"), 0),
            jump_event_count=as_int(payload.get("jump_event_count"), 0),
            next_count=as_int(payload.get("next_check_count"), 0),
            jump_count=as_int(payload.get("jump_check_count"), 0),
            prev_count=as_int(payload.get("rewind_check_count"), 0),
            restart_count=as_int(payload.get("restart_check_count"), 0),
            replay_checks=as_int(payload.get("replay_check_count"), 0),
            event_focus_checks=as_int(payload.get("event_focus_check_count"), 0),
            banner_checks=as_int(payload.get("banner_check_count"), 0),
            banner_event_focus_checks=as_int(payload.get("banner_event_focus_check_count"), 0),
            banner_focus_clicks=as_int(payload.get("banner_focus_click_check_count"), 0),
            console_checks=as_int(payload.get("console_check_count"), 0),
            console_flow_checks=as_int(payload.get("console_flow_check_count"), 0),
            console_event_focus_checks=as_int(payload.get("console_event_focus_check_count"), 0),
            console_replay_checks=as_int(payload.get("console_replay_check_count"), 0),
            console_event_click_checks=as_int(payload.get("console_event_click_check_count"), 0),
            console_focus_click_checks=as_int(payload.get("console_focus_click_check_count"), 0),
            console_selection_checks=as_int(payload.get("console_selection_check_count"), 0),
            status_checks=as_int(payload.get("status_check_count"), 0),
            status_click_checks=as_int(payload.get("status_click_check_count"), 0),
            keyboard_checks=as_int(payload.get("keyboard_check_count"), 0),
            panel_cycle_checks=as_int(payload.get("panel_cycle_check_count"), 0),
            panel_keyboard_checks=as_int(payload.get("panel_keyboard_check_count"), 0),
            panel_keyboard_invoke_checks=as_int(payload.get("panel_keyboard_invoke_check_count"), 0),
            panel_keyboard_flow_checks=as_int(payload.get("panel_keyboard_flow_check_count"), 0),
            keyboard_banner_checks=as_int(payload.get("keyboard_banner_check_count"), 0),
            keyboard_jump_checks=as_int(payload.get("keyboard_jump_check_count"), 0),
            keyboard_event_focus_checks=as_int(payload.get("keyboard_event_focus_check_count"), 0),
            visited=as_int(payload.get("visited_panel_count"), 0),
        )
    )
    if summary_json:
        lines.append(f"- {label}_summary: `{summary_json}`")


def validate_ui_stage_trend_contract(raw: Dict[str, Any]) -> Tuple[bool, List[str]]:
    payload = as_dict(raw)
    issues: List[str] = []
    days = as_int(payload.get("days"), 0)
    status = str(payload.get("status") or "").strip()
    mode = str(payload.get("recommended_gate_mode") or "").strip()
    if days <= 0:
        issues.append("days<=0")
    if not status:
        issues.append("status_missing")
    if mode not in {"observe", "gate"}:
        issues.append("recommended_mode_invalid")
    if not str(payload.get("summary_json") or "").strip():
        issues.append("summary_json_missing")
    if not str(payload.get("summary_md") or "").strip():
        issues.append("summary_md_missing")
    if not isinstance(payload.get("failure_stage_counts"), dict):
        issues.append("failure_stage_counts_invalid")
    if not isinstance(payload.get("first_failure_stage_counts"), dict):
        issues.append("first_failure_stage_counts_invalid")
    if not isinstance(payload.get("setup_exit_nonzero_runs"), dict):
        issues.append("setup_exit_nonzero_runs_invalid")
    enabled = as_int(payload.get("enabled_samples_in_window"), 0)
    fail_ratio = as_float(payload.get("fail_ratio"), None)
    attr_ratio = as_float(payload.get("attribution_ratio"), None)
    if enabled > 0:
        if fail_ratio is None:
            issues.append("fail_ratio_missing")
        if attr_ratio is None:
            issues.append("attribution_ratio_missing")
    return (len(issues) == 0, issues)

def summarize_roundtrip_unsupported(roundtrip: Dict[str, Any]) -> Dict[str, int]:
    summary = {
        "cases_with_checks": 0,
        "checked_entities": 0,
        "missing_entities": 0,
        "drifted_entities": 0,
        "failed_cases": 0,
    }
    for item in as_list(roundtrip.get("results")):
        row = as_dict(item)
        export = as_dict(row.get("export"))
        unsupported = as_dict(export.get("unsupported_passthrough"))
        if not unsupported:
            continue
        checked = as_int(unsupported.get("checked_count"), 0)
        missing = as_int(unsupported.get("missing_count"), 0)
        drifted = as_int(unsupported.get("drifted_count"), 0)
        if checked > 0 or missing > 0 or drifted > 0:
            summary["cases_with_checks"] += 1
        summary["checked_entities"] += max(0, checked)
        summary["missing_entities"] += max(0, missing)
        summary["drifted_entities"] += max(0, drifted)
        if missing > 0 or drifted > 0:
            summary["failed_cases"] += 1
    return summary


def render(
    args: argparse.Namespace,
    gate: Dict[str, Any],
    roundtrip: Dict[str, Any],
    parallel_summary: Dict[str, Any],
    local_summary: Dict[str, Any],
) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines: List[str] = []
    lines.append(f"# {args.title}")
    lines.append("")
    lines.append(f"- generated_at: `{now}`")
    lines.append(f"- workflow_mode: `{args.mode}`")

    workflow_contract_ok = str(os.environ.get("UI_STAGE_CONTRACT_OK") or "").strip().lower()
    workflow_contract_source = str(os.environ.get("UI_STAGE_CONTRACT_SOURCE") or "").strip()
    workflow_contract_issues = str(os.environ.get("UI_STAGE_CONTRACT_ISSUES") or "").strip()
    workflow_contract_issue_count = as_int(os.environ.get("UI_STAGE_CONTRACT_ISSUE_COUNT"), 0)
    workflow_contract_status = str(os.environ.get("UI_STAGE_CONTRACT_STATUS") or "").strip()
    workflow_contract_mode = str(os.environ.get("UI_STAGE_CONTRACT_MODE") or "").strip()
    workflow_contract_days = as_int(os.environ.get("UI_STAGE_CONTRACT_DAYS"), 0)
    workflow_contract_rc = as_int(os.environ.get("UI_STAGE_CONTRACT_RC"), 0)
    workflow_contract_policy = str(os.environ.get("UI_STAGE_CONTRACT_POLICY") or "").strip()
    workflow_contract_decision = str(os.environ.get("UI_STAGE_CONTRACT_DECISION") or "").strip()
    if workflow_contract_ok in {"true", "false"} or workflow_contract_source:
        lines.append(
            "- workflow_ui_flow_stage_trend_contract: `ok={ok}` `issues={issues}` `issue_count={count}` `source={source}` `status={status}` `mode={mode}` `policy={policy}` `decision={decision}` `days={days}` `rc={rc}`".format(
                ok=(workflow_contract_ok or "unknown"),
                issues=(workflow_contract_issues or "none"),
                count=workflow_contract_issue_count,
                source=(workflow_contract_source or "unknown"),
                status=(workflow_contract_status or "unknown"),
                mode=(workflow_contract_mode or "unknown"),
                policy=(workflow_contract_policy or "observe"),
                decision=(workflow_contract_decision or "pass"),
                days=workflow_contract_days,
                rc=workflow_contract_rc,
            )
        )

    if gate:
        gate_decision = as_dict(gate.get("gate_decision"))
        gate_inputs = as_dict(gate.get("inputs"))
        would_fail = bool(gate_decision.get("would_fail"))
        exit_code = int(gate_decision.get("exit_code", 0) or 0)
        fail_reasons = [str(x) for x in as_list(gate_decision.get("fail_reasons")) if str(x).strip()]

        editor_smoke = as_dict(gate.get("editor_smoke"))
        editor_totals = as_dict(editor_smoke.get("totals"))
        editor_fail_codes = as_dict(editor_smoke.get("failure_code_counts"))
        editor_unsupported = as_dict(editor_smoke.get("unsupported_passthrough"))
        editor_filters = as_dict(editor_smoke.get("filters"))
        editor_case_selection = as_dict(editor_smoke.get("case_selection"))

        ui_flow = as_dict(gate.get("ui_flow_smoke"))
        ui_fail_codes = as_dict(ui_flow.get("failure_code_counts"))
        ui_port = as_dict(ui_flow.get("port_allocation"))
        qt_persistence = as_dict(gate.get("qt_project_persistence"))

        step166 = as_dict(gate.get("step166"))
        step166_decision = as_dict(step166.get("gate_decision"))

        editor_inject = as_dict(gate.get("editor_smoke_failure_injection"))
        ui_inject = as_dict(gate.get("ui_flow_failure_injection"))
        step186_prep = as_dict(gate.get("step186_preview_artifact_prep"))
        provenance_smoke = as_dict(gate.get("preview_provenance_smoke"))
        dwg_open_smoke = as_dict(gate.get("dwg_open_smoke"))
        dwg_open_matrix_smoke = as_dict(gate.get("dwg_open_matrix_smoke"))
        dwg_open_desktop_smoke = as_dict(gate.get("dwg_open_desktop_smoke"))
        solver_action_smoke = as_dict(gate.get("solver_action_panel_smoke"))
        provenance_failure = as_dict(gate.get("preview_provenance_failure_injection"))
        artifact_smoke = as_dict(gate.get("preview_artifact_smoke"))
        artifact_validator_failure = as_dict(gate.get("preview_artifact_validator_failure_injection"))

        lines.append("")
        lines.append("## Editor Gate")
        lines.append(
            "- decision: `would_fail={wf}` `exit_code={code}` `fail_reasons={reasons}`".format(
                wf=bool_text(would_fail),
                code=exit_code,
                reasons=("none" if not fail_reasons else ",".join(fail_reasons)),
            )
        )
        if gate_inputs:
            lines.append(
                "- gate_inputs: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}`".format(
                    profile=str(gate_inputs.get("editor_gate_profile") or "<none>"),
                    step166=bool_text(gate_inputs.get("run_step166_gate", False)),
                    ui_flow=bool_text(gate_inputs.get("run_editor_ui_flow_smoke_gate", False)),
                    convert=bool_text(gate_inputs.get("editor_smoke_no_convert", False)),
                    perf=bool_text(gate_inputs.get("run_perf_trend", False)),
                    real_scene=bool_text(gate_inputs.get("run_real_scene_trend", False)),
                )
            )
        gate_ui_stage_trend = as_dict(gate.get("ui_flow_stage_trend"))
        if gate_ui_stage_trend:
            gate_ui_stage_ok, gate_ui_stage_issues = validate_ui_stage_trend_contract(gate_ui_stage_trend)
            lines.append(
                "- ui_flow_stage_trend: `status={status}` `recommended={recommended}` `effective={effective}` `source={source}` `applied={applied}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
                    status=str(gate_ui_stage_trend.get("status") or ""),
                    recommended=str(gate_ui_stage_trend.get("recommended_gate_mode") or "observe"),
                    effective=str(gate_ui_stage_trend.get("effective_mode") or "observe"),
                    source=str(gate_ui_stage_trend.get("gate_source") or "legacy"),
                    applied=bool_text(gate_ui_stage_trend.get("gate_applied", False)),
                    enabled=as_int(gate_ui_stage_trend.get("enabled_samples_in_window"), 0),
                    fail_ratio=as_float(gate_ui_stage_trend.get("fail_ratio"), 0.0),
                    attr_ratio=as_float(gate_ui_stage_trend.get("attribution_ratio"), 0.0),
                )
            )
            lines.append(
                "- ui_flow_stage_trend_contract: `ok={ok}` `issues={issues}`".format(
                    ok=bool_text(gate_ui_stage_ok),
                    issues=("none" if not gate_ui_stage_issues else ",".join(gate_ui_stage_issues)),
                )
            )
            lines.append(
                "- ui_flow_stage_trend_counts: `stages={stages}` `first_stages={first}` `setup_nonzero={setup}`".format(
                    stages=fmt_stage_counts(as_dict(gate_ui_stage_trend.get("failure_stage_counts"))),
                    first=fmt_stage_counts(as_dict(gate_ui_stage_trend.get("first_failure_stage_counts"))),
                    setup=fmt_stage_counts(as_dict(gate_ui_stage_trend.get("setup_exit_nonzero_runs"))),
                )
            )
        lines.append(
            "- editor_smoke: `run_id={run_id}` `status={status}` `pass={p}` `fail={f}` `first_failure_code={ffc}` `failure_codes={codes}`".format(
                run_id=editor_smoke.get("run_id", ""),
                status=editor_smoke.get("status", "UNKNOWN"),
                p=int(editor_totals.get("pass", 0) or 0),
                f=int(editor_totals.get("fail", 0) or 0),
                ffc=editor_smoke.get("first_failure_code", ""),
                codes=fmt_counts(editor_fail_codes),
            )
        )
        editor_case_source = str(
            editor_smoke.get("case_source")
            or os.environ.get("EDITOR_SMOKE_CASE_SOURCE", "")
            or "unknown"
        )
        editor_cases = str(
            editor_smoke.get("cases")
            or os.environ.get("EDITOR_SMOKE_CASES_SELECTED", "")
        )
        editor_cases_count = as_int(
            editor_smoke.get("cases_count"),
            as_int(os.environ.get("EDITOR_SMOKE_GENERATED_CASES"), 0),
        )
        editor_min_cases = as_int(
            editor_smoke.get("min_cases_required"),
            as_int(os.environ.get("EDITOR_SMOKE_REQUIRED_CASES"), 0),
        )
        lines.append(
            "- editor_smoke_cases: `source={source}` `count={count}` `min_required={min_required}` `cases={cases}`".format(
                source=editor_case_source,
                count=editor_cases_count,
                min_required=editor_min_cases,
                cases=editor_cases,
            )
        )
        generated_path = str(editor_smoke.get("generated_cases_path") or "").strip()
        generated_count = as_int(
            editor_smoke.get("generated_count"),
            as_int(os.environ.get("EDITOR_SMOKE_GENERATED_CASES"), 0),
        )
        generated_declared = as_int(editor_smoke.get("generated_count_declared"), generated_count)
        generated_actual = as_int(editor_smoke.get("generated_count_actual"), generated_count)
        generated_mismatch = bool(editor_smoke.get("generated_count_mismatch", generated_declared != generated_actual))
        generated_mismatch_policy = str(editor_smoke.get("generated_count_mismatch_policy") or "warn")
        generated_mismatch_gate_fail = bool(editor_smoke.get("generated_count_mismatch_gate_fail", False))
        generated_min_cases = as_int(editor_smoke.get("generated_min_cases"), as_int(os.environ.get("EDITOR_SMOKE_REQUIRED_CASES"), 0))
        generated_priorities = str(editor_smoke.get("generated_priorities") or "").strip()
        generated_run_id = str(
            editor_smoke.get("generated_run_id")
            or os.environ.get("EDITOR_SMOKE_GENERATED_RUN_ID", "")
        ).strip()
        generated_run_ids = str(os.environ.get("EDITOR_SMOKE_GENERATED_RUN_IDS", "")).strip()
        if isinstance(editor_smoke.get("generated_run_ids"), list):
            loaded_ids = [str(x).strip() for x in editor_smoke.get("generated_run_ids") if str(x).strip()]
            if loaded_ids:
                generated_run_ids = ",".join(loaded_ids)
        if generated_path or generated_count > 0 or generated_declared > 0 or generated_actual > 0:
            lines.append(
                "- editor_smoke_generated_cases: `path={path}` `count={count}` `declared={declared}` `actual={actual}` `mismatch={mismatch}` `min={min_cases}` `priorities={priorities}`".format(
                    path=(generated_path or "-"),
                    count=generated_count,
                    declared=generated_declared,
                    actual=generated_actual,
                    mismatch=bool_text(generated_mismatch),
                    min_cases=generated_min_cases,
                    priorities=(generated_priorities or "-"),
                )
            )
            lines.append(
                "- editor_smoke_generated_mismatch_policy: `policy={policy}` `gate_fail={gate_fail}`".format(
                    policy=generated_mismatch_policy,
                    gate_fail=bool_text(generated_mismatch_gate_fail),
                )
            )
        if generated_run_id or generated_run_ids:
            lines.append(
                "- editor_smoke_generated_runs: `run_id={run_id}` `run_ids={run_ids}`".format(
                    run_id=(generated_run_id or "-"),
                    run_ids=(generated_run_ids or "-"),
                )
            )
        lines.append(
            "- editor_smoke_attribution: `complete={complete}` `code_total={total}`".format(
                complete=bool_text(editor_smoke.get("failure_attribution_complete", True)),
                total=int(editor_smoke.get("failure_code_total", 0) or 0),
            )
        )
        lines.append(
            "- editor_smoke_unsupported: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                cases=int(editor_unsupported.get("cases_with_checks", 0) or 0),
                checked=int(editor_unsupported.get("checked_entities", 0) or 0),
                missing=int(editor_unsupported.get("missing_entities", 0) or 0),
                drifted=int(editor_unsupported.get("drifted_entities", 0) or 0),
                failed=int(editor_unsupported.get("failed_cases", 0) or 0),
            )
        )
        lines.append(
            "- editor_smoke_filters: `priority_set={priority}` `tag_any={tags}`".format(
                priority=",".join(str(x) for x in as_list(editor_filters.get("priority_set"))) or "-",
                tags=",".join(str(x) for x in as_list(editor_filters.get("tag_any"))) or "-",
            )
        )
        lines.append(
            "- editor_smoke_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
                selected=int(editor_case_selection.get("selected_count", 0) or 0),
                matched=int(editor_case_selection.get("matched_count", 0) or 0),
                candidate=int(editor_case_selection.get("filtered_count", 0) or 0),
                total=int(editor_case_selection.get("total_input", 0) or 0),
                fallback=bool_text(editor_case_selection.get("used_fallback", False)),
            )
        )
        lines.append(
            "- ui_flow_smoke: `enabled={enabled}` `run_id={run_id}` `ok={ok}` `open_retries={open_retries}` `open_attempts={open_attempts}` `first_failure_code={ffc}` `failure_codes={codes}`".format(
                enabled=bool_text(ui_flow.get("enabled", False)),
                run_id=ui_flow.get("run_id", ""),
                ok=bool_text(ui_flow.get("ok", False)),
                open_retries=as_int(ui_flow.get("open_retries"), 0),
                open_attempts=as_int(ui_flow.get("open_attempt_count"), 0),
                ffc=ui_flow.get("first_failure_code", ""),
                codes=fmt_counts(ui_fail_codes),
            )
        )
        ui_flow_run_ids = collect_ui_flow_run_ids(ui_flow)
        if ui_flow_run_ids:
            lines.append(f"- ui_flow_run_ids: `{' '.join(ui_flow_run_ids)}`")
        lines.append(
            "- ui_flow_gate_required: `required={required}` `explicit={explicit}`".format(
                required=bool_text(ui_flow.get("gate_required", False)),
                explicit=bool_text(ui_flow.get("gate_required_explicit", False)),
            )
        )
        if ui_port:
            lines.append(
                "- ui_flow_port_allocation: `available={available}` `status={status}` `reason={reason}`".format(
                    available=str(ui_port.get("available", "")),
                    status=str(ui_port.get("status", "")),
                    reason=str(ui_port.get("reason", "")),
                )
            )
        lines.append(
            "- ui_flow_attribution: `complete={complete}` `code_total={total}`".format(
                complete=bool_text(ui_flow.get("failure_attribution_complete", True)),
                total=int(ui_flow.get("failure_code_total", 0) or 0),
            )
        )
        lines.append(f"- ui_flow_setup_exits: `{fmt_ui_flow_setup_exits(ui_flow)}`")
        lines.append(f"- ui_flow_failure_stages: `{fmt_stage_counts(as_dict(ui_flow.get('failure_stage_counts')))}`")
        lines.append(
            "- step166: `enabled={enabled}` `run_id={run_id}` `gate_would_fail={gwf}`".format(
                enabled=bool_text(step166.get("enabled", True)),
                run_id=step166.get("run_id", ""),
                gwf=bool_text(step166_decision.get("would_fail", False)),
            )
        )
        lines.append(
            "- editor_smoke_injection: `status={status}` `code={code}` `run_id={run_id}`".format(
                status=editor_inject.get("status", "SKIPPED"),
                code=editor_inject.get("failure_code", ""),
                run_id=editor_inject.get("run_id", ""),
            )
        )
        lines.append(
            "- ui_flow_injection: `status={status}` `code={code}` `run_id={run_id}`".format(
                status=ui_inject.get("status", "SKIPPED"),
                code=ui_inject.get("failure_code", ""),
                run_id=ui_inject.get("run_id", ""),
            )
        )
        if qt_persistence:
            lines.append(
                "- qt_project_persistence: `status={status}` `mode={mode}` `gate_required={required}` `reason={reason}` `run_id={run_id}`".format(
                    status=str(qt_persistence.get("status") or ""),
                    mode=str(qt_persistence.get("mode") or "skipped"),
                    required=bool_text(qt_persistence.get("gate_required", False)),
                    reason=str(qt_persistence.get("reason") or ""),
                    run_id=str(qt_persistence.get("run_id") or ""),
                )
            )
            lines.append(
                "- qt_project_persistence_build: `dir={build_dir}` `BUILD_EDITOR_QT={flag}` `target_available={target}` `script_rc={script}` `build_rc={build}` `test_rc={test}`".format(
                    build_dir=str(qt_persistence.get("build_dir") or ""),
                    flag=str(qt_persistence.get("build_editor_qt") or ""),
                    target=bool_text(qt_persistence.get("target_available", False)),
                    script=as_int(qt_persistence.get("exit_code"), 0),
                    build=as_int(qt_persistence.get("build_exit_code"), 0),
                    test=as_int(qt_persistence.get("test_exit_code"), 0),
                )
            )
        append_preview_lane_line(lines, "step186_preview_artifact_prep", step186_prep)
        append_preview_lane_line(
            lines,
            "preview_provenance_smoke",
            {
                "enabled": provenance_smoke.get("enabled", False),
                "status": (
                    "SKIPPED"
                    if not provenance_smoke.get("enabled", False)
                    else ("PASS" if provenance_smoke.get("ok", False) else "FAIL")
                ),
                "run_id": provenance_smoke.get("run_id", ""),
                "case_count": provenance_smoke.get("case_count", 0),
                "pass_count": provenance_smoke.get("pass_count", 0),
                "fail_count": provenance_smoke.get("fail_count", 0),
                "initial_entry_case_count": provenance_smoke.get("initial_entry_case_count", 0),
                "deterministic_entry_case_count": provenance_smoke.get("deterministic_entry_case_count", 0),
                "focus_check_case_count": provenance_smoke.get("focus_check_case_count", 0),
                "first_failed_case": provenance_smoke.get("first_failed_case", ""),
                "summary_json": provenance_smoke.get("summary_json", ""),
            },
        )
        append_dwg_lane_line(lines, "dwg_open_smoke", dwg_open_smoke)
        append_dwg_lane_line(lines, "dwg_open_matrix_smoke", dwg_open_matrix_smoke)
        append_dwg_lane_line(lines, "dwg_open_desktop_smoke", dwg_open_desktop_smoke, desktop=True)
        append_simple_ctest_lane_line(lines, "constraints_basic_ctest", as_dict(gate.get("constraints_basic_ctest")))
        append_solver_action_lane_line(lines, "solver_action_panel_smoke", solver_action_smoke)
        append_preview_lane_line(lines, "preview_provenance_failure_injection", provenance_failure)
        append_preview_lane_line(lines, "preview_artifact_smoke", artifact_smoke)
        append_preview_lane_line(lines, "preview_artifact_validator_failure_injection", artifact_validator_failure)
        append_ctest_lane_line(lines, "assembly_roundtrip_ctest", as_dict(gate.get("assembly_roundtrip_ctest")))

    if parallel_summary:
        p_gate = as_dict(parallel_summary.get("gate_decision"))
        p_fail_reasons = [str(x) for x in as_list(p_gate.get("fail_reasons")) if str(x).strip()]
        p_warning_codes = [str(x) for x in as_list(p_gate.get("warning_codes")) if str(x).strip()]
        p_failure_codes = as_dict(p_gate.get("failure_code_counts"))
        lines.append("")
        lines.append("## Parallel Cycle")
        lines.append(
            "- run: `run_id={run_id}`".format(
                run_id=str(parallel_summary.get("run_id") or ""),
            )
        )
        lines.append(
            "- decision: `decision={decision}` `raw={raw}` `watch_policy={watch_policy}` `watch_escalated={watch_escalated}` `should_merge={should_merge}`".format(
                decision=str(p_gate.get("decision") or "unknown"),
                raw=str(p_gate.get("raw_decision") or ""),
                watch_policy=str(p_gate.get("watch_policy") or ""),
                watch_escalated=bool_text(p_gate.get("watch_escalated", False)),
                should_merge=bool_text(p_gate.get("should_merge", False)),
            )
        )
        p_lanes = as_dict(parallel_summary.get("lanes"))
        lane_a = as_dict(p_lanes.get("lane_a"))
        lane_b = as_dict(p_lanes.get("lane_b"))
        lane_b_ui = as_dict(lane_b.get("ui_flow"))
        lane_c = as_dict(p_lanes.get("lane_c"))
        lane_c_case = as_dict(lane_c.get("case_selection"))
        lane_c_gate = as_dict(lane_c.get("gate_trend"))
        lines.append(
            "- duration: `total={total}s` `lane_a={lane_a}s` `lane_b={lane_b}s` `lane_b_node={lane_b_node}s` `lane_b_ui={lane_b_ui}s` `lane_c={lane_c}s` `lane_c_case={lane_c_case}s` `lane_c_gate={lane_c_gate}s`".format(
                total=as_int(parallel_summary.get("duration_sec"), 0),
                lane_a=as_int(lane_a.get("duration_sec"), 0),
                lane_b=as_int(lane_b.get("duration_sec"), 0),
                lane_b_node=as_int(lane_b.get("node_test_duration_sec"), 0),
                lane_b_ui=as_int(lane_b_ui.get("duration_sec"), 0),
                lane_c=as_int(lane_c.get("duration_sec"), 0),
                lane_c_case=as_int(lane_c_case.get("duration_sec"), 0),
                lane_c_gate=as_int(lane_c_gate.get("duration_sec"), 0),
            )
        )
        lines.append(
            "- fail_reasons: `{reasons}`".format(
                reasons=("none" if not p_fail_reasons else ",".join(p_fail_reasons)),
            )
        )
        lines.append(
            "- warning_codes: `{warnings}`".format(
                warnings=("none" if not p_warning_codes else ",".join(p_warning_codes)),
            )
        )
        lines.append(f"- failure_codes: `{fmt_counts(p_failure_codes)}`")
        lines.append(
            "- lanes: `A={a}` `B={b}` `B.ui={bui}` `C={c}`".format(
                a=str(lane_a.get("status") or "skipped"),
                b=str(lane_b.get("status") or "skipped"),
                bui=str(lane_b_ui.get("status") or "skipped"),
                c=str(lane_c.get("status") or "skipped"),
            )
        )
        lines.append(
            "- lane_b_ui_flow_checks: `enabled={enabled}` `mode={mode}` `timeout_ms={timeout}` `open_retries={open_retries}` `open_attempts={open_attempts}` `attr_complete={attr}` `interaction_complete={interaction}` `failure_code={code}`".format(
                enabled=bool_text(lane_b_ui.get("enabled", False)),
                mode=str(lane_b_ui.get("mode") or ""),
                timeout=as_int(lane_b_ui.get("timeout_ms"), 0),
                open_retries=as_int(lane_b_ui.get("open_retries"), 0),
                open_attempts=as_int(lane_b_ui.get("open_attempt_count"), 0),
                attr=bool_text(lane_b_ui.get("failure_attribution_complete", True)),
                interaction=bool_text(lane_b_ui.get("interaction_checks_complete", False)),
                code=str(lane_b_ui.get("failure_code") or "-"),
            )
        )
        lines.append(f"- lane_b_ui_flow_setup_exits: `{fmt_ui_flow_setup_exits(lane_b_ui)}`")
        lines.append(f"- lane_b_ui_flow_failure_stages: `{fmt_stage_counts(as_dict(lane_b_ui.get('failure_stage_counts')))}`")
        lines.append(
            "- lane_b_ui_flow_interaction_coverage: `{coverage}`".format(
                coverage=fmt_bool_coverage(as_dict(lane_b_ui.get("interaction_checks_coverage"))),
            )
        )
        lane_a_runtime = as_dict(lane_a.get("runtime_inputs"))
        if lane_a_runtime:
            lines.append(
                "- lane_a_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}`".format(
                    profile=str(lane_a_runtime.get("editor_gate_profile") or "<none>"),
                    step166=bool_text(lane_a_runtime.get("run_step166_gate", False)),
                    ui_flow=bool_text(lane_a_runtime.get("run_editor_ui_flow_smoke_gate", False)),
                    convert=bool_text(lane_a_runtime.get("editor_smoke_no_convert", False)),
                    perf=bool_text(lane_a_runtime.get("run_perf_trend", False)),
                    real_scene=bool_text(lane_a_runtime.get("run_real_scene_trend", False)),
                )
            )

    if roundtrip:
        totals = as_dict(roundtrip.get("totals"))
        failure_codes = as_dict(roundtrip.get("failure_code_counts"))
        rt_status = str(roundtrip.get("status") or "").strip()
        if not rt_status:
            fail_count = int(totals.get("fail", 0) or 0)
            rt_status = "FAIL" if fail_count > 0 else "PASS"
        first_code, first_name = find_first_roundtrip_failure(roundtrip)
        lines.append("")
        lines.append("## Roundtrip")
        lines.append(
            "- run: `run_id={run_id}` `mode={mode}` `status={status}`".format(
                run_id=roundtrip.get("run_id", ""),
                mode=roundtrip.get("mode", ""),
                status=rt_status,
            )
        )
        lines.append(
            "- totals: `pass={p}` `fail={f}` `skipped={s}`".format(
                p=int(totals.get("pass", 0) or 0),
                f=int(totals.get("fail", 0) or 0),
                s=int(totals.get("skipped", 0) or 0),
            )
        )
        lines.append(f"- failure_codes: `{fmt_counts(failure_codes)}`")
        rt_case_source = str(os.environ.get("EDITOR_SMOKE_CASE_SOURCE", "")).strip()
        rt_cases = str(
            os.environ.get("EDITOR_SMOKE_CASES_SELECTED", "")
            or os.environ.get("EDITOR_SMOKE_CASES", "")
        ).strip()
        rt_limit = as_int(os.environ.get("EDITOR_SMOKE_LIMIT", 0), 0)
        if rt_case_source or rt_cases or rt_limit > 0:
            lines.append(
                "- roundtrip_cases: `source={source}` `limit={limit}` `cases={cases}`".format(
                    source=(rt_case_source or "unknown"),
                    limit=rt_limit,
                    cases=rt_cases,
                )
            )
        rt_filters = as_dict(roundtrip.get("filters"))
        lines.append(
            "- roundtrip_filters: `priority_set={priority}` `tag_any={tags}`".format(
                priority=",".join(str(x) for x in as_list(rt_filters.get("priority_set"))) or "-",
                tags=",".join(str(x) for x in as_list(rt_filters.get("tag_any"))) or "-",
            )
        )
        rt_selection = as_dict(roundtrip.get("case_selection"))
        lines.append(
            "- roundtrip_case_selection: `selected={selected}` `matched={matched}` `candidate={candidate}` `total={total}` `fallback={fallback}`".format(
                selected=as_int(rt_selection.get("selected_count"), 0),
                matched=as_int(rt_selection.get("matched_count"), 0),
                candidate=as_int(rt_selection.get("filtered_count"), 0),
                total=as_int(rt_selection.get("total_input"), 0),
                fallback=bool_text(rt_selection.get("used_fallback", False)),
            )
        )
        rt_unsupported = summarize_roundtrip_unsupported(roundtrip)
        if rt_unsupported["cases_with_checks"] > 0:
            lines.append(
                "- roundtrip_unsupported: `cases_with_checks={cases}` `checked={checked}` `missing={missing}` `drifted={drifted}` `failed_cases={failed}`".format(
                    cases=rt_unsupported["cases_with_checks"],
                    checked=rt_unsupported["checked_entities"],
                    missing=rt_unsupported["missing_entities"],
                    drifted=rt_unsupported["drifted_entities"],
                    failed=rt_unsupported["failed_cases"],
                )
            )
        if first_code:
            lines.append(f"- first_failure: `code={first_code}` `case={first_name}`")

    if local_summary:
        local_gate_runtime = as_dict(local_summary.get("editorGateRuntime"))
        if not local_gate_runtime:
            local_gate_runtime = {
                "profile": str(local_summary.get("editorGateRuntimeProfile") or local_summary.get("editorGateProfile") or "<none>"),
                "step166_gate": bool(local_summary.get("editorGateRuntimeStep166Gate", local_summary.get("editorGateStep166Enabled", False))),
                "ui_flow_gate": bool(local_summary.get("editorGateRuntimeUiFlowGate", False)),
                "convert_disabled": bool(local_summary.get("editorGateRuntimeConvertDisabled", False)),
                "perf_trend": bool(local_summary.get("editorGateRuntimePerfTrend", False)),
                "real_scene_trend": bool(local_summary.get("editorGateRuntimeRealSceneTrend", False)),
                "source": str(local_summary.get("editorGateRuntimeSource") or "flat_fields"),
            }
        local_lane_runtime = as_dict(local_summary.get("editorParallelCycleLaneARuntime"))
        if not local_lane_runtime:
            local_lane_runtime = {
                "profile": str(local_summary.get("editorParallelCycleLaneARuntimeProfile") or "n/a"),
                "step166_gate": bool(local_summary.get("editorParallelCycleLaneARuntimeStep166Gate", False)),
                "ui_flow_gate": bool(local_summary.get("editorParallelCycleLaneARuntimeUiFlowGate", False)),
                "convert_disabled": bool(local_summary.get("editorParallelCycleLaneARuntimeConvertDisabled", False)),
                "perf_trend": bool(local_summary.get("editorParallelCycleLaneARuntimePerfTrend", False)),
                "real_scene_trend": bool(local_summary.get("editorParallelCycleLaneARuntimeRealSceneTrend", False)),
                "source": str(local_summary.get("editorParallelCycleLaneARuntimeSource") or "flat_fields"),
            }
        lines.append("")
        lines.append("## Local CI Runtime")
        lines.append(
            "- local_ci: `editor_gate_status={gate}` `parallel_cycle_status={parallel}`".format(
                gate=str(local_summary.get("editorGateStatus") or "unknown"),
                parallel=str(local_summary.get("editorParallelCycleStatus") or "unknown"),
            )
        )
        lines.append(
            "- local_parallel_cycle: `run_lane_a={a}` `run_lane_b={b}` `run_lane_c={c}` `decision={decision}` `raw={raw}` `watch_policy={watch}` `watch_escalated={escalated}`".format(
                a=bool_text(local_summary.get("editorParallelCycleRunLaneA", False)),
                b=bool_text(local_summary.get("editorParallelCycleRunLaneB", False)),
                c=bool_text(local_summary.get("editorParallelCycleRunLaneC", False)),
                decision=str(local_summary.get("editorParallelCycleGateDecision") or "unknown"),
                raw=str(local_summary.get("editorParallelCycleGateRawDecision") or "unknown"),
                watch=str(local_summary.get("editorParallelCycleGateWatchPolicy") or "observe"),
                escalated=bool_text(local_summary.get("editorParallelCycleGateWatchEscalated", False)),
            )
        )
        lines.append(
            "- local_parallel_cycle_duration: `total={total}s` `lane_a={lane_a}s` `lane_b={lane_b}s` `lane_b_node={lane_b_node}s` `lane_b_ui={lane_b_ui}s` `lane_c={lane_c}s` `lane_c_case={lane_c_case}s` `lane_c_gate={lane_c_gate}s`".format(
                total=as_int(local_summary.get("editorParallelCycleDurationSec"), 0),
                lane_a=as_int(local_summary.get("editorParallelCycleLaneADurationSec"), 0),
                lane_b=as_int(local_summary.get("editorParallelCycleLaneBDurationSec"), 0),
                lane_b_node=as_int(local_summary.get("editorParallelCycleLaneBNodeTestDurationSec"), 0),
                lane_b_ui=as_int(local_summary.get("editorParallelCycleLaneBUiFlowDurationSec"), 0),
                lane_c=as_int(local_summary.get("editorParallelCycleLaneCDurationSec"), 0),
                lane_c_case=as_int(local_summary.get("editorParallelCycleLaneCCaseSelectionDurationSec"), 0),
                lane_c_gate=as_int(local_summary.get("editorParallelCycleLaneCGateTrendDurationSec"), 0),
            )
        )
        lines.append(
            "- local_parallel_lane_b_ui_flow: `configured={configured}` `enabled={enabled}` `mode={mode}` `timeout_ms={timeout}` `attr_complete={attr}` `interaction_complete={interaction}`".format(
                configured=bool_text(local_summary.get("editorParallelCycleLaneBRunUiFlow", False)),
                enabled=bool_text(local_summary.get("editorParallelCycleLaneBUiFlowEnabled", local_summary.get("editorParallelCycleLaneBRunUiFlow", False))),
                mode=str(local_summary.get("editorParallelCycleLaneBUiFlowMode") or ""),
                timeout=as_int(local_summary.get("editorParallelCycleLaneBUiFlowTimeoutMs"), 0),
                attr=bool_text(local_summary.get("editorParallelCycleLaneBUiFlowFailureAttributionComplete", True)),
                interaction=bool_text(local_summary.get("editorParallelCycleLaneBUiFlowInteractionChecksComplete", False)),
            )
        )
        lines.append(
            "- local_parallel_lane_b_ui_setup_exits: `open={open}` `resize={resize}` `run_code={run_code}` `stage={stage}`".format(
                open=as_int(local_summary.get("editorParallelCycleLaneBUiFlowOpenExitCode"), 0),
                resize=as_int(local_summary.get("editorParallelCycleLaneBUiFlowResizeExitCode"), 0),
                run_code=as_int(local_summary.get("editorParallelCycleLaneBUiFlowRunCodeExitCode"), 0),
                stage=str(local_summary.get("editorParallelCycleLaneBUiFlowFailureStage") or "-"),
            )
        )
        lines.append(
            "- local_parallel_lane_b_ui_failure_stages: `{stages}`".format(
                stages=fmt_stage_counts(as_dict(local_summary.get("editorParallelCycleLaneBUiFlowFailureStageCounts"))),
            )
        )
        lines.append(
            "- local_parallel_lane_b_ui_interaction_checks: `{coverage}`".format(
                coverage=fmt_bool_coverage(as_dict(local_summary.get("editorParallelCycleLaneBUiFlowInteractionChecksCoverage"))),
            )
        )
        lines.append(
            "- local_gate_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}` `source={source}`".format(
                profile=str(local_gate_runtime.get("profile") or "<none>"),
                step166=bool_text(local_gate_runtime.get("step166_gate", False)),
                ui_flow=bool_text(local_gate_runtime.get("ui_flow_gate", False)),
                convert=bool_text(local_gate_runtime.get("convert_disabled", False)),
                perf=bool_text(local_gate_runtime.get("perf_trend", False)),
                real_scene=bool_text(local_gate_runtime.get("real_scene_trend", False)),
                source=str(local_gate_runtime.get("source") or "local_summary"),
            )
        )
        lines.append(
            "- local_gate_ui_flow_stage_trend: `status={status}` `recommended={recommended}` `effective={effective}` `source={source}` `applied={applied}` `enabled_samples={enabled}` `fail_ratio={fail_ratio:.3f}` `attribution_ratio={attr_ratio:.3f}`".format(
                status=str(local_summary.get("editorGateUiFlowStageTrendStatus") or "skipped"),
                recommended=str(local_summary.get("editorGateUiFlowStageTrendRecommendedMode") or "observe"),
                effective=str(local_summary.get("editorGateUiFlowStageTrendEffectiveMode") or "observe"),
                source=str(local_summary.get("editorGateUiFlowStageTrendGateSource") or "legacy"),
                applied=bool_text(local_summary.get("editorGateUiFlowStageTrendGateApplied", False)),
                enabled=as_int(local_summary.get("editorGateUiFlowStageTrendEnabledSamples"), 0),
                fail_ratio=as_float(local_summary.get("editorGateUiFlowStageTrendFailRatio"), 0.0),
                attr_ratio=as_float(local_summary.get("editorGateUiFlowStageTrendAttributionRatio"), 0.0),
            )
        )
        local_ui_stage_payload = {
            "days": as_int(local_summary.get("editorGateUiFlowStageTrendDaysInput"), 0),
            "status": str(local_summary.get("editorGateUiFlowStageTrendStatus") or ""),
            "recommended_gate_mode": str(local_summary.get("editorGateUiFlowStageTrendRecommendedMode") or ""),
            "summary_json": str(local_summary.get("editorGateUiFlowStageTrendJson") or ""),
            "summary_md": str(local_summary.get("editorGateUiFlowStageTrendMd") or ""),
            "enabled_samples_in_window": as_int(local_summary.get("editorGateUiFlowStageTrendEnabledSamples"), 0),
            "fail_ratio": as_float(local_summary.get("editorGateUiFlowStageTrendFailRatio"), None),
            "attribution_ratio": as_float(local_summary.get("editorGateUiFlowStageTrendAttributionRatio"), None),
            "failure_stage_counts": as_dict(local_summary.get("editorGateUiFlowStageTrendFailureStageCounts")),
            "first_failure_stage_counts": {},
            "setup_exit_nonzero_runs": {},
        }
        local_ui_stage_ok, local_ui_stage_issues = validate_ui_stage_trend_contract(local_ui_stage_payload)
        lines.append(
            "- local_gate_ui_flow_stage_trend_contract: `ok={ok}` `issues={issues}`".format(
                ok=bool_text(local_ui_stage_ok),
                issues=("none" if not local_ui_stage_issues else ",".join(local_ui_stage_issues)),
            )
        )
        lines.append(
            "- local_gate_ui_flow_stage_trend_counts: `{stages}`".format(
                stages=fmt_stage_counts(as_dict(local_summary.get("editorGateUiFlowStageTrendFailureStageCounts"))),
            )
        )
        lines.append(
            "- local_parallel_lane_a_runtime: `profile={profile}` `step166_gate={step166}` `ui_flow_gate={ui_flow}` `convert_disabled={convert}` `perf_trend={perf}` `real_scene_trend={real_scene}` `source={source}`".format(
                profile=str(local_lane_runtime.get("profile") or "n/a"),
                step166=bool_text(local_lane_runtime.get("step166_gate", False)),
                ui_flow=bool_text(local_lane_runtime.get("ui_flow_gate", False)),
                convert=bool_text(local_lane_runtime.get("convert_disabled", False)),
                perf=bool_text(local_lane_runtime.get("perf_trend", False)),
                real_scene=bool_text(local_lane_runtime.get("real_scene_trend", False)),
                source=str(local_lane_runtime.get("source") or "local_summary"),
            )
        )
        local_ui_flow_codes = as_dict(local_summary.get("editorUiFlowSmokeFailureCodeCounts"))
        local_ui_flow_coverage = as_dict(local_summary.get("editorUiFlowSmokeInteractionChecksCoverage"))
        lines.append(
            "- local_ui_flow_smoke: `status={status}` `run_id={run_id}` `ok={ok}` `open_retries={open_retries}` `open_attempts={open_attempts}` `gate_runs={runs}` `gate_fail={fail}` `failure_codes={codes}`".format(
                status=str(local_summary.get("editorUiFlowSmokeStatus") or "unknown"),
                run_id=str(local_summary.get("editorUiFlowSmokeRunId") or ""),
                ok=bool_text(local_summary.get("editorUiFlowSmokeOk", False)),
                open_retries=as_int(local_summary.get("editorUiFlowSmokeOpenRetries"), 0),
                open_attempts=as_int(local_summary.get("editorUiFlowSmokeOpenAttemptCount"), 0),
                runs=as_int(local_summary.get("editorUiFlowSmokeGateRunCount"), 0),
                fail=as_int(local_summary.get("editorUiFlowSmokeGateFailCount"), 0),
                codes=fmt_counts(local_ui_flow_codes),
            )
        )
        lines.append(
            "- local_ui_flow_attribution: `complete={complete}` `code_total={total}` `interaction_complete={interaction}`".format(
                complete=bool_text(local_summary.get("editorUiFlowSmokeFailureAttributionComplete", True)),
                total=as_int(local_summary.get("editorUiFlowSmokeFailureCodeCount"), 0),
                interaction=bool_text(local_summary.get("editorUiFlowSmokeInteractionChecksComplete", False)),
            )
        )
        lines.append(
            "- local_gate_ui_flow_setup_exits: `open={open}` `resize={resize}` `run_code={run_code}` `open_attempts={open_attempts}` `stage={stage}`".format(
                open=as_int(local_summary.get("editorGateUiFlowOpenExitCode"), 0),
                resize=as_int(local_summary.get("editorGateUiFlowResizeExitCode"), 0),
                run_code=as_int(local_summary.get("editorGateUiFlowRunCodeExitCode"), 0),
                open_attempts=as_int(local_summary.get("editorGateUiFlowOpenAttemptCount"), 0),
                stage=str(local_summary.get("editorGateUiFlowFirstFailureStage") or "-"),
            )
        )
        lines.append(
            "- local_gate_ui_flow_failure_stages: `{stages}`".format(
                stages=fmt_stage_counts(as_dict(local_summary.get("editorGateUiFlowFailureStageCounts"))),
            )
        )
        lines.append(
            "- local_ui_flow_interaction_checks: `{coverage}`".format(
                coverage=fmt_bool_coverage(local_ui_flow_coverage),
            )
        )
        lines.append(
            "- local_summary_core: `offline={offline}` `validation_fail_count={fails}` `missing_scenes={missing}`".format(
                offline=bool_text(local_summary.get("offline", False)),
                fails=as_int(local_summary.get("validationFailCount"), 0),
                missing=len(as_list(local_summary.get("missingScenes"))),
            )
        )
        append_preview_lane_line(
            lines,
            "local_step186_preview_artifact_prep",
            {
                "enabled": local_summary.get("runStep186PreviewArtifactPrep", False),
                "status": local_summary.get("step186PreviewArtifactPrepStatus", ""),
                "run_id": local_summary.get("step186PreviewArtifactPrepRunId", ""),
                "case_count": local_summary.get("step186PreviewArtifactPrepCaseCount", 0),
                "pass_count": local_summary.get("step186PreviewArtifactPrepPassCount", 0),
                "fail_count": local_summary.get("step186PreviewArtifactPrepFailCount", 0),
                "first_failed_case": local_summary.get("step186PreviewArtifactPrepFirstFailedCase", ""),
                "summary_json": local_summary.get("step186PreviewArtifactPrepSummaryJson", ""),
            },
        )
        append_preview_lane_line(
            lines,
            "local_preview_provenance_smoke",
            {
                "enabled": local_summary.get("runPreviewProvenanceSmoke", False),
                "status": local_summary.get("previewProvenanceSmokeStatus", ""),
                "run_id": local_summary.get("previewProvenanceSmokeRunId", ""),
                "case_count": local_summary.get("previewProvenanceSmokeCaseCount", 0),
                "pass_count": local_summary.get("previewProvenanceSmokePassCount", 0),
                "fail_count": local_summary.get("previewProvenanceSmokeFailCount", 0),
                "initial_entry_case_count": local_summary.get("previewProvenanceSmokeInitialEntryCaseCount", 0),
                "deterministic_entry_case_count": local_summary.get("previewProvenanceSmokeDeterministicEntryCaseCount", 0),
                "focus_check_case_count": local_summary.get("previewProvenanceSmokeFocusCheckCaseCount", 0),
                "first_failed_case": local_summary.get("previewProvenanceSmokeFirstFailedCase", ""),
                "summary_json": local_summary.get("previewProvenanceSmokeSummaryJson", ""),
            },
        )
        append_dwg_lane_line(
            lines,
            "local_dwg_open_smoke",
            {
                "enabled": local_summary.get("runDwgOpenSmoke", False),
                "status": local_summary.get("dwgOpenSmokeStatus", ""),
                "run_id": local_summary.get("dwgOpenSmokeRunId", ""),
                "summary_json": local_summary.get("dwgOpenSmokeSummaryJson", ""),
                "input_dwg": local_summary.get("dwgOpenSmokeInputDwg", ""),
                "dwg_convert_ok": local_summary.get("dwgOpenSmokeDwgConvertOk", False),
                "router_ok": local_summary.get("dwgOpenSmokeRouterOk", False),
                "convert_ok": local_summary.get("dwgOpenSmokeConvertOk", False),
                "viewer_ok": local_summary.get("dwgOpenSmokeViewerOk", False),
                "validator_ok_count": local_summary.get("dwgOpenSmokeValidatorOkCount", 0),
                "error": local_summary.get("dwgOpenSmokeError", ""),
            },
        )
        append_dwg_lane_line(
            lines,
            "local_dwg_open_desktop_smoke",
            {
                "enabled": local_summary.get("runDwgOpenDesktopSmoke", False),
                "status": local_summary.get("dwgOpenDesktopSmokeStatus", ""),
                "run_id": local_summary.get("dwgOpenDesktopSmokeRunId", ""),
                "summary_json": local_summary.get("dwgOpenDesktopSmokeSummaryJson", ""),
                "input_dwg": local_summary.get("dwgOpenDesktopSmokeInputDwg", ""),
                "desktop_ok": local_summary.get("dwgOpenDesktopSmokeDesktopOk", False),
                "manifest_ok": local_summary.get("dwgOpenDesktopSmokeManifestOk", False),
                "preview_artifacts_ok": local_summary.get("dwgOpenDesktopSmokePreviewArtifactsOk", False),
                "validator_ok_count": local_summary.get("dwgOpenDesktopSmokeValidatorOkCount", 0),
                "error": local_summary.get("dwgOpenDesktopSmokeError", ""),
            },
            desktop=True,
        )
        append_dwg_lane_line(
            lines,
            "local_dwg_open_matrix_smoke",
            {
                "enabled": local_summary.get("runDwgOpenMatrixSmoke", False),
                "status": local_summary.get("dwgOpenMatrixSmokeStatus", ""),
                "run_id": local_summary.get("dwgOpenMatrixSmokeRunId", ""),
                "summary_json": local_summary.get("dwgOpenMatrixSmokeSummaryJson", ""),
                "case_count": local_summary.get("dwgOpenMatrixSmokeCaseCount", 0),
                "pass_count": local_summary.get("dwgOpenMatrixSmokePassCount", 0),
                "fail_count": local_summary.get("dwgOpenMatrixSmokeFailCount", 0),
                "validator_ok_count": local_summary.get("dwgOpenMatrixSmokeValidatorOkCount", 0),
                "dwg_convert_ok_count": local_summary.get("dwgOpenMatrixSmokeDwgConvertOkCount", 0),
                "router_ok_count": local_summary.get("dwgOpenMatrixSmokeRouterOkCount", 0),
                "convert_ok_count": local_summary.get("dwgOpenMatrixSmokeConvertOkCount", 0),
                "viewer_ok_count": local_summary.get("dwgOpenMatrixSmokeViewerOkCount", 0),
                "first_failed_case": local_summary.get("dwgOpenMatrixSmokeFirstFailedCase", ""),
                "error": local_summary.get("dwgOpenMatrixSmokeError", ""),
            },
        )
        append_solver_action_lane_line(
            lines,
            "local_solver_action_panel_smoke",
            {
                "enabled": local_summary.get("runSolverActionPanelSmoke", False),
                "status": local_summary.get("solverActionPanelSmokeStatus", ""),
                "run_id": local_summary.get("solverActionPanelSmokeRunId", ""),
                "summary_json": local_summary.get("solverActionPanelSmokeSummaryJson", ""),
                "panel_count": local_summary.get("solverActionPanelSmokePanelCount", 0),
                "flow_check_count": local_summary.get("solverActionPanelSmokeFlowCheckCount", 0),
                "request_count": local_summary.get("solverActionPanelSmokeRequestCount", 0),
                "invoke_request_count": local_summary.get("solverActionPanelSmokeInvokeRequestCount", 0),
                "focus_request_count": local_summary.get("solverActionPanelSmokeFocusRequestCount", 0),
                "flow_request_count": local_summary.get("solverActionPanelSmokeFlowRequestCount", 0),
                "replay_request_count": local_summary.get("solverActionPanelSmokeReplayRequestCount", 0),
                "import_check_count": local_summary.get("solverActionPanelSmokeImportCheckCount", 0),
                "clear_check_count": local_summary.get("solverActionPanelSmokeClearCheckCount", 0),
                "jump_request_count": local_summary.get("solverActionPanelSmokeJumpRequestCount", 0),
                "dom_event_count": local_summary.get("solverActionPanelSmokeDomEventCount", 0),
                "dom_request_event_count": local_summary.get("solverActionPanelSmokeDomRequestEventCount", 0),
                "dom_action_event_count": local_summary.get("solverActionPanelSmokeDomActionEventCount", 0),
                "dom_focus_event_count": local_summary.get("solverActionPanelSmokeDomFocusEventCount", 0),
                "dom_flow_event_count": local_summary.get("solverActionPanelSmokeDomFlowEventCount", 0),
                "dom_replay_event_count": local_summary.get("solverActionPanelSmokeDomReplayEventCount", 0),
                "event_count": local_summary.get("solverActionPanelSmokeEventCount", 0),
                "invoke_event_count": local_summary.get("solverActionPanelSmokeInvokeEventCount", 0),
                "focus_event_count": local_summary.get("solverActionPanelSmokeFocusEventCount", 0),
                "flow_event_count": local_summary.get("solverActionPanelSmokeFlowEventCount", 0),
                "replay_event_count": local_summary.get("solverActionPanelSmokeReplayEventCount", 0),
                "next_check_count": local_summary.get("solverActionPanelSmokeNextCheckCount", 0),
                "jump_check_count": local_summary.get("solverActionPanelSmokeJumpCheckCount", 0),
                "rewind_check_count": local_summary.get("solverActionPanelSmokeRewindCheckCount", 0),
                "restart_check_count": local_summary.get("solverActionPanelSmokeRestartCheckCount", 0),
                "replay_check_count": local_summary.get("solverActionPanelSmokeReplayCheckCount", 0),
                "event_focus_check_count": local_summary.get("solverActionPanelSmokeEventFocusCheckCount", 0),
                "banner_check_count": local_summary.get("solverActionPanelSmokeBannerCheckCount", 0),
                "banner_event_focus_check_count": local_summary.get("solverActionPanelSmokeBannerEventFocusCheckCount", 0),
                "banner_focus_click_check_count": local_summary.get("solverActionPanelSmokeBannerFocusClickCheckCount", 0),
                "console_check_count": local_summary.get("solverActionPanelSmokeConsoleCheckCount", 0),
                "console_flow_check_count": local_summary.get("solverActionPanelSmokeConsoleFlowCheckCount", 0),
                "console_event_focus_check_count": local_summary.get("solverActionPanelSmokeConsoleEventFocusCheckCount", 0),
                "console_replay_check_count": local_summary.get("solverActionPanelSmokeConsoleReplayCheckCount", 0),
                "console_event_click_check_count": local_summary.get("solverActionPanelSmokeConsoleEventClickCheckCount", 0),
                "console_focus_click_check_count": local_summary.get("solverActionPanelSmokeConsoleFocusClickCheckCount", 0),
                "console_selection_check_count": local_summary.get("solverActionPanelSmokeConsoleSelectionCheckCount", 0),
                "status_check_count": local_summary.get("solverActionPanelSmokeStatusCheckCount", 0),
                "status_click_check_count": local_summary.get("solverActionPanelSmokeStatusClickCheckCount", 0),
                "keyboard_check_count": local_summary.get("solverActionPanelSmokeKeyboardCheckCount", 0),
                "panel_cycle_check_count": local_summary.get("solverActionPanelSmokePanelCycleCheckCount", 0),
                "panel_keyboard_check_count": local_summary.get("solverActionPanelSmokePanelKeyboardCheckCount", 0),
                "panel_keyboard_invoke_check_count": local_summary.get("solverActionPanelSmokePanelKeyboardInvokeCheckCount", 0),
                "panel_keyboard_flow_check_count": local_summary.get("solverActionPanelSmokePanelKeyboardFlowCheckCount", 0),
                "keyboard_banner_check_count": local_summary.get("solverActionPanelSmokeKeyboardBannerCheckCount", 0),
                "keyboard_jump_check_count": local_summary.get("solverActionPanelSmokeKeyboardJumpCheckCount", 0),
                "keyboard_event_focus_check_count": local_summary.get("solverActionPanelSmokeKeyboardEventFocusCheckCount", 0),
                "jump_event_count": local_summary.get("solverActionPanelSmokeJumpEventCount", 0),
                "visited_panel_count": local_summary.get("solverActionPanelSmokeVisitedPanelCount", 0),
            },
        )
        append_preview_lane_line(
            lines,
            "local_preview_provenance_failure_injection",
            {
                "enabled": local_summary.get("runPreviewProvenanceFailureInjection", False),
                "status": local_summary.get("previewProvenanceFailureInjectionStatus", ""),
                "run_id": local_summary.get("previewProvenanceFailureInjectionRunId", ""),
                "case_count": local_summary.get("previewProvenanceFailureInjectionCaseCount", 0),
                "pass_count": local_summary.get("previewProvenanceFailureInjectionPassCount", 0),
                "fail_count": local_summary.get("previewProvenanceFailureInjectionFailCount", 0),
                "first_failed_case": local_summary.get("previewProvenanceFailureInjectionFirstFailedCase", ""),
                "summary_json": local_summary.get("previewProvenanceFailureInjectionSummaryJson", ""),
            },
        )
        append_preview_lane_line(
            lines,
            "local_preview_artifact_smoke",
            {
                "enabled": local_summary.get("runPreviewArtifactSmoke", False),
                "status": local_summary.get("previewArtifactSmokeStatus", ""),
                "run_id": local_summary.get("previewArtifactSmokeRunId", ""),
                "case_count": local_summary.get("previewArtifactSmokeCaseCount", 0),
                "pass_count": local_summary.get("previewArtifactSmokePassCount", 0),
                "fail_count": local_summary.get("previewArtifactSmokeFailCount", 0),
                "first_failed_case": local_summary.get("previewArtifactSmokeFirstFailedCase", ""),
                "summary_json": local_summary.get("previewArtifactSmokeSummaryJson", ""),
            },
        )
        append_preview_lane_line(
            lines,
            "local_preview_artifact_validator_failure_injection",
            {
                "enabled": local_summary.get("runPreviewArtifactValidatorFailureInjection", False),
                "status": local_summary.get("previewArtifactValidatorFailureInjectionStatus", ""),
                "run_id": local_summary.get("previewArtifactValidatorFailureInjectionRunId", ""),
                "case_count": local_summary.get("previewArtifactValidatorFailureInjectionCaseCount", 0),
                "pass_count": local_summary.get("previewArtifactValidatorFailureInjectionPassCount", 0),
                "fail_count": local_summary.get("previewArtifactValidatorFailureInjectionFailCount", 0),
                "first_failed_case": local_summary.get("previewArtifactValidatorFailureInjectionFirstFailedCase", ""),
                "summary_json": local_summary.get("previewArtifactValidatorFailureInjectionSummaryJson", ""),
            },
        )
        append_ctest_lane_line(
            lines,
            "local_ctest_assembly_roundtrip",
            {
                "enabled": True,
                "status": local_summary.get("ctestAssemblyRoundtripStatus", ""),
                "case_count": local_summary.get("ctestAssemblyRoundtripCaseCount", 0),
                "pass_count": local_summary.get("ctestAssemblyRoundtripPassCount", 0),
                "fail_count": local_summary.get("ctestAssemblyRoundtripFailCount", 0),
                "missing_count": local_summary.get("ctestAssemblyRoundtripMissingCount", 0),
                "first_failed_case": local_summary.get("ctestAssemblyRoundtripFirstFailedCase", ""),
                "model_status": local_summary.get("ctestAssemblyRoundtripModelStatus", ""),
                "paperspace_status": local_summary.get("ctestAssemblyRoundtripPaperspaceStatus", ""),
                "mixed_status": local_summary.get("ctestAssemblyRoundtripMixedStatus", ""),
                "dense_status": local_summary.get("ctestAssemblyRoundtripDenseStatus", ""),
                "summary_json_count": local_summary.get("ctestAssemblyRoundtripSummaryJsonCount", 0),
                "import_assembly_tracked_count": local_summary.get("ctestAssemblyRoundtripImportAssemblyTrackedCount", 0),
                "import_assembly_group_count": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupCount", 0),
                "import_assembly_group_source_counts_b64": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupSourceCountsB64", ""),
                "import_assembly_group_layout_source_counts_b64": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupLayoutSourceCountsB64", ""),
                "import_assembly_group_source_case_count": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupSourceCaseCount", 0),
                "import_assembly_group_source_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupSourceCaseDetailsB64", ""),
                "import_assembly_group_layout_source_case_count": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupLayoutSourceCaseCount", 0),
                "import_assembly_group_layout_source_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportAssemblyGroupLayoutSourceCaseDetailsB64", ""),
                "import_derived_proxy_count": local_summary.get("ctestAssemblyRoundtripImportDerivedProxyCount", 0),
                "import_proxy_kind_counts_b64": local_summary.get("ctestAssemblyRoundtripImportProxyKindCountsB64", ""),
                "import_proxy_kind_case_count": local_summary.get("ctestAssemblyRoundtripImportProxyKindCaseCount", 0),
                "import_proxy_kind_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportProxyKindCaseDetailsB64", ""),
                "import_proxy_layout_kind_counts_b64": local_summary.get("ctestAssemblyRoundtripImportProxyLayoutKindCountsB64", ""),
                "import_proxy_layout_case_count": local_summary.get("ctestAssemblyRoundtripImportProxyLayoutCaseCount", 0),
                "import_proxy_layout_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportProxyLayoutCaseDetailsB64", ""),
                "import_text_kind_counts_b64": local_summary.get("ctestAssemblyRoundtripImportTextKindCountsB64", ""),
                "import_text_kind_layout_counts_b64": local_summary.get("ctestAssemblyRoundtripImportTextKindLayoutCountsB64", ""),
                "import_text_kind_case_count": local_summary.get("ctestAssemblyRoundtripImportTextKindCaseCount", 0),
                "import_text_kind_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportTextKindCaseDetailsB64", ""),
                "import_exploded_origin_count": local_summary.get("ctestAssemblyRoundtripImportExplodedOriginCount", 0),
                "import_exploded_layout_source_counts_b64": local_summary.get("ctestAssemblyRoundtripImportExplodedLayoutSourceCountsB64", ""),
                "import_exploded_layout_source_case_count": local_summary.get("ctestAssemblyRoundtripImportExplodedLayoutSourceCaseCount", 0),
                "import_exploded_layout_source_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportExplodedLayoutSourceCaseDetailsB64", ""),
                "import_viewport_count": local_summary.get("ctestAssemblyRoundtripImportViewportCount", 0),
                "import_viewport_layout_count": local_summary.get("ctestAssemblyRoundtripImportViewportLayoutCount", 0),
                "import_viewport_case_count": local_summary.get("ctestAssemblyRoundtripImportViewportCaseCount", 0),
                "import_viewport_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportViewportCaseDetailsB64", ""),
                "import_viewport_proxy_kind_counts_b64": local_summary.get("ctestAssemblyRoundtripImportViewportProxyKindCountsB64", ""),
                "import_viewport_proxy_layout_kind_counts_b64": local_summary.get("ctestAssemblyRoundtripImportViewportProxyLayoutKindCountsB64", ""),
                "import_viewport_proxy_case_count": local_summary.get("ctestAssemblyRoundtripImportViewportProxyCaseCount", 0),
                "import_viewport_proxy_case_details_b64": local_summary.get("ctestAssemblyRoundtripImportViewportProxyCaseDetailsB64", ""),
                "export_assembly_checked_count": local_summary.get("ctestAssemblyRoundtripExportAssemblyCheckedCount", 0),
                "export_assembly_group_count": local_summary.get("ctestAssemblyRoundtripExportAssemblyGroupCount", 0),
                "export_metadata_drift_count": local_summary.get("ctestAssemblyRoundtripExportMetadataDriftCount", 0),
                "export_group_drift_count": local_summary.get("ctestAssemblyRoundtripExportGroupDriftCount", 0),
                "model_summary_json": local_summary.get("ctestAssemblyRoundtripModelSummaryJson", ""),
                "paperspace_summary_json": local_summary.get("ctestAssemblyRoundtripPaperspaceSummaryJson", ""),
                "mixed_summary_json": local_summary.get("ctestAssemblyRoundtripMixedSummaryJson", ""),
                "dense_summary_json": local_summary.get("ctestAssemblyRoundtripDenseSummaryJson", ""),
                "model_case_name": local_summary.get("ctestAssemblyRoundtripModelCaseName", ""),
                "paperspace_case_name": local_summary.get("ctestAssemblyRoundtripPaperspaceCaseName", ""),
                "mixed_case_name": local_summary.get("ctestAssemblyRoundtripMixedCaseName", ""),
                "dense_case_name": local_summary.get("ctestAssemblyRoundtripDenseCaseName", ""),
                "build_dir": local_summary.get("buildDir", ""),
            },
        )
        append_simple_ctest_lane_line(
            lines,
            "local_ctest_constraints_basic",
            {
                "enabled": True,
                "status": local_summary.get("ctestConstraintsBasicStatus", ""),
                "case_count": 1 if str(local_summary.get("ctestConstraintsBasicStatus", "")).strip() else 0,
                "pass_count": 1 if str(local_summary.get("ctestConstraintsBasicStatus", "")).strip() == "ok" else 0,
                "fail_count": 1 if str(local_summary.get("ctestConstraintsBasicStatus", "")).strip() == "fail" else 0,
                "missing_count": 1 if str(local_summary.get("ctestConstraintsBasicStatus", "")).strip() == "missing" else 0,
                "first_failed_case": "constraints_basic" if str(local_summary.get("ctestConstraintsBasicStatus", "")).strip() in ("fail", "missing") else "",
                "test_name": "core_tests_constraints_basic",
                "build_dir": local_summary.get("buildDir", ""),
            },
        )

    lines.append("")
    lines.append("## Artifacts")
    if args.gate_summary:
        lines.append(f"- gate_summary: `{args.gate_summary}`")
    if args.parallel_summary:
        lines.append(f"- parallel_summary: `{args.parallel_summary}`")
    if args.roundtrip_summary:
        lines.append(f"- roundtrip_summary: `{args.roundtrip_summary}`")
    if args.local_summary:
        lines.append(f"- local_summary: `{args.local_summary}`")

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Write CI artifact summary markdown.")
    parser.add_argument("--title", default="CADGameFusion CI Artifact Summary")
    parser.add_argument("--mode", default="observe", choices=["observe", "gate"])
    parser.add_argument("--gate-summary", default="")
    parser.add_argument("--parallel-summary", default="")
    parser.add_argument("--roundtrip-summary", default="")
    parser.add_argument("--local-summary", default="")
    parser.add_argument("--out", default="")
    parser.add_argument("--append-github-step-summary", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    gate = load_json(args.gate_summary)
    parallel_summary = load_json(args.parallel_summary)
    roundtrip = load_json(args.roundtrip_summary)
    local_summary = load_json(args.local_summary)

    output = render(args, gate, roundtrip, parallel_summary, local_summary)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        print(str(out_path))
    else:
        print(output, end="")

    if args.append_github_step_summary:
        gh = os.environ.get("GITHUB_STEP_SUMMARY", "").strip()
        if gh:
            with open(gh, "a", encoding="utf-8") as handle:
                handle.write("\n")
                handle.write(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
