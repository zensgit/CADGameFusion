# PR-08 Line Style Fields Verification

## Scope
- Add per-entity line style fields (line type, weight, scale) to Document and C API.
- Cover setters/getters in tests.

## Build
- `cmake --build build -j --target core_tests_document_entities core_tests_c_api_document_query`

## Tests
- `ctest --test-dir build -R core_tests_document_entities -V`
- `ctest --test-dir build -R core_tests_c_api_document_query -V`

## Results
- `core_tests_document_entities`: Passed.
- `core_tests_c_api_document_query`: Passed.
