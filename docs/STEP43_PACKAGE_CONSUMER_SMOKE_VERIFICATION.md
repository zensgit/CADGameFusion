# Step 43: CMake Package Consumer Smoke Test - Verification

## Commands
1. `cmake --build build_vcpkg -j --target core_c`
2. `ctest --test-dir build_vcpkg -R package_consumer_smoke -V`

## Result
- PASS
