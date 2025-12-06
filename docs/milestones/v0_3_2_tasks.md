# v0.3.2 — Quick Health & Hook Adoption (Draft)

Theme: Make quick checks the default, strengthen pre‑push gating, and polish developer UX.

P0 — Adoption & Reliability
- [ ] Pre‑push hook: finalize template, document variations (strict/quick/offline)
- [ ] CI: mirror `quick_check.sh --strict` path in a dedicated job; surface summary
- [ ] Stabilize quick spec scene and keep goldens in sync

P1 — Developer Experience
- [ ] Make `make quick` the recommended local gate in README
- [ ] `tools/local_ci.sh`: improve summary JSON (counts, durations, strict flag)
- [ ] Add `tools/check_local_summary.sh` guidance to Troubleshooting

P2 — Ecosystem & Examples
- [ ] Add minimal C API example using quick subset data
- [ ] Unity adapter: smoke scene that exercises quick pipeline end‑to‑end
- [ ] Docs: “Quick vs Strict” decision table and offline mode examples

Exit Criteria
- Pre‑push hook installed by maintainers; green over 7 consecutive days
- Quick job visible in CI with trend snippet; no flakes over a week
- README and Docs updated; examples build and run in CI

