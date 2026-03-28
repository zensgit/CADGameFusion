#!/usr/bin/env python3
"""Validate PLM preview artifact consistency.

This validator is intentionally schema-light:
- it works against the current manifest/document/mesh_metadata contract
- it performs stronger checks when enriched mesh_metadata sections such as
  summary/layouts/viewports are present
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


VIEWPORT_RE = re.compile(r"^dxf\.viewport\.(\d+)\.(.+)$")
ENTITY_SPACE_RE = re.compile(r"^dxf\.entity\.(\d+)\.space$")
ENTITY_LAYOUT_RE = re.compile(r"^dxf\.entity\.(\d+)\.layout$")
VALID_COLOR_SOURCES = {"BYLAYER", "BYBLOCK", "INDEX", "TRUECOLOR"}
VALID_TEXT_KINDS = {"text", "mtext", "attrib", "attdef", "dimension", "mleader", "table"}


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def is_int_like(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def parse_int(value: Any) -> Optional[int]:
    if is_int_like(value):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def parse_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except ValueError:
            return None
    return None


def is_space_value(value: Any) -> bool:
    parsed = parse_int(value)
    return parsed in (0, 1)


def sorted_unique(items: Iterable[Any]) -> List[Any]:
    seen = set()
    out = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return sorted(out)


@dataclass
class ValidationResult:
    label: str
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    infos: List[str] = field(default_factory=list)

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def info(self, message: str) -> None:
        self.infos.append(message)

    def ok(self) -> bool:
        return not self.errors

    def print(self, quiet: bool = False) -> None:
        status = "PASS" if self.ok() else "FAIL"
        print(f"[{status}] {self.label}")
        if not quiet:
            for line in self.infos:
                print(f"  info: {line}")
            for line in self.warnings:
                print(f"  warn: {line}")
        for line in self.errors:
            print(f"  error: {line}")


@dataclass
class ArtifactSet:
    root: Path
    manifest_path: Path
    manifest: Dict[str, Any]
    document_path: Path
    document: Dict[str, Any]
    mesh_metadata_path: Optional[Path]
    mesh_metadata: Optional[Dict[str, Any]]


def resolve_manifest_path(target: Path) -> Path:
    if target.is_dir():
        return target / "manifest.json"
    return target


def is_raw_preview_dir(path: Path) -> bool:
    required = ("document.json", "mesh.gltf", "mesh.bin", "mesh_metadata.json")
    return path.is_dir() and all((path / name).exists() for name in required)


def build_synthetic_manifest(root: Path) -> Dict[str, Any]:
    return {
        "output_dir": str(root),
        "artifacts": {
            "document_json": "document.json",
            "mesh_gltf": "mesh.gltf",
            "mesh_bin": "mesh.bin",
            "mesh_metadata": "mesh_metadata.json",
        },
        "outputs": ["json", "gltf", "meta"],
        "warnings": [],
    }


def load_artifact_set(target: Path) -> ArtifactSet:
    if target.is_dir() and not (target / "manifest.json").exists():
        if not is_raw_preview_dir(target):
            raise OSError(f"preview directory missing manifest.json and standard artifacts: {target}")
        manifest_path = target / "manifest.json"
        manifest = build_synthetic_manifest(target.resolve())
        root = target.resolve()
    else:
        manifest_path = resolve_manifest_path(target)
        manifest = load_json(manifest_path)
        root = Path(manifest.get("output_dir", manifest_path.parent))
        if not root.is_absolute():
            root = (manifest_path.parent / root).resolve()
    artifacts = manifest.get("artifacts", {})
    document_path = root / artifacts["document_json"]
    mesh_metadata_rel = artifacts.get("mesh_metadata")
    mesh_metadata_path = root / mesh_metadata_rel if isinstance(mesh_metadata_rel, str) and mesh_metadata_rel else None
    return ArtifactSet(
        root=root,
        manifest_path=manifest_path,
        manifest=manifest,
        document_path=document_path,
        document=load_json(document_path),
        mesh_metadata_path=mesh_metadata_path,
        mesh_metadata=load_json(mesh_metadata_path) if mesh_metadata_path and mesh_metadata_path.exists() else None,
    )


def collect_doc_entity_spaces(document: Dict[str, Any]) -> Dict[int, int]:
    spaces: Dict[int, int] = {}
    for entity in document.get("entities", []):
        entity_id = parse_int(entity.get("id"))
        entity_space = parse_int(entity.get("space"))
        if entity_id is None or entity_space is None:
            continue
        spaces[entity_id] = entity_space
    meta = document.get("metadata", {}).get("meta", {})
    if isinstance(meta, dict):
        for key, value in meta.items():
            match = ENTITY_SPACE_RE.match(key)
            if not match:
                continue
            entity_id = parse_int(match.group(1))
            entity_space = parse_int(value)
            if entity_id is None or entity_space is None:
                continue
            spaces.setdefault(entity_id, entity_space)
    return spaces


def collect_doc_entity_layouts(document: Dict[str, Any]) -> Dict[int, str]:
    layouts: Dict[int, str] = {}
    for entity in document.get("entities", []):
        entity_id = parse_int(entity.get("id"))
        layout = entity.get("layout")
        if entity_id is None or not isinstance(layout, str) or not layout:
            continue
        layouts[entity_id] = layout
    meta = document.get("metadata", {}).get("meta", {})
    if isinstance(meta, dict):
        for key, value in meta.items():
            match = ENTITY_LAYOUT_RE.match(key)
            if not match:
                continue
            entity_id = parse_int(match.group(1))
            if entity_id is None or not isinstance(value, str) or not value:
                continue
            layouts.setdefault(entity_id, value)
    return layouts


def collect_doc_entities_by_id(document: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    out: Dict[int, Dict[str, Any]] = {}
    for entity in document.get("entities", []):
        if not isinstance(entity, dict):
            continue
        entity_id = parse_int(entity.get("id"))
        if entity_id is None:
            continue
        out[entity_id] = entity
    return out


def count_entries_by_space(entries: Iterable[Any]) -> Dict[int, int]:
    counts: Dict[int, int] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        space = parse_int(entry.get("space"))
        if space not in (0, 1):
            continue
        counts[space] = counts.get(space, 0) + 1
    return counts


def collect_doc_viewports(document: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
    meta = document.get("metadata", {}).get("meta", {})
    viewports: Dict[int, Dict[str, Any]] = {}
    if not isinstance(meta, dict):
        return viewports
    for key, value in meta.items():
        match = VIEWPORT_RE.match(key)
        if not match:
            continue
        index = int(match.group(1))
        field_name = match.group(2)
        viewports.setdefault(index, {})[field_name] = value
    return viewports


def validate_source_semantics(entity: Dict[str, Any], location: str, entity_id: int, result: ValidationResult) -> None:
    source_type = entity.get("source_type")
    if not isinstance(source_type, str) or not source_type:
        return
    edit_mode = entity.get("edit_mode")
    proxy_kind = entity.get("proxy_kind")

    if source_type == "DIMENSION":
        if edit_mode != "proxy":
            result.error(f"{location} id={entity_id} source_type DIMENSION requires edit_mode='proxy'")
        if proxy_kind != "dimension":
            result.error(f"{location} id={entity_id} source_type DIMENSION requires proxy_kind='dimension'")
        if "text_kind" in entity and entity.get("text_kind") != "dimension":
            result.error(f"{location} id={entity_id} source_type DIMENSION requires text_kind='dimension'")
        if "dim_type" not in entity:
            result.error(f"{location} id={entity_id} source_type DIMENSION requires dim_type")
        if "dim_style" not in entity:
            result.error(f"{location} id={entity_id} source_type DIMENSION requires dim_style")
    elif source_type == "HATCH":
        if edit_mode != "proxy":
            result.error(f"{location} id={entity_id} source_type HATCH requires edit_mode='proxy'")
        if proxy_kind != "hatch":
            result.error(f"{location} id={entity_id} source_type HATCH requires proxy_kind='hatch'")
        if "hatch_id" not in entity:
            result.error(f"{location} id={entity_id} source_type HATCH requires hatch_id")
        if "hatch_pattern" not in entity:
            result.error(f"{location} id={entity_id} source_type HATCH requires hatch_pattern")
    elif source_type == "INSERT":
        if edit_mode != "exploded":
            result.error(f"{location} id={entity_id} source_type INSERT requires edit_mode='exploded'")
        if proxy_kind != "insert":
            result.error(f"{location} id={entity_id} source_type INSERT requires proxy_kind='insert'")
        if "block_name" not in entity:
            result.error(f"{location} id={entity_id} source_type INSERT requires block_name")
    elif source_type == "LEADER":
        if edit_mode != "proxy":
            result.error(f"{location} id={entity_id} source_type LEADER requires edit_mode='proxy'")
        if proxy_kind != "leader":
            result.error(f"{location} id={entity_id} source_type LEADER requires proxy_kind='leader'")


def validate_text_semantics(entity: Dict[str, Any], location: str, entity_id: int, result: ValidationResult) -> None:
    text_kind = entity.get("text_kind")
    if text_kind is None:
        return
    if not isinstance(text_kind, str) or not text_kind:
        result.error(f"{location} id={entity_id} has invalid text_kind {text_kind!r}")
        return
    if text_kind not in VALID_TEXT_KINDS:
        result.error(f"{location} id={entity_id} has invalid text_kind {text_kind!r}")
        return
    if text_kind == "dimension":
        if entity.get("source_type") != "DIMENSION":
            result.error(f"{location} id={entity_id} text_kind dimension requires source_type='DIMENSION'")
        if entity.get("edit_mode") != "proxy":
            result.error(f"{location} id={entity_id} text_kind dimension requires edit_mode='proxy'")
        if entity.get("proxy_kind") != "dimension":
            result.error(f"{location} id={entity_id} text_kind dimension requires proxy_kind='dimension'")


def validate_color_semantics(entity: Dict[str, Any], location: str, entity_id: int, result: ValidationResult) -> None:
    color_source = entity.get("color_source")
    if color_source is None:
        return
    if not isinstance(color_source, str) or not color_source:
        result.error(f"{location} id={entity_id} has invalid color_source {color_source!r}")
        return
    if color_source not in VALID_COLOR_SOURCES:
        result.error(f"{location} id={entity_id} has invalid color_source {color_source!r}")
        return

    color = entity.get("color")
    layer_color = entity.get("layer_color")
    color_aci = entity.get("color_aci")

    parsed_color = parse_int(color) if color is not None else None
    parsed_layer_color = parse_int(layer_color) if layer_color is not None else None
    parsed_color_aci = parse_int(color_aci) if color_aci is not None else None

    if color is not None and parsed_color is None:
        result.error(f"{location} id={entity_id} has invalid color {color!r}")
    if layer_color is not None and parsed_layer_color is None:
        result.error(f"{location} id={entity_id} has invalid layer_color {layer_color!r}")
    if color_aci is not None and parsed_color_aci is None:
        result.error(f"{location} id={entity_id} has invalid color_aci {color_aci!r}")

    if color_source == "INDEX" and parsed_color_aci is None:
        result.error(f"{location} id={entity_id} color_source INDEX requires color_aci")
    if color_source == "TRUECOLOR" and parsed_color is None:
        result.error(f"{location} id={entity_id} color_source TRUECOLOR requires color")
    if color_source == "BYLAYER" and parsed_color is not None and parsed_layer_color is not None:
        if parsed_color != parsed_layer_color:
            result.error(
                f"{location} id={entity_id} color_source BYLAYER requires color == layer_color"
            )


def validate_style_fields(entity: Dict[str, Any], location: str, entity_id: int, result: ValidationResult) -> None:
    if "line_type" in entity and not isinstance(entity.get("line_type"), str):
        result.error(f"{location} id={entity_id} has invalid line_type {entity.get('line_type')!r}")
    if "line_weight" in entity and parse_float(entity.get("line_weight")) is None:
        result.error(f"{location} id={entity_id} has invalid line_weight {entity.get('line_weight')!r}")
    if "line_type_scale" in entity and parse_float(entity.get("line_type_scale")) is None:
        result.error(
            f"{location} id={entity_id} has invalid line_type_scale {entity.get('line_type_scale')!r}"
        )
    if "layer_name" in entity and not isinstance(entity.get("layer_name"), str):
        result.error(f"{location} id={entity_id} has invalid layer_name {entity.get('layer_name')!r}")


def validate_manifest(artifacts: ArtifactSet, result: ValidationResult) -> None:
    manifest = artifacts.manifest
    manifest_path = artifacts.manifest_path
    root = artifacts.root
    artifact_map = manifest.get("artifacts")
    if not isinstance(artifact_map, dict):
        result.error("manifest.artifacts missing or not an object")
        return
    outputs = manifest.get("outputs")
    if not isinstance(outputs, list):
        result.error("manifest.outputs missing or not a list")
        outputs = []
    require_mesh = any(value in outputs for value in ("gltf", "meta"))
    required_artifact_keys = ["document_json"]
    if require_mesh:
        required_artifact_keys.extend(["mesh_gltf", "mesh_bin", "mesh_metadata"])
    for key in required_artifact_keys:
        value = artifact_map.get(key)
        if not isinstance(value, str) or not value:
            result.error(f"manifest.artifacts.{key} missing or not a string")
            continue
        file_path = root / value
        if not file_path.exists():
            result.error(f"manifest references missing file for {key}: {file_path}")
    content_hashes = manifest.get("content_hashes")
    if content_hashes is not None:
        if not isinstance(content_hashes, dict):
            result.error("manifest.content_hashes is not an object")
        else:
            for key in artifact_map.keys():
                if key not in artifact_map or key not in content_hashes:
                    continue
                expected_hash = content_hashes.get(key)
                if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
                    result.error(f"manifest.content_hashes.{key} missing or invalid")
                    continue
                file_path = root / artifact_map[key]
                if file_path.exists():
                    actual_hash = compute_sha256(file_path)
                    if actual_hash != expected_hash:
                        result.error(
                            f"manifest.content_hashes.{key} mismatch ({expected_hash} != {actual_hash})"
                        )
    artifact_sizes = manifest.get("artifact_sizes")
    if artifact_sizes is not None:
        if not isinstance(artifact_sizes, dict):
            result.error("manifest.artifact_sizes is not an object")
        else:
            for key in artifact_map.keys():
                if key not in artifact_map or key not in artifact_sizes:
                    continue
                expected_size = parse_int(artifact_sizes.get(key))
                if expected_size is None or expected_size < 0:
                    result.error(f"manifest.artifact_sizes.{key} missing or invalid")
                    continue
                file_path = root / artifact_map[key]
                if file_path.exists():
                    actual_size = file_path.stat().st_size
                    if actual_size != expected_size:
                        result.error(
                            f"manifest.artifact_sizes.{key} mismatch ({expected_size} != {actual_size})"
                        )
    if outputs:
        valid_outputs = {"json", "gltf", "meta"}
        invalid_outputs = sorted(value for value in outputs if value not in valid_outputs)
        if invalid_outputs:
            result.error(f"manifest.outputs contains invalid entries: {', '.join(invalid_outputs)}")
        if "json" not in outputs:
            result.error("manifest.outputs missing required entry: json")
    warnings = manifest.get("warnings", [])
    if not isinstance(warnings, list):
        result.error("manifest.warnings is not a list")
    for optional_key in ("project_id", "document_label", "document_id"):
        if optional_key in manifest and not isinstance(manifest.get(optional_key), str):
            result.error(f"manifest.{optional_key} is not a string")
    result.info(f"manifest={manifest_path}")


def validate_document(document: Dict[str, Any], result: ValidationResult) -> Dict[int, int]:
    if not isinstance(document, dict):
        result.error("document.json root is not an object")
        return {}
    entities = document.get("entities")
    if not isinstance(entities, list):
        result.error("document.entities missing or not a list")
        return {}
    metadata = document.get("metadata")
    if not isinstance(metadata, dict):
        result.error("document.metadata missing or not an object")
        return {}
    meta = metadata.get("meta")
    if not isinstance(meta, dict):
        result.error("document.metadata.meta missing or not an object")
        return {}

    ids: List[int] = []
    invalid_space_ids: List[int] = []
    for entity in entities:
        if not isinstance(entity, dict):
            result.error("document.entities contains a non-object entry")
            continue
        entity_id = parse_int(entity.get("id"))
        if entity_id is None:
            result.error("document entity missing integer id")
            continue
        ids.append(entity_id)
        if "space" in entity and not is_space_value(entity.get("space")):
            invalid_space_ids.append(entity_id)
        if "layout" in entity:
            layout = entity.get("layout")
            if not isinstance(layout, str) or not layout:
                result.error(f"document entity id={entity_id} has invalid layout {layout!r}")
        for key in ("source_type", "edit_mode", "proxy_kind", "block_name", "hatch_pattern", "text_kind", "dim_style"):
            if key in entity:
                value = entity.get(key)
                if not isinstance(value, str) or not value:
                    result.error(f"document entity id={entity_id} has invalid {key} {value!r}")
        if "hatch_id" in entity and parse_int(entity.get("hatch_id")) is None:
            result.error(f"document entity id={entity_id} has invalid hatch_id {entity.get('hatch_id')!r}")
        if "dim_type" in entity and parse_int(entity.get("dim_type")) is None:
            result.error(f"document entity id={entity_id} has invalid dim_type {entity.get('dim_type')!r}")
        validate_source_semantics(entity, "document entity", entity_id, result)
        validate_text_semantics(entity, "document entity", entity_id, result)
        validate_color_semantics(entity, "document entity", entity_id, result)
        validate_style_fields(entity, "document entity", entity_id, result)
    if len(ids) != len(set(ids)):
        result.error("document.entities contains duplicate ids")
    if invalid_space_ids:
        result.error(
            "document.entities contains invalid space values for ids: "
            + ", ".join(str(v) for v in invalid_space_ids[:10])
        )
    default_space = meta.get("dxf.default_space")
    if default_space is not None and not is_space_value(default_space):
        result.error(f"document metadata dxf.default_space is invalid: {default_space!r}")
    result.info(f"document entities={len(entities)}")
    return collect_doc_entity_spaces(document)


def validate_mesh_entry(
    entry: Dict[str, Any],
    collection_name: str,
    seen_ids: set[int],
    doc_spaces: Dict[int, int],
    doc_layouts: Dict[int, str],
    doc_entities: Dict[int, Dict[str, Any]],
    result: ValidationResult,
) -> None:
    entity_id = parse_int(entry.get("id"))
    if entity_id is None:
        result.error(f"{collection_name} entry missing integer id")
        return
    if entity_id in seen_ids:
        result.error(f"{collection_name} contains duplicate id {entity_id}")
    seen_ids.add(entity_id)

    space = entry.get("space")
    if space is not None and not is_space_value(space):
        result.error(f"{collection_name} id={entity_id} has invalid space {space!r}")
    if space is not None and entity_id in doc_spaces:
        if parse_int(space) != doc_spaces[entity_id]:
            result.error(
                f"{collection_name} id={entity_id} space mismatch: mesh={space} document={doc_spaces[entity_id]}"
            )
    layout = entry.get("layout")
    if layout is not None:
        if not isinstance(layout, str) or not layout:
            result.error(f"{collection_name} id={entity_id} has invalid layout {layout!r}")
        elif entity_id in doc_layouts and layout != doc_layouts[entity_id]:
            result.error(
                f"{collection_name} id={entity_id} layout mismatch: mesh={layout!r} document={doc_layouts[entity_id]!r}"
            )
    for key in ("source_type", "edit_mode", "proxy_kind", "block_name", "hatch_pattern", "text_kind", "dim_style"):
        if key in entry:
            value = entry.get(key)
            if not isinstance(value, str) or not value:
                result.error(f"{collection_name} id={entity_id} has invalid {key} {value!r}")
    if "group_id" in entry:
        group_id = parse_int(entry.get("group_id"))
        if group_id is None or group_id < 0:
            result.error(f"{collection_name} id={entity_id} has invalid group_id {entry.get('group_id')!r}")
    if "hatch_id" in entry and parse_int(entry.get("hatch_id")) is None:
        result.error(f"{collection_name} id={entity_id} has invalid hatch_id {entry.get('hatch_id')!r}")
    if "dim_type" in entry and parse_int(entry.get("dim_type")) is None:
        result.error(f"{collection_name} id={entity_id} has invalid dim_type {entry.get('dim_type')!r}")
    validate_source_semantics(entry, collection_name, entity_id, result)
    validate_text_semantics(entry, collection_name, entity_id, result)
    validate_color_semantics(entry, collection_name, entity_id, result)
    validate_style_fields(entry, collection_name, entity_id, result)

    doc_entity = doc_entities.get(entity_id)
    if doc_entity is not None:
        for key in (
            "source_type",
            "edit_mode",
            "proxy_kind",
            "block_name",
            "hatch_pattern",
            "text_kind",
            "dim_style",
            "layout",
            "color_source",
        ):
            doc_value = doc_entity.get(key)
            if doc_value is None:
                continue
            mesh_value = entry.get(key)
            if mesh_value != doc_value:
                result.error(
                    f"{collection_name} id={entity_id} {key} mismatch: mesh={mesh_value!r} document={doc_value!r}"
                )
        for key in ("hatch_id", "dim_type", "space", "color_aci", "color", "layer_id", "layer_color"):
            if key not in doc_entity:
                continue
            doc_value = parse_int(doc_entity.get(key))
            mesh_value = parse_int(entry.get(key))
            if doc_value != mesh_value:
                result.error(
                    f"{collection_name} id={entity_id} {key} mismatch: mesh={entry.get(key)!r} document={doc_entity.get(key)!r}"
                )
        if "group_id" in doc_entity:
            doc_value = parse_int(doc_entity.get("group_id"))
            mesh_value = parse_int(entry.get("group_id"))
            if doc_value != mesh_value:
                result.error(
                    f"{collection_name} id={entity_id} group_id mismatch: mesh={entry.get('group_id')!r} document={doc_entity.get('group_id')!r}"
                )
        for key in ("line_weight", "line_type_scale"):
            if key not in doc_entity:
                continue
            doc_value = parse_float(doc_entity.get(key))
            mesh_value = parse_float(entry.get(key))
            if doc_value is None or mesh_value is None:
                continue
            if abs(doc_value - mesh_value) > 1e-6:
                result.error(
                    f"{collection_name} id={entity_id} {key} mismatch: mesh={entry.get(key)!r} document={doc_entity.get(key)!r}"
                )
        for key in ("line_type", "layer_name"):
            doc_value = doc_entity.get(key)
            if doc_value is None:
                continue
            mesh_value = entry.get(key)
            if mesh_value != doc_value:
                result.error(
                    f"{collection_name} id={entity_id} {key} mismatch: mesh={mesh_value!r} document={doc_value!r}"
                )

    for key in ("base_vertex", "vertex_count", "index_offset", "index_count"):
        if key not in entry:
            result.error(f"{collection_name} id={entity_id} missing {key}")
            continue
        if parse_int(entry.get(key)) is None:
            result.error(f"{collection_name} id={entity_id} has non-integer {key}")


def validate_optional_summary(
    summary: Dict[str, Any],
    artifacts: ArtifactSet,
    document: Dict[str, Any],
    mesh_metadata: Dict[str, Any],
    result: ValidationResult,
) -> None:
    meta = document.get("metadata", {}).get("meta", {})
    default_space = meta.get("dxf.default_space")
    if "default_space" in summary:
        if not is_space_value(summary["default_space"]):
            result.error(f"mesh_metadata.summary.default_space invalid: {summary['default_space']!r}")
        elif default_space is not None and parse_int(summary["default_space"]) != parse_int(default_space):
            result.error(
                "mesh_metadata.summary.default_space does not match document metadata "
                f"({summary['default_space']} != {default_space})"
            )
    viewport_count = meta.get("dxf.viewport.count")
    if "viewport_count" in summary:
        if parse_int(summary["viewport_count"]) is None:
            result.error(f"mesh_metadata.summary.viewport_count invalid: {summary['viewport_count']!r}")
        elif viewport_count is not None and parse_int(summary["viewport_count"]) != parse_int(viewport_count):
            result.error(
                "mesh_metadata.summary.viewport_count does not match document metadata "
                f"({summary['viewport_count']} != {viewport_count})"
            )
    if "layout_count" in summary and "layouts" in mesh_metadata:
        layouts = mesh_metadata.get("layouts")
        if isinstance(layouts, list) and parse_int(summary["layout_count"]) != len(layouts):
            result.error(
                "mesh_metadata.summary.layout_count does not match mesh_metadata.layouts length "
                f"({summary['layout_count']} != {len(layouts)})"
            )
    mesh_entity_count = summary.get("mesh_entity_count")
    if mesh_entity_count is not None:
        if parse_int(mesh_entity_count) is None:
            result.error(f"mesh_metadata.summary.mesh_entity_count invalid: {mesh_entity_count!r}")
        elif parse_int(mesh_entity_count) != len(mesh_metadata.get("entities", [])):
            result.error(
                "mesh_metadata.summary.mesh_entity_count does not match mesh_metadata.entities length "
                f"({mesh_entity_count} != {len(mesh_metadata.get('entities', []))})"
            )
    line_entity_count = summary.get("line_entity_count")
    if line_entity_count is not None:
        if parse_int(line_entity_count) is None:
            result.error(f"mesh_metadata.summary.line_entity_count invalid: {line_entity_count!r}")
        elif parse_int(line_entity_count) != len(mesh_metadata.get("line_entities", [])):
            result.error(
                "mesh_metadata.summary.line_entity_count does not match mesh_metadata.line_entities length "
                f"({line_entity_count} != {len(mesh_metadata.get('line_entities', []))})"
            )
    document_entity_count = summary.get("document_entity_count")
    if document_entity_count is not None:
        entities = document.get("entities", [])
        if parse_int(document_entity_count) is None:
            result.error(
                f"mesh_metadata.summary.document_entity_count invalid: {document_entity_count!r}"
            )
        elif isinstance(entities, list) and parse_int(document_entity_count) != len(entities):
            result.error(
                "mesh_metadata.summary.document_entity_count does not match document.entities length "
                f"({document_entity_count} != {len(entities)})"
            )
    spaces = summary.get("spaces")
    if spaces is not None:
        if not isinstance(spaces, list):
            result.error("mesh_metadata.summary.spaces is not a list")
        else:
            seen_spaces = set()
            doc_space_counts = count_entries_by_space(document.get("entities", []))
            mesh_space_counts = count_entries_by_space(mesh_metadata.get("entities", []))
            line_space_counts = count_entries_by_space(mesh_metadata.get("line_entities", []))
            for idx, space_summary in enumerate(spaces):
                if not isinstance(space_summary, dict):
                    result.error(f"mesh_metadata.summary.spaces[{idx}] is not an object")
                    continue
                space = space_summary.get("space")
                if not is_space_value(space) and parse_int(space) != -1:
                    result.error(
                        f"mesh_metadata.summary.spaces[{idx}].space invalid: {space_summary.get('space')!r}"
                    )
                    continue
                parsed_space = parse_int(space)
                if parsed_space in seen_spaces:
                    result.error(f"mesh_metadata.summary.spaces contains duplicate space {parsed_space}")
                seen_spaces.add(parsed_space)
                for key in ("document_entity_count", "mesh_entity_count", "line_entity_count"):
                    if key in space_summary and parse_int(space_summary[key]) is None:
                        result.error(
                            f"mesh_metadata.summary.spaces[{idx}].{key} invalid: {space_summary[key]!r}"
                        )
                if parsed_space in (0, 1):
                    expected_doc_count = doc_space_counts.get(parsed_space, 0)
                    expected_mesh_count = mesh_space_counts.get(parsed_space, 0)
                    expected_line_count = line_space_counts.get(parsed_space, 0)
                    if "document_entity_count" in space_summary and parse_int(space_summary.get("document_entity_count")) != expected_doc_count:
                        result.error(
                            "mesh_metadata.summary.spaces[%d].document_entity_count mismatch (%r != %d)"
                            % (idx, space_summary.get("document_entity_count"), expected_doc_count)
                        )
                    if "mesh_entity_count" in space_summary and parse_int(space_summary.get("mesh_entity_count")) != expected_mesh_count:
                        result.error(
                            "mesh_metadata.summary.spaces[%d].mesh_entity_count mismatch (%r != %d)"
                            % (idx, space_summary.get("mesh_entity_count"), expected_mesh_count)
                        )
                    if "line_entity_count" in space_summary and parse_int(space_summary.get("line_entity_count")) != expected_line_count:
                        result.error(
                            "mesh_metadata.summary.spaces[%d].line_entity_count mismatch (%r != %d)"
                            % (idx, space_summary.get("line_entity_count"), expected_line_count)
                        )
            actual_spaces = sorted_unique(
                list(doc_space_counts.keys()) + list(mesh_space_counts.keys()) + list(line_space_counts.keys())
            )
            missing_spaces = [space for space in actual_spaces if space not in seen_spaces]
            if missing_spaces:
                result.error(
                    "mesh_metadata.summary.spaces missing actual spaces: "
                    + ", ".join(str(space) for space in missing_spaces)
                )
    result.info("mesh_metadata summary present")


def validate_optional_layouts(
    layouts: List[Any],
    doc_viewports: Dict[int, Dict[str, Any]],
    document: Dict[str, Any],
    mesh_metadata: Dict[str, Any],
    result: ValidationResult,
) -> List[str]:
    layout_names: List[str] = []
    seen_layout_names: set[str] = set()
    default_layout_names: List[str] = []
    document_entity_counts: Dict[str, int] = {}
    entity_counts: Dict[str, int] = {}
    line_entity_counts: Dict[str, int] = {}
    document_space_counts: Dict[int, int] = {}
    mesh_space_counts: Dict[int, int] = {}
    line_space_counts: Dict[int, int] = {}
    for entry in document.get("entities", []):
        if not isinstance(entry, dict):
            continue
        layout = entry.get("layout")
        if isinstance(layout, str) and layout:
            document_entity_counts[layout] = document_entity_counts.get(layout, 0) + 1
        space = parse_int(entry.get("space"))
        if space is not None:
            document_space_counts[space] = document_space_counts.get(space, 0) + 1
    for entry in mesh_metadata.get("entities", []):
        if not isinstance(entry, dict):
            continue
        layout = entry.get("layout")
        if isinstance(layout, str) and layout:
            entity_counts[layout] = entity_counts.get(layout, 0) + 1
        space = parse_int(entry.get("space"))
        if space is not None:
            mesh_space_counts[space] = mesh_space_counts.get(space, 0) + 1
    for entry in mesh_metadata.get("line_entities", []):
        if not isinstance(entry, dict):
            continue
        layout = entry.get("layout")
        if isinstance(layout, str) and layout:
            line_entity_counts[layout] = line_entity_counts.get(layout, 0) + 1
        space = parse_int(entry.get("space"))
        if space is not None:
            line_space_counts[space] = line_space_counts.get(space, 0) + 1
    for index, layout in enumerate(layouts):
        if not isinstance(layout, dict):
            result.error(f"mesh_metadata.layouts[{index}] is not an object")
            continue
        name = layout.get("name")
        if not isinstance(name, str) or not name:
            result.error(f"mesh_metadata.layouts[{index}].name missing or invalid")
            continue
        layout_names.append(name)
        if name in seen_layout_names:
            result.error(f"mesh_metadata.layouts contains duplicate name {name!r}")
        seen_layout_names.add(name)
        if "space" in layout and not is_space_value(layout["space"]):
            result.error(f"mesh_metadata.layouts[{index}].space invalid: {layout['space']!r}")
        for key in (
            "entity_count",
            "document_entity_count",
            "mesh_entity_count",
            "line_entity_count",
            "viewport_count",
        ):
            if key in layout and parse_int(layout[key]) is None:
                result.error(f"mesh_metadata.layouts[{index}].{key} invalid: {layout[key]!r}")
        for key in ("is_default", "synthetic"):
            if key in layout and not isinstance(layout[key], bool):
                result.error(f"mesh_metadata.layouts[{index}].{key} must be boolean")
        if layout.get("is_default") is True:
            default_layout_names.append(name)
        synthetic = layout.get("synthetic") is True
        layout_space = parse_int(layout.get("space"))
        if synthetic and layout_space is not None:
            doc_expected_count = document_space_counts.get(layout_space, 0)
            mesh_expected_count = mesh_space_counts.get(layout_space, 0)
            line_expected_count = line_space_counts.get(layout_space, 0)
        else:
            doc_expected_count = document_entity_counts.get(name, 0)
            mesh_expected_count = entity_counts.get(name, 0)
            line_expected_count = line_entity_counts.get(name, 0)
        if "document_entity_count" in layout:
            if parse_int(layout["document_entity_count"]) != doc_expected_count:
                result.error(
                    f"mesh_metadata.layouts[{index}].document_entity_count mismatch ({layout['document_entity_count']!r} != {doc_expected_count})"
                )
        if "mesh_entity_count" in layout:
            if parse_int(layout["mesh_entity_count"]) != mesh_expected_count:
                result.error(
                    f"mesh_metadata.layouts[{index}].mesh_entity_count mismatch ({layout['mesh_entity_count']!r} != {mesh_expected_count})"
                )
        if "line_entity_count" in layout:
            if parse_int(layout["line_entity_count"]) != line_expected_count:
                result.error(
                    f"mesh_metadata.layouts[{index}].line_entity_count mismatch ({layout['line_entity_count']!r} != {line_expected_count})"
                )
        extents = layout.get("extents")
        if extents is not None:
            if not isinstance(extents, list) or len(extents) != 4:
                result.error(f"mesh_metadata.layouts[{index}].extents must be a 4-number array")
            else:
                for value in extents:
                    if parse_float(value) is None:
                        result.error(f"mesh_metadata.layouts[{index}].extents contains non-numeric value")
                        break
    viewport_layouts = sorted_unique(
        viewport.get("layout")
        for viewport in doc_viewports.values()
        if isinstance(viewport.get("layout"), str) and viewport.get("layout")
    )
    missing_layouts = [name for name in viewport_layouts if name not in layout_names]
    if missing_layouts:
        result.error(
            "mesh_metadata.layouts missing names referenced by document viewports: "
            + ", ".join(missing_layouts)
        )
    if len(default_layout_names) > 1:
        result.error(
            "mesh_metadata.layouts contains multiple default layouts: "
            + ", ".join(default_layout_names)
        )
    result.info(f"mesh_metadata layouts={len(layout_names)}")
    return layout_names


def validate_optional_viewports(
    viewports: List[Any],
    doc_viewports: Dict[int, Dict[str, Any]],
    layout_names: List[str],
    result: ValidationResult,
) -> None:
    if len(viewports) != len(doc_viewports):
        result.error(
            "mesh_metadata.viewports length does not match document viewport metadata "
            f"({len(viewports)} != {len(doc_viewports)})"
        )

    expected_keys = {
        "id": "id",
        "layout_name": "layout",
        "layout": "layout",
        "space": "space",
        "center_x": "center_x",
        "center_y": "center_y",
        "width": "width",
        "height": "height",
        "view_center_x": "view_center_x",
        "view_center_y": "view_center_y",
        "view_height": "view_height",
        "twist_deg": "twist_deg",
    }

    for index, viewport in enumerate(viewports):
        if not isinstance(viewport, dict):
            result.error(f"mesh_metadata.viewports[{index}] is not an object")
            continue
        if "index" in viewport and parse_int(viewport.get("index")) != index:
            result.error(
                f"mesh_metadata.viewports[{index}].index mismatch ({viewport.get('index')!r} != {index})"
            )
        doc_viewport = doc_viewports.get(index)
        if doc_viewport is None:
            result.error(f"mesh_metadata.viewports[{index}] has no matching document viewport")
            continue
        layout_name = viewport.get("layout_name", viewport.get("layout"))
        if layout_name is not None:
            if not isinstance(layout_name, str) or not layout_name:
                result.error(f"mesh_metadata.viewports[{index}] layout_name/layout invalid")
            elif layout_names and layout_name not in layout_names:
                result.error(
                    f"mesh_metadata.viewports[{index}] references unknown layout {layout_name!r}"
                )
        if "space" in viewport and not is_space_value(viewport["space"]):
            result.error(f"mesh_metadata.viewports[{index}].space invalid: {viewport['space']!r}")
        for mesh_key, doc_key in expected_keys.items():
            if mesh_key not in viewport:
                continue
            mesh_value = viewport[mesh_key]
            doc_value = doc_viewport.get(doc_key)
            if doc_value is None:
                continue
            if mesh_key in {"id", "space"}:
                if parse_int(mesh_value) != parse_int(doc_value):
                    result.error(
                        f"mesh_metadata.viewports[{index}].{mesh_key} mismatch "
                        f"({mesh_value!r} != {doc_value!r})"
                    )
            elif mesh_key in {"layout_name", "layout"}:
                if mesh_value != doc_value:
                    result.error(
                        f"mesh_metadata.viewports[{index}].{mesh_key} mismatch "
                        f"({mesh_value!r} != {doc_value!r})"
                    )
            else:
                mesh_number = parse_float(mesh_value)
                doc_number = parse_float(doc_value)
                if mesh_number is None or doc_number is None:
                    result.error(
                        f"mesh_metadata.viewports[{index}].{mesh_key} has non-numeric value"
                    )
                elif abs(mesh_number - doc_number) > 1e-6:
                    result.error(
                        f"mesh_metadata.viewports[{index}].{mesh_key} mismatch "
                        f"({mesh_value!r} != {doc_value!r})"
                    )
    result.info(f"mesh_metadata viewports={len(viewports)}")


def validate_mesh_metadata(
    artifacts: ArtifactSet,
    doc_spaces: Dict[int, int],
    result: ValidationResult,
) -> None:
    mesh_metadata = artifacts.mesh_metadata
    if mesh_metadata is None:
        result.info("mesh_metadata absent; json-only preview contract")
        return
    if not isinstance(mesh_metadata, dict):
        result.error("mesh_metadata.json root is not an object")
        return

    artifact_map = artifacts.manifest.get("artifacts", {})
    gltf_name = artifact_map.get("mesh_gltf")
    bin_name = artifact_map.get("mesh_bin")
    if gltf_name is not None and mesh_metadata.get("gltf") != gltf_name:
        result.error(
            f"mesh_metadata.gltf mismatch: {mesh_metadata.get('gltf')!r} != {gltf_name!r}"
        )
    if bin_name is not None and mesh_metadata.get("bin") != bin_name:
        result.error(
            f"mesh_metadata.bin mismatch: {mesh_metadata.get('bin')!r} != {bin_name!r}"
        )

    entities = mesh_metadata.get("entities")
    if not isinstance(entities, list):
        result.error("mesh_metadata.entities missing or not a list")
        entities = []
    line_entities = mesh_metadata.get("line_entities")
    if line_entities is None:
        line_entities = []
    elif not isinstance(line_entities, list):
        result.error("mesh_metadata.line_entities is not a list")
        line_entities = []

    doc_layouts = collect_doc_entity_layouts(artifacts.document)
    doc_entities = collect_doc_entities_by_id(artifacts.document)
    seen_ids: set[int] = set()
    for entry in entities:
        if not isinstance(entry, dict):
            result.error("mesh_metadata.entities contains a non-object entry")
            continue
        validate_mesh_entry(
            entry,
            "mesh_metadata.entities",
            seen_ids,
            doc_spaces,
            doc_layouts,
            doc_entities,
            result,
        )

    seen_line_ids: set[int] = set()
    for entry in line_entities:
        if not isinstance(entry, dict):
            result.error("mesh_metadata.line_entities contains a non-object entry")
            continue
        validate_mesh_entry(
            entry,
            "mesh_metadata.line_entities",
            seen_line_ids,
            doc_spaces,
            doc_layouts,
            doc_entities,
            result,
        )

    result.info(
        f"mesh metadata entities={len(entities)} line_entities={len(line_entities)}"
    )

    doc_viewports = collect_doc_viewports(artifacts.document)
    summary = mesh_metadata.get("summary")
    if summary is not None:
        if not isinstance(summary, dict):
            result.error("mesh_metadata.summary is not an object")
        else:
            validate_optional_summary(summary, artifacts, artifacts.document, mesh_metadata, result)

    layout_names: List[str] = []
    layouts = mesh_metadata.get("layouts")
    if layouts is not None:
        if not isinstance(layouts, list):
            result.error("mesh_metadata.layouts is not a list")
        else:
            layout_names = validate_optional_layouts(
                layouts, doc_viewports, artifacts.document, mesh_metadata, result
            )

    viewports = mesh_metadata.get("viewports")
    if viewports is not None:
        if not isinstance(viewports, list):
            result.error("mesh_metadata.viewports is not a list")
        else:
            validate_optional_viewports(viewports, doc_viewports, layout_names, result)

    unsupported = mesh_metadata.get("unsupported")
    if unsupported is not None and not isinstance(unsupported, list):
        result.error("mesh_metadata.unsupported is not a list")
    instances = mesh_metadata.get("instances")
    if instances is not None and not isinstance(instances, list):
        result.error("mesh_metadata.instances is not a list")
    blocks = mesh_metadata.get("blocks")
    if blocks is not None and not isinstance(blocks, list):
        result.error("mesh_metadata.blocks is not a list")
    if isinstance(instances, list):
        validate_optional_instances(instances, artifacts.document, mesh_metadata, result)
    if isinstance(blocks, list):
        validate_optional_blocks(blocks, mesh_metadata, result)


def validate_optional_instances(
    instances: List[Dict[str, Any]],
    document: Dict[str, Any],
    mesh_metadata: Dict[str, Any],
    result: ValidationResult,
) -> None:
    doc_entities = collect_doc_entities_by_id(document)
    mesh_entities = [
        entry for entry in mesh_metadata.get("entities", [])
        if isinstance(entry, dict) and parse_int(entry.get("id")) is not None
    ]
    line_entities = [
        entry for entry in mesh_metadata.get("line_entities", [])
        if isinstance(entry, dict) and parse_int(entry.get("id")) is not None
    ]
    seen_groups: set[int] = set()

    for index, instance in enumerate(instances):
        location = f"mesh_metadata.instances[{index}]"
        if not isinstance(instance, dict):
            result.error(f"{location} is not an object")
            continue
        group_id = parse_int(instance.get("group_id"))
        if group_id is None or group_id < 0:
            result.error(f"{location} has invalid group_id {instance.get('group_id')!r}")
            continue
        if group_id in seen_groups:
            result.error(f"{location} duplicates group_id {group_id}")
        seen_groups.add(group_id)

        block_name = instance.get("block_name")
        if not isinstance(block_name, str) or not block_name:
            result.error(f"{location} has invalid block_name {block_name!r}")
            continue

        entity_ids = instance.get("entity_ids")
        if not isinstance(entity_ids, list) or not entity_ids:
            result.error(f"{location} has invalid entity_ids {entity_ids!r}")
            continue
        parsed_ids: List[int] = []
        for raw in entity_ids:
            value = parse_int(raw)
            if value is None:
                result.error(f"{location} contains invalid entity_id {raw!r}")
                continue
            parsed_ids.append(value)
        if parsed_ids != sorted(set(parsed_ids)):
            result.error(f"{location} entity_ids must be sorted unique integers")

        expected_doc_ids = sorted(
            entity_id
            for entity_id, entry in doc_entities.items()
            if parse_int(entry.get("group_id")) == group_id and entry.get("block_name") == block_name
        )
        if parsed_ids != expected_doc_ids:
            result.error(f"{location} entity_ids mismatch ({parsed_ids!r} != {expected_doc_ids!r})")

        expected_doc_count = len(expected_doc_ids)
        expected_mesh_count = sum(
            1
            for entry in mesh_entities
            if parse_int(entry.get("group_id")) == group_id and entry.get("block_name") == block_name
        )
        expected_line_count = sum(
            1
            for entry in line_entities
            if parse_int(entry.get("group_id")) == group_id and entry.get("block_name") == block_name
        )

        for key, expected in (
            ("document_entity_count", expected_doc_count),
            ("mesh_entity_count", expected_mesh_count),
            ("line_entity_count", expected_line_count),
        ):
            observed = parse_int(instance.get(key))
            if observed is None or observed < 0:
                result.error(f"{location} has invalid {key} {instance.get(key)!r}")
            elif observed != expected:
                result.error(f"{location} {key} mismatch ({observed} != {expected})")

        if "space" in instance:
            space = parse_int(instance.get("space"))
            if space not in (0, 1):
                result.error(f"{location} has invalid space {instance.get('space')!r}")
        if "layout" in instance:
            layout = instance.get("layout")
            if not isinstance(layout, str) or not layout:
                result.error(f"{location} has invalid layout {layout!r}")


def validate_optional_blocks(
    blocks: List[Dict[str, Any]],
    mesh_metadata: Dict[str, Any],
    result: ValidationResult,
) -> None:
    instances = [
        entry for entry in mesh_metadata.get("instances", [])
        if isinstance(entry, dict)
        and isinstance(entry.get("block_name"), str)
        and entry.get("block_name")
        and parse_int(entry.get("group_id")) is not None
    ]
    expected_by_name: Dict[str, Dict[str, int]] = {}
    for instance in instances:
        name = str(instance.get("block_name"))
        current = expected_by_name.setdefault(
            name,
            {
                "instance_count": 0,
                "document_entity_count": 0,
                "mesh_entity_count": 0,
                "line_entity_count": 0,
                "proxy_entity_count": 0,
            },
        )
        current["instance_count"] += 1
        current["document_entity_count"] += parse_int(instance.get("document_entity_count")) or 0
        current["mesh_entity_count"] += parse_int(instance.get("mesh_entity_count")) or 0
        current["line_entity_count"] += parse_int(instance.get("line_entity_count")) or 0
        if str(instance.get("edit_mode") or "") == "proxy" or str(instance.get("proxy_kind") or ""):
            current["proxy_entity_count"] += parse_int(instance.get("document_entity_count")) or 0

    seen_names: set[str] = set()
    for index, block in enumerate(blocks):
        location = f"mesh_metadata.blocks[{index}]"
        if not isinstance(block, dict):
            result.error(f"{location} is not an object")
            continue
        name = block.get("name")
        if not isinstance(name, str) or not name:
            result.error(f"{location} has invalid name {name!r}")
            continue
        if name in seen_names:
            result.error(f"{location} duplicates name {name!r}")
        seen_names.add(name)
        expected = expected_by_name.get(name)
        if expected is None:
            result.error(f"{location} references unknown block {name!r}")
            continue
        for key, expected_value in expected.items():
            observed = parse_int(block.get(key))
            if observed is None or observed < 0:
                result.error(f"{location} has invalid {key} {block.get(key)!r}")
            elif observed != expected_value:
                result.error(f"{location} {key} mismatch ({observed} != {expected_value})")


def validate_target(target: Path, quiet: bool = False) -> ValidationResult:
    manifest_path = resolve_manifest_path(target)
    label = str(target if (target.is_dir() and is_raw_preview_dir(target)) else manifest_path)
    result = ValidationResult(label=label)
    if not target.exists():
        result.error(f"target not found: {target}")
        return result
    if target.is_dir() and not manifest_path.exists() and not is_raw_preview_dir(target):
        result.error(f"manifest not found: {manifest_path}")
        return result
    if target.is_file() and not manifest_path.exists():
        result.error(f"manifest not found: {manifest_path}")
        return result

    try:
        artifacts = load_artifact_set(target)
    except KeyError as exc:
        result.error(f"manifest missing required artifact key: {exc}")
        return result
    except json.JSONDecodeError as exc:
        result.error(f"JSON parse failed: {exc}")
        return result
    except OSError as exc:
        result.error(str(exc))
        return result

    validate_manifest(artifacts, result)
    doc_spaces = validate_document(artifacts.document, result)
    validate_mesh_metadata(artifacts, doc_spaces, result)
    if not quiet and result.ok():
        result.info("all checks passed")
    return result


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate PLM preview manifest/document/mesh_metadata consistency"
    )
    parser.add_argument(
        "targets",
        nargs="+",
        help="Manifest JSON path or preview output directory containing manifest.json",
    )
    parser.add_argument("--quiet", action="store_true", help="Reduce success output")
    args = parser.parse_args(argv)

    exit_code = 0
    for raw_target in args.targets:
        result = validate_target(Path(raw_target), quiet=args.quiet)
        result.print(quiet=args.quiet)
        if not result.ok():
            exit_code = 1
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
