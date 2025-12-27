#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


def find_convert_cli(repo_root: Path) -> Path:
    candidates = [
        repo_root / "build_vcpkg" / "tools" / "convert_cli",
        repo_root / "build" / "tools" / "convert_cli",
        repo_root / "build_vcpkg" / "tools" / "convert_cli.exe",
        repo_root / "build" / "tools" / "convert_cli.exe",
    ]
    for path in candidates:
        if path.exists():
            return path
    return Path()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="PLM conversion entrypoint (plugin import -> artifacts)")
    parser.add_argument("--plugin", required=True, help="Importer plugin shared library path")
    parser.add_argument("--input", required=True, help="Input CAD/JSON file")
    parser.add_argument("--out", required=True, help="Output directory")
    parser.add_argument("--json", action="store_true", help="Emit document.json")
    parser.add_argument("--gltf", action="store_true", help="Emit mesh.gltf + mesh.bin + metadata")
    parser.add_argument("--emit", help="Comma-separated outputs: json,gltf,meta")
    parser.add_argument("--hash-names", action="store_true", help="Rename artifacts with content hashes")
    parser.add_argument("--keep-legacy-names", action="store_true", help="Keep legacy artifact names alongside hashed ones")
    parser.add_argument("--strict", action="store_true", help="Fail if any requested artifacts are missing")
    parser.add_argument("--clean", action="store_true", help="Remove existing outputs in --out before conversion")
    parser.add_argument("--convert-cli", help="Override convert_cli path")
    parser.add_argument("--migrate-document", action="store_true", help="Run document_migrate on document.json")
    parser.add_argument("--document-target", type=int, default=2, help="Target document schema version")
    parser.add_argument("--document-backup", action="store_true", help="Create .bak when migrating in place")
    return parser.parse_args()


def read_cadgf_version(doc_path: Path) -> str:
    if not doc_path.exists():
        return ""
    try:
        with doc_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data.get("cadgf_version", "")
    except Exception:
        return ""


def read_document_schema_version(doc_path: Path):
    if not doc_path.exists():
        return None
    try:
        with doc_path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        value = data.get("schema_version")
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    except Exception:
        return None
    return None


def compute_sha256(path: Path) -> str:
    if not path.exists():
        return ""
    try:
        hasher = hashlib.sha256()
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception:
        return ""


def get_input_stats(path: Path):
    if not path.exists():
        return 0, ""
    try:
        stat = path.stat()
        size = int(stat.st_size)
        mtime = dt.datetime.utcfromtimestamp(stat.st_mtime).isoformat(timespec="seconds") + "Z"
        return size, mtime
    except Exception:
        return 0, ""


