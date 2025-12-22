# Step 27: C API Metadata Setters Coverage — Design

## Goals
- Extend C API tests to cover layer and entity metadata setters.
- Ensure visibility/locked/color/group updates persist through C API queries.

## Changes
1. **C API query test expansion** (`tests/core/test_c_api_document_query.cpp`)
   - Exercise `cadgf_document_set_layer_visible/locked/color` and verify via `cadgf_document_get_layer_info`.
   - Exercise `cadgf_document_set_entity_visible/color/group_id` and verify via `cadgf_document_get_entity_info_v2`.

## Rationale
C API is the stability boundary. These setters are part of that contract, so we
should keep explicit coverage in the core C API test.
