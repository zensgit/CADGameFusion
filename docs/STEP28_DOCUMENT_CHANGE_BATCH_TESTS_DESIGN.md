# Step 28: Document Change Batch Tests — Design

## Goals
- Verify DocumentChangeGuard/batching suppresses intermediate notifications.
- Ensure a single Reset event is emitted when a batch completes.

## Changes
1. **Core batch test** (`tests/core/test_document_change_batch.cpp`)
   - Asserts no events during a batch and exactly one Reset at completion.
   - Covers nested batching behavior.
2. **CTest registration** (`tests/core/CMakeLists.txt`)
   - Adds `core_tests_document_change_batch`.

## Rationale
Batching is relied on for project load and bulk edits. A focused test prevents
regressions in observer notification semantics.
