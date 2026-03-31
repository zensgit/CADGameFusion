# Step313 Editor Insert Attribute Fixture Ready Smoke Design

## Goal

Stabilize `editor_insert_attribute_smoke.js` after Step312 by waiting for the generated CADGF fixture to finish importing before asserting proxy-specific selection and property state.

## Problem

`editor_insert_attribute_smoke.js` only waited for `window.__cadDebug` to exist and for `getEntity(1)` to return something. That was too weak:

- the editor bootstrap can briefly expose the default starter document
- entity `1` already exists in that starter document
- the smoke could select entity `1` before the generated insert-attribute fixture replaced the document

That race was latent, but Step312 changed orchestration timing enough to expose it consistently.

## Design

Add:

- `waitForAugmentedInsertAttributeFixture(page, { hiddenEditableIds, mixedInsertAttributeIds })`

The helper waits for the generated fixture’s characteristic entities and metadata to appear together:

- ATTRIB proxy `id=1` with value `ATTRIB_INSERT_OVERRIDE`
- ATTDEF proxy `id=3` with value `ATTDEF_INSERT_DEFAULT`
- generated hidden editable ATTRIB tag
- generated mixed editable ATTRIB tag
- generated mixed constant ATTDEF tag

Only after that readiness gate passes does the smoke call `captureProxyState(...)`.

## Boundaries

The change is intentionally narrow:

- no runtime/editor behavior changes
- no fixture content changes
- no property panel/controller logic changes
- only smoke readiness logic changes

## Expected Outcome

`editor_insert_attribute_smoke.js` becomes deterministic again and no longer mistakes the temporary starter document for the imported insert-attribute fixture.
