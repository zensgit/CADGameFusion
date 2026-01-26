# VemCAD Web Viewer Visual Parity Verification

## Local Checks (Scripted)
- Source document: `tools/web_viewer/test_output/j1424042_browser/document.json`
- Results (pre-regeneration):
  - Line types: `Continuous`, `DASHED`
  - Line weights: `0.13`, `0.15`, `0.25`, `0.35`
  - Hatch entities: `4` (`__cadgf_hatch:<id>` polylines)
  - `text_style` metadata: **0 keys** (expected; requires re-convert after importer change)

Command used:
```bash
python3 - <<'PY'
import json, pathlib
path = pathlib.Path('tools/web_viewer/test_output/j1424042_browser/document.json')
with path.open() as f:
    data = json.load(f)
ents = data.get('entities', [])
line_types = sorted({e.get('line_type') for e in ents if isinstance(e, dict) and e.get('line_type')})
weights = sorted({e.get('line_weight') for e in ents if isinstance(e, dict) and e.get('line_weight')})
hatches = [e for e in ents if isinstance(e, dict) and '__cadgf_hatch:' in str(e.get('name',''))]
meta = data.get('metadata', {}).get('meta', {})
text_style_keys = [k for k in meta if k.endswith('.text_style')]
print('line_types', line_types)
print('line_weights', weights[:5], '... total', len(weights))
print('hatch_entities', len(hatches))
print('text_style_meta_keys', len(text_style_keys))
PY
```

## Local Checks (Post-Regeneration)
- Source document: `tools/web_viewer/test_output/j1424042_refresh/document.json`
- Results:
  - `text_style` metadata: **157 keys**
  - Styles observed: `HC_GBDIM`, `HC_TEXTSTYLE1`, `HGCAD`, `标准`
  - `dxf.linetype.*.pattern` metadata: verify patterns are present

Commands used:
```bash
tools/oda_convert.sh "/Users/huazhou/Downloads/训练图纸/训练图纸/J1424042-00出料正压隔离器v2-yuantus.dwg" \
  "tools/web_viewer/test_output/j1424042_refresh/j1424042.dxf"

python3 tools/plm_preview.py \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tools/web_viewer/test_output/j1424042_refresh/j1424042.dxf \
  --out tools/web_viewer/test_output/j1424042_refresh \
  --emit json,gltf,meta \
  --convert-cli build_vcpkg/tools/convert_cli \
  --project-id yuantus \
  --document-label "J1424042-00出料正压隔离器v2"
```

## Linetype Metadata Check
Commands used:
```bash
python3 - <<'PY'
import json, pathlib
path = pathlib.Path('tools/web_viewer/test_output/j1424042_refresh/document.json')
with path.open() as f:
    data = json.load(f)
meta = data.get('metadata', {}).get('meta', {})
lt_keys = [k for k in meta if k.startswith('dxf.linetype.') and k.endswith('.pattern')]
print('linetype_meta_keys', len(lt_keys))
print('linetype_samples', lt_keys[:5])
PY
```

## Local Checks (Linetype Metadata Run)
- Source document: `tools/web_viewer/test_output/j1424042_ltype/document.json`
- Results:
  - `dxf.linetype.*.pattern` keys: 3 (CENTER, DASHED, PHANTOM)
  - Outputs: json only (TinyGLTF missing in build_vcpkg_local)

Commands used:
```bash
cmake -S . -B build_vcpkg_local -DCMAKE_BUILD_TYPE=Release -DBUILD_EDITOR_QT=ON
cmake --build build_vcpkg_local --target cadgf_dxf_importer_plugin -j
cmake --build build_vcpkg_local --target convert_cli -j
tools/oda_convert.sh "/Users/huazhou/Downloads/训练图纸/训练图纸/J1424042-00出料正压隔离器v2-yuantus.dwg" \
  "tools/web_viewer/test_output/j1424042_ltype/j1424042.dxf"
python3 tools/plm_preview.py \
  --plugin build_vcpkg_local/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input tools/web_viewer/test_output/j1424042_ltype/j1424042.dxf \
  --out tools/web_viewer/test_output/j1424042_ltype \
  --emit json,gltf,meta \
  --convert-cli build_vcpkg_local/tools/convert_cli \
  --project-id yuantus \
  --document-label "J1424042-00出料正压隔离器v2"
```

## Manual Visual Verification
1. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```
2. Open the web viewer and load a manifest:
   ```
    http://localhost:8080/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_browser/manifest.json
    ```
   Updated manifest after regeneration:
   ```
   http://localhost:8080/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_refresh/manifest.json
   ```
   Linetype + glTF manifest (TinyGLTF build):
   ```
   http://localhost:8080/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_ltype_gltf/manifest.json
   ```
3. Confirm:
   - Dashed lines render (DASHED entities should show gaps).
   - Hatch regions appear as light fills behind linework.
   - Text uses CJK-capable font stack.
   - Frame bounds match the intended drawing extents.

## Playwright Capture
- Output screenshot: `test_artifacts/web_viewer_preview_j1424042_refresh.png`
- URL: `http://localhost:8808/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_refresh/manifest.json`
- Output screenshot: `test_artifacts/web_viewer_preview_j1424042_ltype_gltf.png`
- URL: `http://localhost:8808/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_ltype_gltf/manifest.json`
- Output screenshot: `test_artifacts/web_viewer_preview_j1424042_ltype_gltf_pattern.png`
- URL: `http://localhost:8808/tools/web_viewer/index.html?manifest=tools/web_viewer/test_output/j1424042_ltype_gltf/manifest.json`

## Required Regeneration
- Re-run conversion for DWG/DXF inputs after updating the DXF importer to emit `text_style` and `dxf.linetype.*` metadata.
- This is necessary for style-based font selection to appear in the viewer.
