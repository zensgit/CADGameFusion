#!/usr/bin/env python3
import argparse
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
    with path.open('r', encoding='utf-8') as f:
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
    else:
        if verbose:
            print(f"✓ {data_path}: valid against {schema_path.name}")
        return 0


def main():
    ap = argparse.ArgumentParser(description="Validate CADGameFusion project JSON against schema")
    ap.add_argument("file", help="Project JSON file to validate")
    ap.add_argument("--schema", default=str(Path("schemas") / "project.schema.json"), help="Path to JSON Schema")
    ap.add_argument("--quiet", action="store_true", help="Reduce output on success")
    args = ap.parse_args()

    data_path = Path(args.file)
    schema_path = Path(args.schema)
    if not schema_path.exists():
        print(f"Schema not found: {schema_path}", file=sys.stderr)
        return 2
    if not data_path.exists():
        print(f"Data file not found: {data_path}", file=sys.stderr)
        return 2

    return validate_file(schema_path, data_path, verbose=not args.quiet)


if __name__ == "__main__":
    sys.exit(main())

