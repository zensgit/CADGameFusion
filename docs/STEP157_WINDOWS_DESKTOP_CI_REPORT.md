# STEP157 Windows Desktop CI Report

## Goal
Enable the Windows desktop build workflow and validate that it can package the VemCAD desktop app in CI.

## Findings
- Initial workflow run failed because `tools/web_viewer_desktop` was not tracked in git, so the checkout did not include the directory.
- Fix: add the desktop app sources (excluding `node_modules/` and `dist/`) to the repository.

## Changes
- Added tracked desktop app sources:
  - `tools/web_viewer_desktop/.gitignore`
  - `tools/web_viewer_desktop/README.md`
  - `tools/web_viewer_desktop/main.js`
  - `tools/web_viewer_desktop/preload.js`
  - `tools/web_viewer_desktop/package.json`
  - `tools/web_viewer_desktop/package-lock.json`
  - `tools/web_viewer_desktop/assets/icon.ico`
  - `tools/web_viewer_desktop/assets/icon.icns`

## PRs
- Windows workflow + docs merged: https://github.com/zensgit/CADGameFusion/pull/297
- Desktop sources merged: https://github.com/zensgit/CADGameFusion/pull/298

## Current CI Status
- Windows packaging workflow re-dispatched on branch `ci/web-viewer-desktop-windows`.
- Branch run URL: https://github.com/zensgit/CADGameFusion/actions/runs/21034505254 (completed successfully).
- Main run URL: https://github.com/zensgit/CADGameFusion/actions/runs/21035167043 (completed successfully).
- Artifacts downloaded to `/tmp/vemcad_windows_ci_21034505254` and `/tmp/vemcad_windows_ci_21035167043`.
