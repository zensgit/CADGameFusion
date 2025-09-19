# CAD MVP v0.1 — Data Model

## Project Structure
- Project { id, version, units, created, modified }
- Scene { entities, constraints, parameters }
- FeatureTree { nodes[], edges[] }
- Resources { sketches, meshes/BReps, materials }

## Versioned File Format (v1 JSON)
- Header: { format: "CADGF-PROJ", version: 1 }
- Sections: project, scene, featureTree, resources, meta
- Deterministic ordering, stable IDs, float policy (precision, locale)

## Persistence
- Save: atomic write with temp file + rename, backup journal, autosave slot.
- Load: version gate, migrations, integrity checks.

## Export/Import
- Exporters: glTF (mesh path first), STEP (future), JSON snapshot
- Importers: DXF/JSON prototype

