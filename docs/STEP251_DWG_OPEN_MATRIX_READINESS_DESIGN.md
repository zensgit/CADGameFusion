# Step251: DWG Open Matrix Readiness Design

## Goal

Promote DWG open readiness from a single-sample smoke claim to a multi-sample engineering baseline.

Step250 proved the preferred desktop path could open one real `.dwg` through `direct-plugin`.
Step251 makes the next product statement possible:

- not only "the path exists"
- but "the current DWG-open business path is stable across a real corpus"

## Problem

Before this step, DWG readiness evidence was still too narrow in two ways.

### 1. Single-sample proof is not enough

Desktop smoke could prove:

- the Electron main-process path works
- the preferred route is `direct-plugin`
- the viewer and manifest validators pass

But that still leaves the practical question unanswered:

- does the current pipeline hold across the actual training/business DWG set?

### 2. Existing docs were behind the real corpus

Older Step187 readiness notes still described a smaller promoted matrix and older scope.

That creates a product/documentation mismatch:

- the repo already has a real matrix runner
- downstream CI/reporting already knows how to consume it
- but the readiness story a human sees is still stale

## Contract

### 1. Matrix smoke is the DWG-open readiness baseline

`tools/plm_dwg_open_matrix_smoke.py` is now treated as the authoritative batch proof for business-path DWG open.

For each case it verifies:

- DWG conversion stage
- router `/convert`
- viewer load
- manifest/document validators

### 2. Readiness is corpus-based, not anecdotal

The promoted baseline is the current 44-case real-DWG corpus from:

- `tools/plm_dwg_open_matrix_cases.json`

Step251 readiness means:

- `case_count = 44`
- `fail_count = 0`
- every case also passes router/convert/viewer/validator checks

### 3. Desktop proof and matrix proof serve different purposes

Step250 and Step251 are complementary, not duplicates:

- Step250: the real desktop product path prefers and verifies `direct-plugin`
- Step251: the broader DWG business path is stable across the real matrix

Together they justify saying the repo can already open DWG normally on a configured development machine.

### 4. Reporting surfaces should point to the current matrix baseline

Step251 does not invent a new pipeline.
It formalizes the matrix lane that already exists and is already consumed by:

- `tools/local_ci.sh`
- `tools/editor_gate.sh`
- `tools/editor_weekly_validation.sh`
- weekly/CI artifact summary writers

## Key Files

- `tools/plm_dwg_open_matrix_smoke.py`
  - batch runner and summary schema
- `tools/plm_dwg_open_matrix_cases.json`
  - promoted real-DWG corpus
- `tools/plm_dwg_open_smoke.py`
  - per-case business-path execution
- `docs/Tools.md`
  - operator-facing tool reference
- `docs/VEMCAD_QA_CHECKLIST.md`
  - QA-facing release checklist

## Non-Goals

Step251 does not:

- add new DWG geometry capability
- change router/importer behavior
- replace the desktop smoke
- guarantee out-of-box consumer packaging readiness

## Acceptance

Step251 is complete when:

- the 44-case real DWG matrix passes with `fail_count = 0`
- the results are written as a formal readiness note
- tooling/docs point to the current matrix lane instead of stale smaller-scope evidence
