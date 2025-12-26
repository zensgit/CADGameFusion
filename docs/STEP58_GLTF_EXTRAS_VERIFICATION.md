# Step 58: glTF Extras Metadata - Verification

## Build
```bash
cmake --build build_vcpkg -j
```

## Tests
```bash
ctest --test-dir build_vcpkg -R plm_emit_gltf_smoke -V
```

## Manual Check
```bash
rm -rf build_vcpkg/tmp_gltf_extra
mkdir -p build_vcpkg/tmp_gltf_extra
build_vcpkg/tools/convert_cli \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tests/plugin_data/importer_sample.dxf \
  --out build_vcpkg/tmp_gltf_extra \
  --gltf --json
python3 - <<'PY'
import json
from pathlib import Path
path = Path('build_vcpkg/tmp_gltf_extra/mesh.gltf')
obj = json.loads(path.read_text())
extras = obj.get('nodes', [{}])[0].get('extras')
print(json.dumps(extras, indent=2, sort_keys=True))
PY
```

## Results
- `plm_emit_gltf_smoke`: PASS
- `mesh.gltf` contains `extras.cadgf.document` and `extras.cadgf.layers`
