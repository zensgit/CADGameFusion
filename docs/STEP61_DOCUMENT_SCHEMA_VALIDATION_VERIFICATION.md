# Step 61: Document JSON Schema Validation - Verification

## Build
```bash
cmake --build build_vcpkg -j
```

## Tests
```bash
ctest --test-dir build_vcpkg -R plm_ -V
```

## Results
- `plm_convert_smoke`: PASS
- `plm_emit_json_smoke`: PASS
- `plm_emit_gltf_smoke`: PASS
- `plm_emit_meta_smoke`: PASS
- `plm_emit_invalid_smoke`: PASS
