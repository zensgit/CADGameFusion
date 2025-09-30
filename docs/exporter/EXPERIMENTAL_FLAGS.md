## Exporter Experimental Flags

Status: Prototype (non-blocking, optional)

These feature flags extend the glTF export produced by `export_cli` without impacting existing strict validation flows. They are OFF by default.

### Flags
- `--emit-normals`  
  Adds a `NORMAL` accessor (flat shading) with every vertex normal = (0,0,1).  
  Buffer layout: positions, normals, (uvs), indices.

- `--emit-uvs`  
  Adds a `TEXCOORD_0` accessor with every UV = (0,0).  
  Useful to pre‑allocate channels for downstream tooling expecting UV presence.

- `--emit-materials-stub`  
  Adds one default material and sets `primitive.material = 0`.  
  Material schema: name="Default", roughness=1, metallic=0, baseColorFactor=[1,1,1,1].

### When to Use
| Scenario | Enable? | Rationale |
|----------|---------|-----------|
| Structural pipeline validation | Yes (trial) | Confirms consumer can parse added attributes |
| Size / performance baseline | Yes/No | Compare buffer growth impact |
| Production strict export | No | Keep legacy stable until adoption window |

### Quick Matrix (What Gets Emitted)
| --emit-normals | --emit-uvs | --emit-materials-stub | Accessors            | Materials |
|----------------|------------|-----------------------|----------------------|-----------|
| off            | off        | off                   | POSITION, INDICES    | none      |
| on             | off        | off                   | POSITION, NORMAL, INDICES | none |
| off            | on         | off                   | POSITION, TEXCOORD_0, INDICES | none |
| on             | on         | off                   | POSITION, NORMAL, TEXCOORD_0, INDICES | none |
| on             | on         | on                    | POSITION, NORMAL, TEXCOORD_0, INDICES | default(1) |

### glTF Layout Impact
Without flags:  
```
buffers: 1
bufferViews: [positions, indices]
accessors:  [POSITION, INDICES]
```

With all flags:  
```
bufferViews: [positions, normals, uvs, indices]
accessors:  [POSITION, NORMAL, TEXCOORD_0, INDICES]
materials:  [default]
primitive.attributes: {POSITION, NORMAL, TEXCOORD_0}, material:0
```

### Validation
`tools/validate_export.py` now reports:
- Presence and count of NORMAL / TEXCOORD_0 accessors
- Materials stub count
- Buffer/byteLength consistency

### Out of Scope (for this prototype)
- Tangents generation
- Packed / quantized attributes
- Material variants or PBR extensions

### Migration Strategy
1. Trial workflow (non-blocking) runs with flags ON.
2. Collect downstream feedback (compatibility, size impact).
3. Decide per-flag promotion path (e.g. normals always ON, others optional).

### Example Commands
```bash
./build/tools/export_cli --scene sample --out build/exports --emit-normals
./build/tools/export_cli --scene sample --out build/exports --emit-normals --emit-uvs
./build/tools/export_cli --scene sample --out build/exports --emit-normals --emit-uvs --emit-materials-stub
python3 tools/validate_export.py build/exports/scene_cli_sample
```

Tip: Combine with a clean output directory when iterating locally:
```bash
rm -rf build/exports/scene_cli_sample && \
./build/tools/export_cli --scene sample --out build/exports --emit-normals --emit-uvs --emit-materials-stub && \
python3 tools/validate_export.py build/exports/scene_cli_sample
```

CI integration: The matrix variants are exercised in "Exporter Trial (Experimental Flags)" workflow. Artifacts are uploaded per combination for quick inspection.

### Next Steps
- (Planned) GitHub Actions trial workflow matrix with toggled flags
- Potential JSON meta annotation (e.g. `meta.pipelineFlags`) for traceability
