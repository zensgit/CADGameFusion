Title: ci: remove legacy strict-exports workflow

Summary
- Remove deprecated `.github/workflows/strict-exports.yml` after observation window.
- Source of truth remains `.github/workflows/core-strict-exports-validation.yml`.

Rationale
- Avoid confusion and duplicated maintenance. Daily/Weekly and badges now point to the new workflow.

Plan
- Delete the legacy workflow.
- Verify badges & Daily CI artifact fallbacks remain valid.

Risks
- Low. We already show a deprecation notice and have shifted references.

