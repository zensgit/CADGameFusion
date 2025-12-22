# Step 23: Document Notify Guards Tests — Design

## Goals
- Verify no-op setters do not emit document change notifications.
- Ensure actual state changes still emit the expected events.

## Changes
1. **Core notification guard test** (`tests/core/test_document_notifications.cpp`)
   - Asserts no events on no-op setters for layers, entity metadata, and geometry.
   - Asserts correct events on real changes.
2. **CTest registration** (`tests/core/CMakeLists.txt`)
   - Adds `core_tests_document_notifications`.

## Rationale
Guard behavior is easy to regress; a focused core test makes the expected event
contract explicit and protects the new no-op checks.
