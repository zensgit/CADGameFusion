## Build

From the worktree root:

```bash
cmake -S . -B build-codex
cmake --build build-codex --target cadgf_dxf_importer_plugin --parallel 8
```

## Required Tests

Build runnable DXF/DWG test targets, excluding the known baseline-blocked
`test_dxf_leader_metadata` compile target:

```bash
targets=($(python3 - <<'PY'
import re
from pathlib import Path
text = Path('tests/tools/CMakeLists.txt').read_text()
for name in re.findall(r'add_executable\\((test_[A-Za-z0-9_]+)', text):
    if ('dxf' in name or 'dwg' in name) and name != 'test_dxf_leader_metadata':
        print(name)
PY
))
cmake --build build-codex --target "${targets[@]}" --parallel 8
```

Then run the same runnable subset gate:

```bash
cd build-codex
ctest --output-on-failure -R "dxf|dwg" -E "(convert_cli_dxf_style_smoke|test_dxf_leader_metadata_run|test_dxf_multi_layout_metadata_run|test_dxf_paperspace_insert_styles_run|test_dxf_paperspace_insert_dimension_run|test_dxf_paperspace_combo_run)"
```

## Acceptance Gate

- `cadgf_dxf_importer_plugin` builds
- runnable DXF/DWG subset passes
- no newly widened failure surface relative to B3b
- `git diff --check` is clean

## Non-Goals For This Packet

Failure here should not be explained by:

- zero-record dispatcher changes
- header/object/entity field parsing changes
- parser full state-machine extraction
- committer extraction
- final plugin-shell slimming
