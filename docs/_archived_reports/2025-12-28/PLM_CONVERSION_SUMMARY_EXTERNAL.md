# PLM Conversion Summary (External)

## Overview
The PLM conversion pipeline provides a stable CLI for converting CAD inputs into normalized artifacts
(JSON + glTF + metadata) with a manifest suitable for PLM ingestion, auditing, and caching.

## CLI
```
python3 tools/plm_convert.py --plugin <plugin> --input <file> --out <dir>
  [--emit json,gltf,meta] [--json] [--gltf]
  [--hash-names] [--keep-legacy-names] [--strict] [--clean]
```

Key behavior:
- `--emit` controls outputs (`json`, `gltf`, `meta`), overriding `--json/--gltf`.
- `meta` implies `gltf` (metadata requires mesh output).
- `--hash-names` produces hash-named artifacts; `--keep-legacy-names` keeps legacy file names.
- `--strict` fails if requested artifacts are missing.
- `--clean` clears the output directory before conversion.

## Manifest Contract
Key fields:
- Input: `input`, `input_size`, `input_mtime`, `source_hash`
- Layout: `output_layout` (`legacy|hashed|both`)
- Outputs: `outputs` list (`json|gltf|meta`)
- Artifacts: `artifacts`, `content_hashes`, `artifact_sizes`, optional `legacy_artifacts`
- Versions: `tool_versions` (`plm_convert`, `cadgf`, `convert_cli`)
- Warnings: structured `{code, message}` entries

## Validation
- Manifest conforms to `schemas/plm_manifest.schema.json`.
- Artifact hashes and sizes are verified.
- Emit modes are validated (json/gltf/meta) and invalid emits are rejected.

## CI Coverage
- Emit smoke tests run in quick-check.
- Full conversion + emit coverage runs in core-strict builds.

## Next Steps (Optional)
- Document warning codes in a PLM integration guide.
- Add storage optimization strategies for legacy artifacts (hardlink/symlink).
