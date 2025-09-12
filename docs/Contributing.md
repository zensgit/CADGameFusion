# Contributing

Thanks for your interest in contributing! This document outlines basic conventions for this repo.

## Code style
- C++: follow project defaults (C++17). Prefer descriptive names, avoid one-letter vars except trivial loops.
- Headers under `core/include/...` are public; avoid leaking internal dependencies there.
- Prefer small, testable functions; keep algorithms pure where possible.

## Commits & PRs
- Keep patches focused; describe the problem and the solution clearly.
- Link related issues when available.
- Avoid mixing formatting changes with functional changes.

## Build
- Use scripts in `scripts/` for local builds.
- For deps, prefer vcpkg manifest mode; avoid committing vendored third-party code unless necessary.
- CI (GitHub Actions) must pass on PRs (core required; qt where applicable).

## Testing
- Add unit tests for core algorithms when adding features (golden cases + edge cases).
- For geometric ops, add fuzzy/regression cases where possible.

## Docs
- Update `docs/` when adding new features or changing behavior.
- Keep `API.md` in sync with C API additions.

## Issue templates (suggested)
- Bug report: repro steps, expected vs actual, logs, env.
- Feature request: problem, proposal, alternatives, impact.

## Contact
- Maintainers: TBD

