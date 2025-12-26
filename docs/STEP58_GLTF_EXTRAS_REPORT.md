# Step 58: glTF Extras Metadata - Report

## Goal
Expose CADGameFusion document metadata and layer state in glTF extras for downstream engines and PLM viewers.

## Changes
- `tools/convert_cli.cpp`: add `cadgf` extras payload (document metadata, unit scale, layer flags) and attach to mesh/node extras.

## Extras Layout
```json
{
  "cadgf": {
    "document": {
      "label": "",
      "author": "",
      "company": "",
      "comment": "",
      "created_at": "",
      "modified_at": "",
      "unit_name": "",
      "unit_scale": 1.0,
      "meta": null
    },
    "layers": [
      {
        "id": 0,
        "name": "0",
        "color": 16777215,
        "visible": true,
        "locked": false,
        "printable": true,
        "frozen": false,
        "construction": false
      }
    ]
  }
}
```

## Notes
- Empty meta maps serialize as `null` in glTF extras (tinygltf encodes empty objects as null).
