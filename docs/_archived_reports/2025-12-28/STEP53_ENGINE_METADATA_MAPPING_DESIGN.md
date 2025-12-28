# Step 53: Engine Metadata Mapping - Design

## Goal
Provide an engine-friendly mapping between CAD entities and glTF mesh ranges, enabling selection/highlight in Unity or Godot.

## Metadata Sidecar
`convert_cli` now emits `mesh_metadata.json` alongside `mesh.gltf`:
```json
{
  "gltf": "mesh.gltf",
  "bin": "mesh.bin",
  "entities": [
    {"id": 1, "name": "square", "layer_id": 0, "line_type": "HIDDEN", "line_weight": 0.15, "line_type_scale": 0.75, "base_vertex": 0, "vertex_count": 4, "index_offset": 0, "index_count": 6}
  ]
}
```

## Unity Integration (Sample)
- `adapters/unity/MetadataMapping.cs` shows a minimal loader using `JsonUtility` (including line style fields).
- After loading glTF, use `base_vertex/index_offset` ranges to color or isolate geometry.

## Godot Integration (Notes)
- Parse `mesh_metadata.json` with `JSON.parse`.
- Map `index_offset/index_count` into an `ArrayMesh` surface or use a custom shader mask.

## Files Added/Updated
- `tools/convert_cli.cpp`
- `adapters/unity/MetadataMapping.cs`
- `docs/STEP53_ENGINE_METADATA_MAPPING_DESIGN.md`
