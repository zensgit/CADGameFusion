# PR-07 P1 Entities Verification

## Scope
- Add Ellipse/Spline/Text to Document + C API.
- Extend entity type mapping and tests.

## Build
- `cmake --build build -j --target core_tests_document_entities core_tests_c_api_document_query`

## Tests
- `ctest --test-dir build -R core_tests_document_entities -V`
- `ctest --test-dir build -R core_tests_c_api_document_query -V`

## Results
- `core_tests_document_entities`: Passed.
- `core_tests_c_api_document_query`: Passed.
