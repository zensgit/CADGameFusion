import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPropertyPanelActiveBranchInput,
  buildPropertyPanelActiveRenderCallbacksInput,
} from '../ui/property_panel_active_render_inputs.js';

test('buildPropertyPanelActiveRenderCallbacksInput preserves active render wiring fields', () => {
  const addReadonlyNote = () => {};
  const context = {
    addReadonlyNote,
    primary: { id: 1 },
    glueFacade: { kind: 'glue' },
    selectionInfoHelpers: { kind: 'selection' },
    branchContextHelper: { kind: 'branch' },
  };
  const renderState = {
    primaryLayer: { id: 9 },
    actionContext: { kind: 'action' },
    branchContext: { kind: 'branch-context' },
    displayedColor: '#112233',
    insertGroupSummary: { kind: 'insert' },
    promoteImportedColorSource: true,
    releasedInsertArchiveSelection: { kind: 'released' },
    sourceGroupSummary: { kind: 'source' },
  };

  assert.deepEqual(
    buildPropertyPanelActiveRenderCallbacksInput(context, renderState),
    {
      addReadonlyNote,
      primary: { id: 1 },
      primaryLayer: { id: 9 },
      actionContext: { kind: 'action' },
      branchContext: { kind: 'branch-context' },
      displayedColor: '#112233',
      insertGroupSummary: { kind: 'insert' },
      promoteImportedColorSource: true,
      releasedInsertArchiveSelection: { kind: 'released' },
      sourceGroupSummary: { kind: 'source' },
      glueFacade: { kind: 'glue' },
      selectionInfoHelpers: { kind: 'selection' },
      branchContextHelper: { kind: 'branch' },
    },
  );
});

test('buildPropertyPanelActiveBranchInput preserves branch render state fields', () => {
  const context = {
    entities: [{ id: 1 }, { id: 2 }],
  };
  const renderState = {
    readOnlyCount: 1,
    lockedCount: 2,
    releasedInsertArchive: { kind: 'archive' },
    notePlan: { kind: 'plan' },
  };

  assert.deepEqual(
    buildPropertyPanelActiveBranchInput(context, renderState),
    {
      entities: [{ id: 1 }, { id: 2 }],
      readOnlyCount: 1,
      lockedCount: 2,
      releasedInsertArchive: { kind: 'archive' },
      notePlan: { kind: 'plan' },
    },
  );
});
