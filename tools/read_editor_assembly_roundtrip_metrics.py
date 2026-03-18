#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import shlex
import sys
from pathlib import Path


LANES = {
    "model": "editor_assembly_roundtrip_smoke",
    "paperspace": "editor_assembly_roundtrip_paperspace_smoke",
    "mixed": "editor_assembly_roundtrip_mixed_smoke",
    "dense": "editor_assembly_roundtrip_dense_smoke",
}


def as_int(value) -> int:
    try:
        return int(value or 0)
    except Exception:
        return 0


def encode_json_base64(value) -> str:
    try:
        raw = json.dumps(value, separators=(",", ":"), ensure_ascii=True)
    except Exception:
        raw = "[]"
    return base64.b64encode(raw.encode("utf-8")).decode("ascii")


def normalize_count_map(value) -> dict[str, int]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, int] = {}
    for raw_key, raw_value in value.items():
        key = str(raw_key or "").strip()
        if not key:
            continue
        count = as_int(raw_value)
        if count <= 0:
            continue
        out[key] = out.get(key, 0) + count
    return dict(sorted(out.items()))


def merge_count_map(target: dict[str, int], source: dict[str, int]) -> None:
    for key, value in normalize_count_map(source).items():
        target[key] = target.get(key, 0) + value
    if target:
        items = sorted(target.items())
        target.clear()
        target.update(items)


def normalize_nested_count_map(value) -> dict[str, dict[str, int]]:
    if not isinstance(value, dict):
        return {}
    out: dict[str, dict[str, int]] = {}
    for raw_outer_key, raw_inner in value.items():
        outer_key = str(raw_outer_key or "").strip()
        if not outer_key:
            continue
        normalized_inner = normalize_count_map(raw_inner)
        if not normalized_inner:
            continue
        out[outer_key] = normalized_inner
    return dict(sorted(out.items()))


def merge_nested_count_map(target: dict[str, dict[str, int]], source) -> None:
    for outer_key, inner in normalize_nested_count_map(source).items():
        slot = target.setdefault(outer_key, {})
        merge_count_map(slot, inner)
    if target:
        items = sorted(target.items())
        target.clear()
        target.update(items)


def newest_summary_json(lane_dir: Path) -> Path | None:
    if not lane_dir.exists():
        return None
    candidates = sorted(lane_dir.glob("*/summary.json"))
    return candidates[-1] if candidates else None