def update_json_file(path: Path, updater) -> bool:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not updater(data):
            return False
        with path.open("w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2)
            fh.write("\n")
        return True
    except Exception:
        return False


def update_gltf_buffer_uri(gltf_path: Path, bin_name: str) -> bool:
    def updater(data):
        buffers = data.get("buffers")
        if not buffers or not isinstance(buffers, list) or not isinstance(buffers[0], dict):
            return False
        buffers[0]["uri"] = bin_name
        return True

    return update_json_file(gltf_path, updater)


def update_mesh_metadata(meta_path: Path, gltf_name: str, bin_name: str) -> bool:
    def updater(data):
        if not isinstance(data, dict):
            return False
        data["gltf"] = gltf_name
        data["bin"] = bin_name
        return True

    return update_json_file(meta_path, updater)


def rename_with_hash(path: Path, prefix: str, digest: str) -> Path:
    if not digest:
        return path
    new_path = path.with_name(f"{prefix}_{digest}{path.suffix}")
    if new_path != path:
        path.replace(new_path)
    return new_path


def write_legacy_copy(src: Path, legacy_path: Path) -> bool:
    try:
        shutil.copy2(src, legacy_path)
        return True
    except Exception:
        return False


def add_warning(warnings, code: str, message: str) -> None:
    warnings.append({"code": code, "message": message})


def run_document_migrate(doc_path: Path, target: int, backup: bool) -> str:
    migrate_script = Path(__file__).resolve().parents[1] / "tools" / "document_migrate.py"
    if not migrate_script.exists():
        return "document_migrate.py not found"
    cmd = [sys.executable, str(migrate_script), "--input", str(doc_path), "--target", str(target)]
    if backup:
        cmd.append("--backup")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip()
        return message or "document_migrate failed"
    return ""


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]

    convert_cli = Path(args.convert_cli) if args.convert_cli else find_convert_cli(repo_root)
    if not convert_cli.exists():
        print("convert_cli not found. Build it first (build_vcpkg/tools/convert_cli).", file=sys.stderr)
        return 2

    emit_json = args.json or not args.gltf
    emit_gltf = args.gltf or not args.json
    emit_meta = False
    if args.emit:
        tokens = [t.strip().lower() for t in args.emit.split(",") if t.strip()]
        allowed = {"json", "gltf", "meta"}
        bad = [t for t in tokens if t not in allowed]
        if bad:
            print(f"Unknown emit values: {', '.join(bad)}", file=sys.stderr)
            return 2
        emit_json = "json" in tokens
        emit_gltf = "gltf" in tokens or "meta" in tokens
        emit_meta = "meta" in tokens
        if not emit_json and not emit_gltf:
            print("Emit set must include at least one of: json,gltf,meta", file=sys.stderr)
            return 2
    keep_legacy = args.hash_names and args.keep_legacy_names

    out_dir = Path(args.out)
    if args.clean and out_dir.exists():
        if out_dir.is_dir():
            shutil.rmtree(out_dir)
        else:
            print(f"Output path is not a directory: {out_dir}", file=sys.stderr)
            return 2
    out_dir.mkdir(parents=True, exist_ok=True)

    cmd = [str(convert_cli), "--plugin", args.plugin, "--input", args.input, "--out", str(out_dir)]
    if emit_json:
        cmd.append("--json")
    if emit_gltf:
        cmd.append("--gltf")

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr.strip(), file=sys.stderr)
        return result.returncode

    input_path = Path(args.input)
    input_size, input_mtime = get_input_stats(input_path)
    output_layout = "legacy"
    if args.hash_names and args.keep_legacy_names:
        output_layout = "both"
    elif args.hash_names:
        output_layout = "hashed"

    if args.migrate_document and not emit_json:
        print("Document migration requires json output (use --emit json or --json).", file=sys.stderr)
        return 2

    plm_convert_version = "1"
    manifest = {
        "schema_version": "1",
        "input": os.path.abspath(args.input),
        "input_size": input_size,
        "input_mtime": input_mtime,
        "source_hash": compute_sha256(input_path),
        "plugin": os.path.abspath(args.plugin),
        "output_dir": os.path.abspath(str(out_dir)),
        "output_layout": output_layout,
        "generated_at": dt.datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "cadgf_version": "",
        "artifacts": {},
        "content_hashes": {},
        "artifact_sizes": {},
        "tool_versions": {
            "plm_convert": plm_convert_version,
            "cadgf": "",
            "convert_cli": "",
        },
        "outputs": [],
        "warnings": [],
        "status": "ok",
    }
    legacy_artifacts = {}

    missing = []
    warnings = []
    outputs = []
    doc_path = out_dir / "document.json"
    if emit_json and doc_path.exists():
        if args.migrate_document:
            message = run_document_migrate(doc_path, args.document_target, args.document_backup)
            if message:
                print(f"document_migrate failed: {message}", file=sys.stderr)
                return 4
        doc_version = read_cadgf_version(doc_path)
        doc_schema_version = read_document_schema_version(doc_path)
        doc_hash = compute_sha256(doc_path)
        doc_size = doc_path.stat().st_size
        if args.hash_names:
            doc_path = rename_with_hash(doc_path, "document", doc_hash)
            if keep_legacy:
                legacy_doc = out_dir / "document.json"
                if not write_legacy_copy(doc_path, legacy_doc):
                    msg = "legacy document.json copy failed"
                    print(msg, file=sys.stderr)
                    add_warning(warnings, "legacy_document_copy_failed", msg)
                else:
                    legacy_artifacts["document_json"] = legacy_doc.name
        manifest["artifacts"]["document_json"] = str(doc_path.name)
        if doc_hash:
            manifest["content_hashes"]["document_json"] = doc_hash
        manifest["artifact_sizes"]["document_json"] = int(doc_size)
        manifest["cadgf_version"] = doc_version
        manifest["tool_versions"]["cadgf"] = doc_version
        manifest["tool_versions"]["convert_cli"] = doc_version
        if doc_schema_version is not None:
            manifest["document_schema_version"] = doc_schema_version
        outputs.append("json")
    else:
        if emit_json:
            if args.migrate_document:
                print("document.json missing; migration requested.", file=sys.stderr)
                return 4
            manifest["status"] = "partial"
            missing.append(str(doc_path.name))

    gltf_path = out_dir / "mesh.gltf"
    bin_path = out_dir / "mesh.bin"
    meta_path = out_dir / "mesh_metadata.json"
    if emit_gltf and gltf_path.exists():
        gltf_name = gltf_path.name
        bin_name = bin_path.name
        if bin_path.exists():
            bin_size = bin_path.stat().st_size
            bin_hash = compute_sha256(bin_path)
            if args.hash_names:
                bin_path = rename_with_hash(bin_path, "mesh", bin_hash)
                bin_name = bin_path.name
            manifest["artifacts"]["mesh_bin"] = str(bin_name)
            if bin_hash:
                manifest["content_hashes"]["mesh_bin"] = bin_hash
            manifest["artifact_sizes"]["mesh_bin"] = int(bin_size)
            if keep_legacy:
                legacy_bin = out_dir / "mesh.bin"
                if not write_legacy_copy(bin_path, legacy_bin):
                    msg = "legacy mesh.bin copy failed"
                    print(msg, file=sys.stderr)
                    add_warning(warnings, "legacy_mesh_bin_copy_failed", msg)
                else:
                    legacy_artifacts["mesh_bin"] = legacy_bin.name
        if not bin_path.exists():
            manifest["status"] = "partial"
            missing.append(str(bin_path.name))
            bin_name = ""
        if args.hash_names and bin_name:
            if not update_gltf_buffer_uri(gltf_path, bin_name):
                print("Failed to update glTF buffer uri for hashed bin.", file=sys.stderr)
                return 4
        gltf_hash = compute_sha256(gltf_path)
        gltf_size = gltf_path.stat().st_size
        if args.hash_names:
            gltf_path = rename_with_hash(gltf_path, "mesh", gltf_hash)
            gltf_name = gltf_path.name
        manifest["artifacts"]["mesh_gltf"] = str(gltf_name)
        if gltf_hash:
            manifest["content_hashes"]["mesh_gltf"] = gltf_hash
        manifest["artifact_sizes"]["mesh_gltf"] = int(gltf_size)
        if keep_legacy:
            legacy_gltf = out_dir / "mesh.gltf"
            if not write_legacy_copy(gltf_path, legacy_gltf):
                msg = "legacy mesh.gltf copy failed"
                print(msg, file=sys.stderr)
                add_warning(warnings, "legacy_mesh_gltf_copy_failed", msg)
            else:
                if not update_gltf_buffer_uri(legacy_gltf, "mesh.bin"):
                    msg = "legacy glTF buffer uri update failed"
                    print(msg, file=sys.stderr)
                    add_warning(warnings, "legacy_mesh_gltf_uri_update_failed", msg)
                legacy_artifacts["mesh_gltf"] = legacy_gltf.name
        if emit_meta:
            if meta_path.exists():
                if args.hash_names and bin_name:
                    if not update_mesh_metadata(meta_path, gltf_name, bin_name):
                        print("Failed to update mesh metadata for hashed names.", file=sys.stderr)
                        return 4
                meta_hash = compute_sha256(meta_path)
                meta_size = meta_path.stat().st_size
                if args.hash_names:
                    meta_path = rename_with_hash(meta_path, "mesh_metadata", meta_hash)
                manifest["artifacts"]["mesh_metadata"] = str(meta_path.name)
                if meta_hash:
                    manifest["content_hashes"]["mesh_metadata"] = meta_hash
                manifest["artifact_sizes"]["mesh_metadata"] = int(meta_size)
                if keep_legacy:
                    legacy_meta = out_dir / "mesh_metadata.json"
                    if not write_legacy_copy(meta_path, legacy_meta):
                        msg = "legacy mesh_metadata.json copy failed"
                        print(msg, file=sys.stderr)
                        add_warning(warnings, "legacy_mesh_metadata_copy_failed", msg)
                    else:
                        if not update_mesh_metadata(legacy_meta, "mesh.gltf", "mesh.bin"):
                            msg = "legacy mesh_metadata update failed"
                            print(msg, file=sys.stderr)
                            add_warning(warnings, "legacy_mesh_metadata_update_failed", msg)
                        legacy_artifacts["mesh_metadata"] = legacy_meta.name
                outputs.append("meta")
            else:
                manifest["status"] = "partial"
                missing.append(str(meta_path.name))
        else:
            if meta_path.exists():
                try:
                    meta_path.unlink()
                except Exception:
                    msg = "mesh_metadata cleanup failed"
                    print(msg, file=sys.stderr)
                    add_warning(warnings, "mesh_metadata_cleanup_failed", msg)
        outputs.append("gltf")
    else:
        if emit_gltf:
            manifest["status"] = "partial"
            missing.append(str(gltf_path.name))

    if emit_meta and "meta" not in outputs and emit_gltf:
        manifest["status"] = "partial"

    if outputs:
        manifest["outputs"] = sorted(set(outputs))
    if legacy_artifacts:
        manifest["legacy_artifacts"] = legacy_artifacts
    if warnings:
        manifest["warnings"] = warnings

    manifest_path = out_dir / "manifest.json"
    with manifest_path.open("w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    print(f"Wrote manifest: {manifest_path}")
    if args.strict and missing:
        print(f"Missing artifacts: {', '.join(missing)}", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
