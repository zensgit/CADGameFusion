# Step 50: Headless Conversion CLI - Verification

## Configure
```bash
cmake -S . -B build_vcpkg -DCADGF_BUILD_PYTHON=ON
```

## Local Build
```bash
cmake --build build_vcpkg -j --target convert_cli
```

## Tests
```bash
ctest --test-dir build_vcpkg -R convert_cli_run -V
```

## Results
- `convert_cli_run`: PASS

## Notes
- Build emitted a TinyGLTF/STB warning about `sprintf` deprecation on macOS (external header).