def read_lane_payload(summary_path: Path | None) -> dict:
    payload = {
        "summary_json": "",
        "case_name": "",
        "import_entity_count": 0,
        "import_unsupported_count": 0,
        "import_derived_proxy_count": 0,
        "import_exploded_origin_count": 0,
        "import_assembly_tracked_count": 0,
        "import_assembly_group_count": 0,
        "import_assembly_group_source_counts": {},
        "import_assembly_group_source_case_count": 0,
        "import_assembly_group_source_case_details": [],
        "import_proxy_kind_counts": {},
        "import_proxy_kind_case_count": 0,
        "import_proxy_kind_case_details": [],
        "import_proxy_layout_kind_counts": {},
        "import_proxy_layout_case_count": 0,
        "import_proxy_layout_case_details": [],
        "import_exploded_layout_source_counts": {},
        "import_exploded_layout_source_case_count": 0,
        "import_exploded_layout_source_case_details": [],
        "import_text_kind_counts": {},
        "import_text_kind_layout_counts": {},
        "import_text_kind_case_count": 0,
        "import_text_kind_case_details": [],
        "import_assembly_group_layout_source_counts": {},
        "import_assembly_group_layout_source_case_count": 0,
        "import_assembly_group_layout_source_case_details": [],
        "import_viewport_count": 0,
        "import_viewport_layout_count": 0,
        "import_viewport_case_count": 0,
        "import_viewport_case_details": [],
        "import_viewport_proxy_kind_counts": {},
        "import_viewport_proxy_layout_kind_counts": {},
        "import_viewport_proxy_case_count": 0,
        "import_viewport_proxy_case_details": [],
        "export_derived_proxy_checked_count": 0,
        "export_exploded_checked_count": 0,
        "export_assembly_checked_count": 0,
        "export_assembly_group_count": 0,
        "export_metadata_drift_count": 0,
        "export_group_drift_count": 0,
    }
    if summary_path is None or not summary_path.exists():
        return payload

    root = json.loads(summary_path.read_text())
    results = root.get("results") or []
    case_names = []
    for result in results:
        imported = result.get("import") or {}
        exported = result.get("export") or {}
        derived = exported.get("derived_proxy_semantics") or {}
        exploded = exported.get("exploded_origin_editability") or {}
        assembly = exported.get("assembly_roundtrip_semantics") or {}
        case_name = str(result.get("name") or "").strip()
        if case_name:
            case_names.append(case_name)
        payload["import_entity_count"] += as_int(imported.get("entity_count"))
        payload["import_unsupported_count"] += as_int(imported.get("unsupported_count"))
        payload["import_derived_proxy_count"] += as_int(imported.get("derived_proxy_count"))
        payload["import_exploded_origin_count"] += as_int(imported.get("exploded_origin_count"))
        payload["import_assembly_tracked_count"] += as_int(imported.get("assembly_tracked_count"))
        payload["import_assembly_group_count"] += as_int(imported.get("assembly_group_count"))
        group_source_counts = normalize_count_map(imported.get("assembly_group_source_counts"))
        merge_count_map(payload["import_assembly_group_source_counts"], group_source_counts)
        proxy_kind_counts = normalize_count_map(imported.get("derived_proxy_kind_counts"))
        merge_count_map(payload["import_proxy_kind_counts"], proxy_kind_counts)
        proxy_layout_kind_counts = normalize_nested_count_map(imported.get("derived_proxy_layout_kind_counts"))
        merge_nested_count_map(payload["import_proxy_layout_kind_counts"], proxy_layout_kind_counts)
        if proxy_kind_counts:
            payload["import_proxy_kind_case_count"] += 1
            payload["import_proxy_kind_case_details"].append(
                {
                    "case_name": case_name,
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "derived_proxy_layout_kind_counts": proxy_layout_kind_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        if proxy_layout_kind_counts:
            payload["import_proxy_layout_case_count"] += 1
            payload["import_proxy_layout_case_details"].append(
                {
                    "case_name": case_name,
                    "derived_proxy_layout_kind_counts": proxy_layout_kind_counts,
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        exploded_layout_source_counts = normalize_nested_count_map(imported.get("exploded_origin_layout_source_counts"))
        merge_nested_count_map(payload["import_exploded_layout_source_counts"], exploded_layout_source_counts)
        if exploded_layout_source_counts:
            payload["import_exploded_layout_source_case_count"] += 1
            payload["import_exploded_layout_source_case_details"].append(
                {
                    "case_name": case_name,
                    "exploded_origin_layout_source_counts": exploded_layout_source_counts,
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "derived_proxy_kind_counts": proxy_kind_counts,
                }
            )
        text_kind_counts = normalize_count_map(imported.get("text_kind_counts"))
        merge_count_map(payload["import_text_kind_counts"], text_kind_counts)
        text_kind_layout_counts = normalize_nested_count_map(imported.get("text_kind_layout_counts"))
        merge_nested_count_map(payload["import_text_kind_layout_counts"], text_kind_layout_counts)
        if text_kind_counts:
            payload["import_text_kind_case_count"] += 1
            payload["import_text_kind_case_details"].append(
                {
                    "case_name": case_name,
                    "text_kind_counts": text_kind_counts,
                    "text_kind_layout_counts": text_kind_layout_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "derived_proxy_layout_kind_counts": proxy_layout_kind_counts,
                }
            )
        group_layout_source_counts = normalize_nested_count_map(imported.get("assembly_group_layout_source_counts"))
        merge_nested_count_map(payload["import_assembly_group_layout_source_counts"], group_layout_source_counts)
        if group_layout_source_counts:
            payload["import_assembly_group_layout_source_case_count"] += 1
            payload["import_assembly_group_layout_source_case_details"].append(
                {
                    "case_name": case_name,
                    "assembly_group_layout_source_counts": group_layout_source_counts,
                    "assembly_group_source_counts": group_source_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        if group_source_counts:
            payload["import_assembly_group_source_case_count"] += 1
            payload["import_assembly_group_source_case_details"].append(
                {
                    "case_name": case_name,
                    "assembly_group_source_counts": group_source_counts,
                    "assembly_group_layout_source_counts": group_layout_source_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        payload["import_viewport_count"] += as_int(imported.get("viewport_count"))
        payload["import_viewport_layout_count"] += as_int(imported.get("viewport_layout_count"))
        viewport_count = as_int(imported.get("viewport_count"))
        viewport_layout_count = as_int(imported.get("viewport_layout_count"))
        viewport_layouts = imported.get("viewport_layouts") if isinstance(imported.get("viewport_layouts"), list) else []
        if viewport_count > 0:
            payload["import_viewport_case_count"] += 1
            payload["import_viewport_case_details"].append(
                {
                    "case_name": case_name,
                    "viewport_count": viewport_count,
                    "viewport_layout_count": viewport_layout_count,
                    "viewport_layouts": [str(one) for one in viewport_layouts if str(one).strip()],
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "derived_proxy_layout_kind_counts": proxy_layout_kind_counts,
                    "exploded_origin_layout_source_counts": exploded_layout_source_counts,
                    "assembly_group_source_counts": group_source_counts,
                    "assembly_group_layout_source_counts": group_layout_source_counts,
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        if viewport_count > 0 and (proxy_kind_counts or proxy_layout_kind_counts):
            merge_count_map(payload["import_viewport_proxy_kind_counts"], proxy_kind_counts)
            merge_nested_count_map(payload["import_viewport_proxy_layout_kind_counts"], proxy_layout_kind_counts)
            payload["import_viewport_proxy_case_count"] += 1
            payload["import_viewport_proxy_case_details"].append(
                {
                    "case_name": case_name,
                    "viewport_count": viewport_count,
                    "viewport_layout_count": viewport_layout_count,
                    "viewport_layouts": [str(one) for one in viewport_layouts if str(one).strip()],
                    "derived_proxy_kind_counts": proxy_kind_counts,
                    "derived_proxy_layout_kind_counts": proxy_layout_kind_counts,
                    "assembly_tracked_count": as_int(imported.get("assembly_tracked_count")),
                    "assembly_group_count": as_int(imported.get("assembly_group_count")),
                    "derived_proxy_count": as_int(imported.get("derived_proxy_count")),
                    "exploded_origin_count": as_int(imported.get("exploded_origin_count")),
                }
            )
        payload["export_derived_proxy_checked_count"] += as_int(derived.get("checked_count"))
        payload["export_exploded_checked_count"] += as_int(exploded.get("checked_count"))
        payload["export_assembly_checked_count"] += as_int(assembly.get("checked_count"))
        payload["export_assembly_group_count"] += as_int(assembly.get("group_count"))
        payload["export_metadata_drift_count"] += as_int(assembly.get("metadata_drift_count"))
        payload["export_group_drift_count"] += as_int(assembly.get("group_drift_count"))

    payload.update(
        {
            "summary_json": str(summary_path.resolve()),
            "case_name": ",".join(case_names),
        }
    )
    return payload


def shell_assignments(prefix: str, payload: dict) -> str:
    lines = []
    for key, value in payload.items():
        name = f"{prefix}_{key}".upper()
        if isinstance(value, bool):
            rendered = "1" if value else "0"
        elif isinstance(value, int):
            rendered = str(value)
        else:
            rendered = shlex.quote(str(value))
        lines.append(f"{name}={rendered}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Read editor assembly roundtrip CTest metrics.")
    parser.add_argument("--build-dir", required=True)
    parser.add_argument("--shell-prefix", default="")
    args = parser.parse_args()

    build_dir = Path(args.build_dir)
    if not build_dir.is_absolute():
        build_dir = (Path.cwd() / build_dir).resolve()

    by_lane = {}
    totals = {
        "summary_json_count": 0,
        "import_entity_count": 0,
        "import_unsupported_count": 0,
        "import_derived_proxy_count": 0,
        "import_exploded_origin_count": 0,
        "import_assembly_tracked_count": 0,
        "import_assembly_group_count": 0,
        "import_assembly_group_source_counts": {},
        "import_assembly_group_source_case_count": 0,
        "import_assembly_group_source_case_details": [],
        "import_proxy_kind_counts": {},
        "import_proxy_kind_case_count": 0,
        "import_proxy_kind_case_details": [],
        "import_proxy_layout_kind_counts": {},
        "import_proxy_layout_case_count": 0,
        "import_proxy_layout_case_details": [],
        "import_exploded_layout_source_counts": {},
        "import_exploded_layout_source_case_count": 0,
        "import_exploded_layout_source_case_details": [],
        "import_text_kind_counts": {},
        "import_text_kind_layout_counts": {},
        "import_text_kind_case_count": 0,
        "import_text_kind_case_details": [],
        "import_assembly_group_layout_source_counts": {},
        "import_assembly_group_layout_source_case_count": 0,
        "import_assembly_group_layout_source_case_details": [],
        "import_viewport_count": 0,
        "import_viewport_layout_count": 0,
        "import_viewport_case_count": 0,
        "import_viewport_case_details": [],
        "import_viewport_proxy_kind_counts": {},
        "import_viewport_proxy_layout_kind_counts": {},
        "import_viewport_proxy_case_count": 0,
        "import_viewport_proxy_case_details": [],
        "export_derived_proxy_checked_count": 0,
        "export_exploded_checked_count": 0,
        "export_assembly_checked_count": 0,
        "export_assembly_group_count": 0,
        "export_metadata_drift_count": 0,
        "export_group_drift_count": 0,
    }

    for lane, dirname in LANES.items():
        summary_path = newest_summary_json(build_dir / dirname)
        lane_payload = read_lane_payload(summary_path)
        lane_details = []
        for detail in lane_payload.get("import_viewport_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_details.append(enriched)
        lane_payload["import_viewport_case_details"] = lane_details
        lane_viewport_proxy_details = []
        for detail in lane_payload.get("import_viewport_proxy_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_viewport_proxy_details.append(enriched)
        lane_payload["import_viewport_proxy_case_details"] = lane_viewport_proxy_details
        lane_group_source_details = []
        for detail in lane_payload.get("import_assembly_group_source_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_group_source_details.append(enriched)
        lane_payload["import_assembly_group_source_case_details"] = lane_group_source_details
        lane_proxy_kind_details = []
        for detail in lane_payload.get("import_proxy_kind_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_proxy_kind_details.append(enriched)
        lane_payload["import_proxy_kind_case_details"] = lane_proxy_kind_details
        lane_proxy_layout_details = []
        for detail in lane_payload.get("import_proxy_layout_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_proxy_layout_details.append(enriched)
        lane_payload["import_proxy_layout_case_details"] = lane_proxy_layout_details
        lane_exploded_layout_details = []
        for detail in lane_payload.get("import_exploded_layout_source_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_exploded_layout_details.append(enriched)
        lane_payload["import_exploded_layout_source_case_details"] = lane_exploded_layout_details
        lane_text_kind_details = []
        for detail in lane_payload.get("import_text_kind_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_text_kind_details.append(enriched)
        lane_payload["import_text_kind_case_details"] = lane_text_kind_details
        lane_group_layout_details = []
        for detail in lane_payload.get("import_assembly_group_layout_source_case_details", []):
            if not isinstance(detail, dict):
                continue
            enriched = dict(detail)
            enriched["lane"] = lane
            enriched["summary_json"] = lane_payload.get("summary_json", "")
            lane_group_layout_details.append(enriched)
        lane_payload["import_assembly_group_layout_source_case_details"] = lane_group_layout_details
        by_lane[lane] = lane_payload
        if lane_payload["summary_json"]:
            totals["summary_json_count"] += 1
        for key in totals:
            if key == "summary_json_count":
                continue
            if key == "import_viewport_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_viewport_proxy_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_assembly_group_source_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_proxy_kind_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_proxy_layout_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_exploded_layout_source_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_text_kind_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_assembly_group_layout_source_case_details":
                totals[key].extend(lane_payload.get(key, []))
                continue
            if key == "import_proxy_kind_counts":
                merge_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_assembly_group_source_counts":
                merge_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_text_kind_counts":
                merge_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_proxy_layout_kind_counts":
                merge_nested_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_viewport_proxy_kind_counts":
                merge_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_viewport_proxy_layout_kind_counts":
                merge_nested_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_exploded_layout_source_counts":
                merge_nested_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_text_kind_layout_counts":
                merge_nested_count_map(totals[key], lane_payload.get(key))
                continue
            if key == "import_assembly_group_layout_source_counts":
                merge_nested_count_map(totals[key], lane_payload.get(key))
                continue
            totals[key] += as_int(lane_payload.get(key))

    payload = {
        "build_dir": str(build_dir),
        "summary_json_count": totals["summary_json_count"],
        "import_entity_count": totals["import_entity_count"],
        "import_unsupported_count": totals["import_unsupported_count"],
        "import_derived_proxy_count": totals["import_derived_proxy_count"],
        "import_exploded_origin_count": totals["import_exploded_origin_count"],
        "import_assembly_tracked_count": totals["import_assembly_tracked_count"],
        "import_assembly_group_count": totals["import_assembly_group_count"],
        "import_assembly_group_source_counts_b64": encode_json_base64(totals["import_assembly_group_source_counts"]),
        "import_assembly_group_source_case_count": totals["import_assembly_group_source_case_count"],
        "import_assembly_group_source_case_details_b64": encode_json_base64(totals["import_assembly_group_source_case_details"]),
        "import_proxy_kind_counts_b64": encode_json_base64(totals["import_proxy_kind_counts"]),
        "import_proxy_kind_case_count": totals["import_proxy_kind_case_count"],
        "import_proxy_kind_case_details_b64": encode_json_base64(totals["import_proxy_kind_case_details"]),
        "import_proxy_layout_kind_counts_b64": encode_json_base64(totals["import_proxy_layout_kind_counts"]),
        "import_proxy_layout_case_count": totals["import_proxy_layout_case_count"],
        "import_proxy_layout_case_details_b64": encode_json_base64(totals["import_proxy_layout_case_details"]),
        "import_exploded_layout_source_counts_b64": encode_json_base64(totals["import_exploded_layout_source_counts"]),
        "import_exploded_layout_source_case_count": totals["import_exploded_layout_source_case_count"],
        "import_exploded_layout_source_case_details_b64": encode_json_base64(totals["import_exploded_layout_source_case_details"]),
        "import_text_kind_counts_b64": encode_json_base64(totals["import_text_kind_counts"]),
        "import_text_kind_layout_counts_b64": encode_json_base64(totals["import_text_kind_layout_counts"]),
        "import_text_kind_case_count": totals["import_text_kind_case_count"],
        "import_text_kind_case_details_b64": encode_json_base64(totals["import_text_kind_case_details"]),
        "import_assembly_group_layout_source_counts_b64": encode_json_base64(totals["import_assembly_group_layout_source_counts"]),
        "import_assembly_group_layout_source_case_count": totals["import_assembly_group_layout_source_case_count"],
        "import_assembly_group_layout_source_case_details_b64": encode_json_base64(totals["import_assembly_group_layout_source_case_details"]),
        "import_viewport_count": totals["import_viewport_count"],
        "import_viewport_layout_count": totals["import_viewport_layout_count"],
        "import_viewport_case_count": totals["import_viewport_case_count"],
        "import_viewport_case_details_b64": encode_json_base64(totals["import_viewport_case_details"]),
        "import_viewport_proxy_kind_counts_b64": encode_json_base64(totals["import_viewport_proxy_kind_counts"]),
        "import_viewport_proxy_layout_kind_counts_b64": encode_json_base64(totals["import_viewport_proxy_layout_kind_counts"]),
        "import_viewport_proxy_case_count": totals["import_viewport_proxy_case_count"],
        "import_viewport_proxy_case_details_b64": encode_json_base64(totals["import_viewport_proxy_case_details"]),
        "export_derived_proxy_checked_count": totals["export_derived_proxy_checked_count"],
        "export_exploded_checked_count": totals["export_exploded_checked_count"],
        "export_assembly_checked_count": totals["export_assembly_checked_count"],
        "export_assembly_group_count": totals["export_assembly_group_count"],
        "export_metadata_drift_count": totals["export_metadata_drift_count"],
        "export_group_drift_count": totals["export_group_drift_count"],
        "model_summary_json": by_lane["model"]["summary_json"],
        "paperspace_summary_json": by_lane["paperspace"]["summary_json"],
        "mixed_summary_json": by_lane["mixed"]["summary_json"],
        "dense_summary_json": by_lane["dense"]["summary_json"],
        "model_case_name": by_lane["model"]["case_name"],
        "paperspace_case_name": by_lane["paperspace"]["case_name"],
        "mixed_case_name": by_lane["mixed"]["case_name"],
        "dense_case_name": by_lane["dense"]["case_name"],
    }

    if args.shell_prefix:
        sys.stdout.write(shell_assignments(args.shell_prefix, payload))
        sys.stdout.write("\n")
        return 0

    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
