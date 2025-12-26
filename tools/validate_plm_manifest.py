#!/usr/bin/env python3
import argparse
import hashlib
import json
import sys
from pathlib import Path

try:
    import jsonschema
    from jsonschema import Draft202012Validator
except ImportError:
    print("jsonschema module not found. Install with: pip install jsonschema", file=sys.stderr)
    sys.exit(2)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_file(schema_path: Path, data_path: Path, verbose: bool = True) -> int:
    schema = load_json(schema_path)
    data = load_json(data_path)
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(data), key=lambda e: e.path)
    if errors:
        print(f"✗ {data_path}: {len(errors)} validation error(s)")
        for e in errors:
            loc = "$" + ("/" + "/".join(str(p) for p in e.path) if e.path else "")
            print(f"  - {loc}: {e.message}")
        return 1
    if verbose:
        print(f"✓ {data_path}: valid against {schema_path.name}")
    return 0


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_artifact_hashes(
    manifest: dict,
    manifest_path: Path,
    check_names: bool,
    quiet: bool,
) -> int:
    artifacts = manifest.get("artifacts", {})
    content_hashes = manifest.get("content_hashes", {})
    artifact_sizes = manifest.get("artifact_sizes", {})
    legacy = manifest.get("legacy_artifacts", {})
    outputs = set(manifest.get("outputs", []))
    out_dir = Path(manifest.get("output_dir", manifest_path.parent))
    errors = []

    if "json" in outputs and "document_json" not in artifacts:
        errors.append("outputs includes json but artifacts.document_json missing")
    if "gltf" in outputs and ("mesh_gltf" not in artifacts or "mesh_bin" not in artifacts):
        errors.append("outputs includes gltf but artifacts.mesh_gltf or artifacts.mesh_bin missing")
    if "meta" in outputs and "mesh_metadata" not in artifacts:
        errors.append("outputs includes meta but artifacts.mesh_metadata missing")

    if "document_json" in artifacts and "json" not in outputs:
        errors.append("artifacts.document_json present but outputs missing json")
    if ("mesh_gltf" in artifacts or "mesh_bin" in artifacts) and "gltf" not in outputs:
        errors.append("artifacts.mesh_gltf/mesh_bin present but outputs missing gltf")
    if "mesh_metadata" in artifacts and "meta" not in outputs:
        errors.append("artifacts.mesh_metadata present but outputs missing meta")

    for key, filename in artifacts.items():
        expected = content_hashes.get(key)
        if not expected:
            errors.append(f"missing content_hashes entry for {key}")
            continue
        file_path = out_dir / filename
        if not file_path.exists():
            errors.append(f"missing artifact file for {key}: {file_path}")
            continue
        actual = compute_sha256(file_path)
        if actual != expected:
            errors.append(f"hash mismatch for {key}: expected {expected}, got {actual}")
        if check_names and expected not in filename:
            errors.append(f"filename for {key} does not include hash: {filename}")
        expected_size = artifact_sizes.get(key)
        if expected_size is None:
            errors.append(f"missing artifact_sizes entry for {key}")
        else:
            actual_size = file_path.stat().st_size
            if int(expected_size) != int(actual_size):
                errors.append(f"size mismatch for {key}: expected {expected_size}, got {actual_size}")

    if errors:
        print(f"✗ {manifest_path}: {len(errors)} hash validation error(s)")
        for err in errors:
            print(f"  - {err}")
        return 1

    legacy_missing = []
    if legacy:
        for key, filename in legacy.items():
            legacy_path = out_dir / filename
            if not legacy_path.exists():
                legacy_missing.append(f"{key}: {legacy_path}")
    if legacy_missing:
        print(f"✗ {manifest_path}: {len(legacy_missing)} legacy artifact(s) missing")
        for err in legacy_missing:
            print(f"  - {err}")
        return 1

    if not quiet:
        print(f"✓ {manifest_path}: artifact hashes verified")
        print(f"✓ {manifest_path}: artifact sizes verified")
        print(f"✓ {manifest_path}: outputs verified")
        if legacy:
            print(f"✓ {manifest_path}: legacy artifacts verified")
        warnings = manifest.get("warnings", [])
        if warnings:
            print(f"✓ {manifest_path}: warnings present ({len(warnings)})")
    return 0


def validate_document_schema(
    manifest: dict,
    manifest_path: Path,
    schema_path: Path,
    quiet: bool,
    require_schema: bool,
) -> int:
    outputs = set(manifest.get("outputs", []))
    if "json" not in outputs:
        return 0

    artifacts = manifest.get("artifacts", {})
    doc_name = artifacts.get("document_json")
    if not doc_name:
        print(f"✗ {manifest_path}: outputs includes json but artifacts.document_json missing")
        return 1

    out_dir = Path(manifest.get("output_dir", manifest_path.parent))
    doc_path = out_dir / doc_name
    if not doc_path.exists():
        print(f"✗ {manifest_path}: document_json missing: {doc_path}")
        return 1

    if not schema_path.exists():
        if require_schema:
            print(f"Schema not found: {schema_path}", file=sys.stderr)
            return 2
        return 0

    return validate_file(schema_path, doc_path, verbose=not quiet)


def main() -> int:
    ap = argparse.ArgumentParser(description="Validate PLM manifest JSON against schema")
    ap.add_argument("file", help="Manifest JSON file to validate")
    ap.add_argument(
        "--schema",
        default=str(Path("schemas") / "plm_manifest.schema.json"),
        help="Path to JSON Schema",
    )
    ap.add_argument(
        "--document-schema",
        default=str(Path("schemas") / "document.schema.json"),
        help="Path to document.json schema",
    )
    ap.add_argument("--quiet", action="store_true", help="Reduce output on success")
    ap.add_argument("--check-hashes", action="store_true", help="Verify artifact hashes")
    ap.add_argument("--check-names", action="store_true", help="Verify artifact filenames include hash")
    ap.add_argument("--check-document", action="store_true", help="Validate document.json against schema")
    args = ap.parse_args()
    if args.check_names:
        args.check_hashes = True

    data_path = Path(args.file)
    schema_path = Path(args.schema)
    if not schema_path.exists():
        print(f"Schema not found: {schema_path}", file=sys.stderr)
        return 2
    if not data_path.exists():
        print(f"Data file not found: {data_path}", file=sys.stderr)
        return 2

    result = validate_file(schema_path, data_path, verbose=not args.quiet)
    if result != 0:
        return result

    manifest = None
    if args.check_hashes or args.check_document:
        manifest = load_json(data_path)

    if args.check_hashes:
        rc = validate_artifact_hashes(manifest, data_path, args.check_names, args.quiet)
        if rc != 0:
            return rc

    if args.check_document or args.check_hashes:
        doc_schema_path = Path(args.document_schema)
        rc = validate_document_schema(
            manifest,
            data_path,
            doc_schema_path,
            args.quiet,
            args.check_document,
        )
        if rc != 0:
            return rc

    return 0


if __name__ == "__main__":
    sys.exit(main())
