# Local CI Gate vcpkg Retry Report (2025-12-23)

## Summary
- Added retry/backoff for vcpkg clone/fetch in Local CI Gate.
- Use partial clone to reduce network transfer size.
- Pinned commit remains unchanged.

## Files Updated
- `.github/workflows/local-ci-gate.yml`

## Testing
- Not run locally (CI workflow change only).
