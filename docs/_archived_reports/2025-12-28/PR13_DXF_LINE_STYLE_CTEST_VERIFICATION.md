# PR-13 DXF Line Style CTest Verification

## Scope
- Add a CTest that runs DXF import via `convert_cli` and validates line style fields in JSON.

## Configure
- `cmake -S . -B build`

## Test
- `ctest --test-dir build -R dxf_line_style_smoke -V`

## Results
- `dxf_line_style_smoke`: Passed (JSON contains expected line style fields).
