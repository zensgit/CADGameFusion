## Build

From the worktree root:

```bash
cmake -S . -B build-codex
cmake --build build-codex --target cadgf_dxf_importer_plugin --parallel 8
```

If focused DXF targets are available, build them as well before running tests.

## Required Tests

Run the DXF/DWG suite subset:

```bash
cd build-codex
ctest --output-on-failure -R "dxf|dwg"
```

## Baseline Handling

This repository currently has known DXF baseline failures on `origin/main`. For this packet:

- report total pass/fail counts
- explicitly identify any failures reproduced on clean `origin/main`
- do not claim a regression unless the failure surface expands beyond the known baseline

## Acceptance Gate

- `cadgf_dxf_importer_plugin` builds
- runnable `dxf|dwg` subset stays no worse than clean `origin/main`
- no newly introduced compile failures
- `git diff --check` is clean

## Report Requirements

The verification report for this packet must include:

- exact build commands
- exact `ctest` command
- pass/fail totals
- list of any baseline failures confirmed on clean `origin/main`

