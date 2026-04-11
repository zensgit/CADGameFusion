## Scope

Implement the next DXF modularization batch on top of leaf modules already extracted in Batch 1.

This packet covers only mid-layer helpers from:

- `plugins/dxf_importer_plugin.cpp`

Target modules:

- `plugins/dxf_metadata_writer.h/.cpp`
- `plugins/dxf_style.h/.cpp`
- `plugins/dxf_text_handler.h/.cpp`

Do not extract parser state-machine code, document committer code, insert handling, or hatch pattern generation in this packet.

## Goal

Move low-to-medium risk reusable DXF importer helpers out of the 4.8k-line plugin file while keeping plugin ABI and importer behavior unchanged.

## Design

### 1. `dxf_metadata_writer`

Extract metadata writing helpers around entity/import provenance and small typed metadata writes.

Expected responsibilities:

- typed metadata writes
- origin metadata writes
- small DXF import statistic/meta helpers that do not depend on parser state

Dependencies allowed:

- `dxf_types.h`
- `dxf_color.h`
- CADGF C API headers already used by the importer

### 2. `dxf_style`

Extract DXF style parsing and application helpers.

Expected responsibilities:

- `parse_style_code(...)`
- `apply_line_style(...)`
- `resolve_insert_byblock_style(...)`

Dependencies allowed:

- `dxf_types.h`
- `dxf_color.h`
- `dxf_text_encoding.h`
- `dxf_metadata_writer.h`

Keep any purely local helper private inside `dxf_style.cpp`.

### 3. `dxf_text_handler`

Extract text-finalization helpers only.

Expected responsibilities:

- text alignment / text finalization logic
- text import stat updates tied directly to finalized text entities

Dependencies allowed:

- `dxf_types.h`

Keep parser state, table switching, and entity dispatch in `dxf_importer_plugin.cpp`.

### 4. CMake

Update `plugins/CMakeLists.txt` to add the new `.cpp` files to `cadgf_dxf_importer_plugin`.

Do not change target names, link settings, or include directories beyond what the new files require.

## Invariants

- `cadgf_plugin_get_api_v1()` stays in `dxf_importer_plugin.cpp`
- Plugin ABI stays unchanged
- DXF importer behavior must remain byte-for-byte compatible where tests already lock it down
- No parser state-machine extraction in this batch
- No committer extraction in this batch
- No blanket removal of `static`

## Dependency Rules

- New modules may depend on Batch 1 leaf modules
- `dxf_importer_plugin.cpp` may depend on the new mid-layer modules
- New mid-layer modules must not depend on parser or committer modules that do not exist yet
- Avoid introducing cross-cycles among the new modules

## Suggested Extraction Order

1. `dxf_metadata_writer`
2. `dxf_style`
3. `dxf_text_handler`

This keeps the first compile break surface small and avoids mixing parser extraction into the packet.

## Expected Files

- `plugins/dxf_importer_plugin.cpp`
- `plugins/dxf_metadata_writer.h`
- `plugins/dxf_metadata_writer.cpp`
- `plugins/dxf_style.h`
- `plugins/dxf_style.cpp`
- `plugins/dxf_text_handler.h`
- `plugins/dxf_text_handler.cpp`
- `plugins/CMakeLists.txt`

