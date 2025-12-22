# Step 24: PropertyPanel Disconnect Fix — Design

## Goals
- Remove wildcard disconnect calls that emit Qt warnings during tests.
- Rely on QObject lifetime cleanup to safely detach signal/slot connections.

## Changes
1. **PropertyPanel cleanup** (`editor/qt/src/panels/property_panel.cpp`)
   - Drop `disconnect()` before deleting the checkbox widget.

## Rationale
Qt automatically disconnects signals when a QObject is destroyed. The explicit
wildcard disconnect generates warnings in test output, so removing it keeps the
logs clean without changing behavior.
