# ADR-0001: Geometry Kernel Strategy

## Context
Robust CAD requires a strong kernel (BRep/booleans/offsets). OpenCascade is feature-rich but heavy. We need velocity now and a path to industrial strength.

## Decision
- Adopt Mesh-first prototype for MVP: fast iteration, simpler deps, aligns with current exporter.
- Define kernel abstraction boundaries to allow migration to OpenCascade later.

## Consequences
- Faster MVP delivery; certain edge cases deferred until OCC integration.
- Maintain adapters and stable interfaces to reduce migration cost.

