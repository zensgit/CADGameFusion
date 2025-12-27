# Step 75: Web Demo Pipeline Toggles - Verification

## Checks
```bash
# UI-only change; no CLI compilation required.
```

## Manual smoke
```text
1. Start the router service with a default plugin/convert_cli.
2. Open http://localhost:9000/tools/plm_web_demo/.
3. Toggle “Migrate document.json” and “Validate document.json”.
4. Submit a small test file and confirm the request carries:
   - migrate_document=true
   - document_target=<value>
   - validate_document=true
   - document_schema (if provided)
```

## Results
- Manual smoke: NOT RUN
