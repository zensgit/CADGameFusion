# Step 49: Python Bindings - Verification

## Configure
```bash
cmake -S . -B build_vcpkg -DCADGF_BUILD_PYTHON=ON
```

## Local Build
```bash
cmake --build build_vcpkg -j --target cadgf
```

## Tests
```bash
ctest --test-dir build_vcpkg -R python_cadgf_smoke_run -V
```

## Results
- `python_cadgf_smoke_run`: PASS
