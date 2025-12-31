# DXF Style Inheritance Reference Comparison

## Scope
- Compare BYBLOCK/BYLAYER style inheritance against LibreCAD, libdxfrw, and FreeCAD.
- Focus on line type, line weight, line type scale, color, and nested INSERT behavior.

## Reference Sources
- LibreCAD: `references/librecad/librecad/src/lib/engine/document/entities/rs_entity.cpp`
- LibreCAD: `references/librecad/librecad/src/lib/filters/rs_filterdxfrw.cpp`
- LibreCAD: `references/librecad/librecad/src/lib/engine/document/entities/rs_insert.cpp`
- libdxfrw: `references/libdxfrw/src/drw_entities.h`
- libdxfrw: `references/libdxfrw/src/drw_entities.cpp`
- FreeCAD: `references/freecad/src/Mod/Import/App/dxf/dxf.h`
- FreeCAD: `references/freecad/src/Mod/Import/App/dxf/dxf.cpp`

## Reference Observations
### LibreCAD
- DXF import sets the raw pen values (line type, color, width) without resolving BYBLOCK/BYLAYER.
  `references/librecad/librecad/src/lib/filters/rs_filterdxfrw.cpp:4558`.
- BYBLOCK resolution happens at render/update time. Nested blocks are handled by walking
  parent containers while the pen remains BYBLOCK for color, width, and line type.
  `references/librecad/librecad/src/lib/engine/document/entities/rs_entity.cpp:790`.
- INSERT update applies BYBLOCK by merging entity pen with the INSERT pen, then assigns to the
  cloned entity.
  `references/librecad/librecad/src/lib/engine/document/entities/rs_insert.cpp:41`.

### libdxfrw
- Entity defaults: lineType `BYLAYER`, color `BYLAYER`, line weight `BYLAYER`, line type scale `1.0`.
  `references/libdxfrw/src/drw_entities.h:140`.
- DXF parsing records raw line type / color / line weight / line type scale from the DXF codes.
  `references/libdxfrw/src/drw_entities.cpp:70`.

### FreeCAD
- Defaults to BYLAYER for color and line type, explicitly treating `"BYLAYER"` as by-layer
  rather than a real linetype.
  `references/freecad/src/Mod/Import/App/dxf/dxf.h:812`.
- Resolves BYLAYER attributes once the entity is fully parsed (layer name can appear after
  the BYLAYER attribute).
  `references/freecad/src/Mod/Import/App/dxf/dxf.h:827`.
- BYBLOCK resolution exists in code, but a TODO in `ObjectColor` shows BYBLOCK is not
  actually applied for color when importing.
  `references/freecad/src/Mod/Import/App/dxf/dxf.cpp:3184`.

## CADGameFusion Behavior
- DXF parsing recognizes BYBLOCK/BYLAYER for line type, line weight, and color.
  `plugins/dxf_importer_plugin.cpp:196`.
- Import-time resolution order is: explicit entity style -> BYBLOCK (INSERT style) -> layer style.
  `plugins/dxf_importer_plugin.cpp:273`.
- Nested INSERT BYBLOCK resolution merges the nested INSERT style with the parent INSERT style.
  `plugins/dxf_importer_plugin.cpp:1491`.
- DXF importer applies a default line type scale using header `$LTSCALE * $CELTSCALE`,
  falling back to `1.0` when header values are missing.
  `plugins/dxf_importer_plugin.cpp:291`.

## Differences and Gaps
1) Default line type scale
   - libdxfrw defaults line type scale to `1.0` (even if code 48 is absent).
   - CADGameFusion defaults to `$LTSCALE * $CELTSCALE` (fallback `1.0`), which bakes
     the header defaults into entity scale at import time.

2) Eager vs deferred resolution
   - LibreCAD resolves BYBLOCK/BYLAYER at render/update time so layer edits propagate.
   - CADGameFusion resolves on import and stores final styles, so later layer changes do not
     automatically update entities.

3) BYBLOCK support in FreeCAD
   - FreeCAD’s importer explicitly has a TODO for BYBLOCK color resolution and does not
     resolve it in the current importer flow.
   - CADGameFusion now resolves nested BYBLOCK, which is stronger behavior than FreeCAD’s
     importer but diverges from its current output.

4) ACI color 7 mapping
   - FreeCAD treats color index 7 as a neutral gray to adapt to background.
   - CADGameFusion maps ACI 7 to white (fixed).

## Recommendations
- Decide whether to persist LTSCALE/CELTSCALE separately (instead of baking them into
  entity scales) if future edits need to preserve the original header semantics.
- If layer edits should propagate post-import, store BYLAYER/BYBLOCK flags as metadata and
  resolve at render/export time instead of baking values at import.
- Decide whether ACI 7 should be configurable (white vs neutral gray) based on UI needs.
