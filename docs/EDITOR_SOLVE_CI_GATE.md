# Editor Solve CI gate

`.github/workflows/editor-solve-ci.yml` gates the editor native solve loop (run+show, the router
`POST /solve-cadgf` transport, geometry writeback, conflict-UX). Two jobs:

- **`solve unit tests (web_viewer, node)`** — `node --test tools/web_viewer/tests/solve_*.test.js`
  (run+show, transport, the writeback golden, conflict). Node-only, no build.
- **`/solve-cadgf smoke (real solve_from_project)`** — builds the Qt-free `solve_from_project`
  (`-DBUILD_EDITOR_QT=OFF`; Eigen only, `libdxfrw` skipped via the `if(EXISTS …)` guard) and drives the
  **real** `POST /solve-cadgf` through the router (`tools/plm_solve_cadgf_smoke.py`).

## Always-run by design

The workflow has **no top-level `paths:` filter**, so its jobs report a conclusion on *every* PR. This
is deliberate: a status check can only be made **required** if it always reports — a path-filtered
workflow never runs on non-matching PRs, so a required check from it would hang those PRs forever (the
"required check can never report" trap).

Path discrimination happens **inside** each job via `.github/scripts/detect_solve_changes.sh`:

- solve-loop change → run the real validation;
- otherwise → the job exits success trivially (the check still reports a **pass**);
- detection failure / non-PR event → default to running the real work (never wrongly skip).

Each job self-detects (no cross-job `needs`), so a job can't be skipped-and-never-report.

## Making it blocking

After the always-run gate has reported on **both** a solve-loop PR and a non-solve PR, the two checks
are safe to add to `main` branch protection's required status checks. The conservative option is to
require `solve unit tests (web_viewer, node)` first (deterministic) and add the smoke after a short
soak.
