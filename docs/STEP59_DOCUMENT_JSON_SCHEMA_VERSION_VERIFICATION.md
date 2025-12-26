# Step 59: Document JSON Schema Version - Verification

## Build
```bash
cmake --build build_vcpkg -j
```

## Tests
```bash
ctest --test-dir build_vcpkg -R plm_convert_smoke -V
```

## Results
- `plm_convert_smoke`: PASS
