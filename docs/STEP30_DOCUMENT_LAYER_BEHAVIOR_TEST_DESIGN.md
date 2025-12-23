# Step 30: Document Layer Behavior Test — Design

## Goal
Validate core::Document layer invariants:
- Default layer is always present after construction/clear.
- Invalid layer id setters return false and do not mutate default layer.
- Layer id counter resets after clear.

## Coverage
1. **Default layer invariants**
   - layer id = 0, name = "0", color = 0xFFFFFF, visible = true, locked = false.
2. **Invalid id setters**
   - set_layer_visible/locked/color return false for negative and large ids.
3. **Clear reset**
   - clear() restores default layer and next added layer id starts at 1.

## Test Target
- `core_tests_document_layers` (`tests/core/test_document_layers.cpp`)
