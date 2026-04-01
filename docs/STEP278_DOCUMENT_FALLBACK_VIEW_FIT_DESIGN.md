# Step278: Document Fallback View Fit Design

## Goal

Improve the first impression of packaged DWG fallback preview after the file successfully opens.

Step276 solved the "blank viewport" failure by rendering `document.json` as fallback linework.
Step278 improves the next problem: the fallback preview opened, but the initial view still looked poor because the viewport framed layout/paper-space extents instead of the actual drawing content.

## Problem

After Step276, the packaged app could render visible fallback geometry, but the first view still had three usability issues:

- the viewport background stayed tuned for a light marketing-style page, not a CAD preview;
- the default interaction still behaved like a 3D orbit viewer even for 2D fallback drawings;
- the initial framing often included paper-space border noise or distant layout content, so the actual part preview appeared too small or too low in the viewport.

This produced a technically successful open with a visually weak result.

## Contract

### 1. Fallback preview should present as CAD, not as generic page art

When the active preview mode is `document-fallback`, the right-side viewport should switch to a CAD-oriented presentation:

- dark high-contrast background;
- subtle engineering-grid treatment;
- lighter text overlay colors for dimension readability;
- pan-first interaction instead of rotate-first interaction.

The left-side application panel remains unchanged.

### 2. Fallback framing should prioritize useful drawing content

The initial fit should no longer blindly use the broadest extents from all fallback entities.

Instead, the framing logic should:

- prefer model-space geometry when fallback content was derived from paper-space viewport transforms;
- bias toward the densest cluster of rendered line slices rather than sparse outlier frame geometry;
- include nearby dimension/text labels so the view does not crop measurement context.

### 3. 2D fallback should open in a plan-view interaction model

For `document-fallback`:

- rotation should be disabled;
- left drag should pan;
- zoom should stay available.

This aligns the fallback interaction model more closely with a 2D CAD preview expectation.

### 4. Verification must stay on the real packaged lane

This step is only complete if the real packaged app still opens the sample DWG and the smoke can prove:

- preview mode is still `document-fallback`;
- viewport presentation switches to the fallback CAD mode;
- rotate is disabled in that mode;
- the packaged screenshot shows the actual drawing larger and more legible than the earlier "tiny sheet" framing.

## Scope

- `tools/web_viewer/preview_app.js`
- `tools/web_viewer/style.css`
- `tools/web_viewer/scripts/desktop_packaged_document_fallback_smoke.js`
- `docs/STEP278_DOCUMENT_FALLBACK_VIEW_FIT_DESIGN.md`
- `docs/STEP278_DOCUMENT_FALLBACK_VIEW_FIT_VERIFICATION.md`
- `docs/VEMCAD_DESKTOP_GUIDE.md`

## Acceptance

Step278 is complete when:

- fallback preview still opens successfully from the packaged app;
- the viewport switches into a CAD-oriented fallback presentation;
- the first view favors the actual model content over paper/layout noise;
- packaged smoke and screenshot evidence confirm the improved framing and interaction mode.
