#!/usr/bin/env python3
import argparse
import copy
import datetime as dt
import json
import os
import sys
import uuid
from pathlib import Path


DEFAULT_METADATA = {
    "label": "",
    "author": "",
    "company": "",
    "comment": "",
    "created_at": "",
    "modified_at": "",
    "unit_name": "",
    "meta": {},
}

DEFAULT_FEATURE_FLAGS = {"earcut": False, "clipper2": False}


class MigrationReport:
    def __init__(self):
        self.changes = []
        self.warnings = []

    def change(self, message: str) -> None:
        self.changes.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate CADGameFusion document.json schemas.")
    parser.add_argument("--input", required=True, help="Input document.json")
    parser.add_argument("--output", help="Output path (default: overwrite input)")
    parser.add_argument("--target", type=int, default=2, help="Target schema version (default: 2)")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing")
    parser.add_argument("--backup", action="store_true", help="Create .bak when overwriting input")
    return parser.parse_args()


def now_iso() -> str:
    return dt.datetime.utcnow().isoformat(timespec="seconds") + "Z"


def read_document(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_document(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def ensure_dict(container: dict, key: str, default: dict, report: MigrationReport) -> dict:
    value = container.get(key)
    if not isinstance(value, dict):
        container[key] = copy.deepcopy(default)
        report.change(f"set {key} to default object")
        return container[key]
    return value


def ensure_list(container: dict, key: str, report: MigrationReport) -> list:
    value = container.get(key)
    if not isinstance(value, list):
        container[key] = []
        report.change(f"set {key} to empty list")
        return container[key]
    return value


def ensure_scalar(container: dict, key: str, default, report: MigrationReport) -> None:
    if key not in container:
        container[key] = default
        report.change(f"added {key}")


def coerce_meta(meta: dict, report: MigrationReport) -> None:
    for key, value in list(meta.items()):
        if not isinstance(value, str):
            meta[key] = str(value)
            report.warn(f"coerced metadata.meta[{key!r}] to string")


def ensure_layer_fields(layer: dict, report: MigrationReport) -> None:
    defaults = {
        "color": 16777215,
        "visible": 1,
        "locked": 0,
        "printable": 1,
        "frozen": 0,
        "construction": 0,
    }
    for key, default in defaults.items():
        if key not in layer:
            layer[key] = default
            report.change(f"layer[{layer.get('id')}].{key} defaulted")

    if "name" not in layer:
        layer_id = layer.get("id")
        if isinstance(layer_id, int):
            layer["name"] = "0" if layer_id == 0 else f"Layer{layer_id}"
        else:
            layer["name"] = "Layer"
        report.change(f"layer[{layer.get('id')}].name defaulted")


def ensure_layers(data: dict, report: MigrationReport) -> None:
    layers = ensure_list(data, "layers", report)
    entities = ensure_list(data, "entities", report)

    existing_ids = set()
    for layer in layers:
        if not isinstance(layer, dict):
            report.warn("skipped non-object layer entry")
            continue
        layer_id = layer.get("id")
        if isinstance(layer_id, int):
            existing_ids.add(layer_id)
        else:
            report.warn("layer id missing or invalid")
        ensure_layer_fields(layer, report)

    used_layer_ids = set()
    for ent in entities:
        if not isinstance(ent, dict):
            report.warn("skipped non-object entity entry")
            continue
        layer_id = ent.get("layer_id")
        if isinstance(layer_id, int):
            used_layer_ids.add(layer_id)
        else:
            ent["layer_id"] = 0
            report.change("entity.layer_id defaulted to 0")
            used_layer_ids.add(0)

    missing = sorted(used_layer_ids - existing_ids)
    for layer_id in missing:
        layer = {
            "id": layer_id,
            "name": "0" if layer_id == 0 else f"Layer{layer_id}",
            "color": 16777215,
            "visible": 1,
            "locked": 0,
            "printable": 1,
            "frozen": 0,
            "construction": 0,
        }
        layers.append(layer)
        report.change(f"added missing layer {layer_id}")


def ensure_entities(data: dict, report: MigrationReport) -> None:
    entities = ensure_list(data, "entities", report)
    max_id = 0
    for ent in entities:
        if isinstance(ent, dict):
            ent_id = ent.get("id")
            if isinstance(ent_id, int) and ent_id >= 0:
                max_id = max(max_id, ent_id)

    next_id = max_id + 1
    for ent in entities:
        if not isinstance(ent, dict):
            report.warn("skipped non-object entity entry")
            continue
        if "name" not in ent:
            ent["name"] = ""
            report.change("entity.name defaulted")
        ent_id = ent.get("id")
        if not isinstance(ent_id, int) or ent_id < 0:
            ent["id"] = next_id
            report.change(f"entity.id assigned {next_id}")
            next_id += 1
        ent_type = ent.get("type")
        if not isinstance(ent_type, int):
            ent["type"] = 0
            report.warn("entity.type defaulted to 0")


def migrate_to_v1(data: dict, report: MigrationReport) -> None:
    ensure_scalar(data, "cadgf_version", "", report)

    feature_flags = ensure_dict(data, "feature_flags", DEFAULT_FEATURE_FLAGS, report)
    for key, default in DEFAULT_FEATURE_FLAGS.items():
        if key not in feature_flags:
            feature_flags[key] = default
            report.change(f"feature_flags.{key} defaulted")

    metadata = ensure_dict(data, "metadata", DEFAULT_METADATA, report)
    for key, default in DEFAULT_METADATA.items():
        if key not in metadata:
            metadata[key] = copy.deepcopy(default)
            report.change(f"metadata.{key} defaulted")
    meta = metadata.get("meta")
    if not isinstance(meta, dict):
        metadata["meta"] = {}
        report.change("metadata.meta defaulted")
    else:
        coerce_meta(meta, report)

    settings = ensure_dict(data, "settings", {"unit_scale": 1.0}, report)
    if "unit_scale" not in settings:
        settings["unit_scale"] = 1.0
        report.change("settings.unit_scale defaulted")

    ensure_entities(data, report)
    ensure_layers(data, report)

    data["schema_version"] = 1


def migrate_to_v2(data: dict, report: MigrationReport) -> None:
    document_id = data.get("document_id")
    if not isinstance(document_id, str) or not document_id:
        data["document_id"] = str(uuid.uuid4())
        report.change("document_id assigned")

    migrated_at = data.get("schema_migrated_at")
    if not isinstance(migrated_at, str) or not migrated_at:
        data["schema_migrated_at"] = now_iso()
        report.change("schema_migrated_at set")

    data["schema_version"] = 2


def migrate(data: dict, target: int, report: MigrationReport) -> int:
    raw_version = data.get("schema_version")
    try:
        current = int(raw_version)
    except Exception:
        current = 0

    if target < current:
        raise ValueError(f"target {target} is lower than current {current}")

    if current < 1 and target >= 1:
        migrate_to_v1(data, report)
        current = 1

    if current < 2 and target >= 2:
        migrate_to_v2(data, report)
        current = 2

    return current


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 2

    output_path = Path(args.output) if args.output else input_path
    report = MigrationReport()

    try:
        data = read_document(input_path)
    except Exception as exc:
        print(f"Failed to read JSON: {exc}", file=sys.stderr)
        return 2

    try:
        new_version = migrate(data, args.target, report)
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 2

    print(f"document_migrate: {input_path} -> {output_path} (schema_version {new_version})")
    for entry in report.changes:
        print(f"change: {entry}")
    for entry in report.warnings:
        print(f"warning: {entry}")

    if args.dry_run:
        print("dry-run: no output written")
        return 0

    if output_path == input_path and args.backup:
        backup_path = input_path.with_suffix(input_path.suffix + ".bak")
        try:
            backup_path.write_text(input_path.read_text(encoding="utf-8"), encoding="utf-8")
        except Exception as exc:
            print(f"Failed to write backup: {exc}", file=sys.stderr)
            return 2

    try:
        write_document(output_path, data)
    except Exception as exc:
        print(f"Failed to write output: {exc}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
