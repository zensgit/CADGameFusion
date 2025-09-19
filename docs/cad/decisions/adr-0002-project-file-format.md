# ADR-0002: Project File Format v1

## Context
We need a human-readable, testable project format with deterministic diffs and upgrade path.

## Decision
- Use JSON v1 with explicit header { format, version }.
- Enforce deterministic ordering and stable IDs.
- Provide migration hooks for v2+ (binary/compact) later.

## Consequences
- Easy debugging and CI validation now; future binary can be added without breaking readers.

