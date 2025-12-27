# Tools Reference

This page summarizes CLI helpers for the PLM conversion pipeline.

## plm_router_service.py
Runs the HTTP router for uploads, history, and annotations.

```bash
python3 tools/plm_router_service.py --port 9000
```

## plm_convert.py
Runs the conversion pipeline (plugin import → artifacts).

```bash
python3 tools/plm_convert.py \
  --plugin build_vcpkg/plugins/libcadgf_dxf_importer_plugin.dylib \
  --input samples/example.dxf \
  --out /tmp/plm_run \
  --emit json,gltf,meta
```

## plm_annotate.py
Posts annotations to the router without re-uploading.

```bash
python3 tools/plm_annotate.py \
  --router http://localhost:9000 \
  --project-id demo \
  --document-label sample \
  --text "Reviewed" \
  --author sam
```

## Notes
- Use `--token` with router/annotate if auth is enabled.
