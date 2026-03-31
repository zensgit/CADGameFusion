import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPropertyPanelActiveSelection } from '../ui/property_panel_active_render.js';

test('renderPropertyPanelActiveSelection wires render state, callbacks, and branch composer in order', () => {
  const calls = [];
  const result = renderPropertyPanelActiveSelection(
    {
      entities: [{ id: 1 }, { id: 2 }],
      primary: { id: 1 },
      documentState: { kind: 'doc' },
      controller: { kind: 'controller' },
      glueFacade: { kind: 'glue' },
      selectionInfoHelpers: { kind: 'selection-info' },
      branchContextHelper: { kind: 'branch-context' },
      addReadonlyNote: () => {},
    },
    {
      assemblePropertyPanelRenderState: (entities, primary, deps) => {
        calls.push(['assemble', entities, primary, deps]);
        return {
          primaryLayer: { id: 9 },
          actionContext: { kind: 'action' },
          branchContext: { kind: 'branch' },
          displayedColor: '#112233',
          insertGroupSummary: { kind: 'insert' },
          promoteImportedColorSource: true,
          releasedInsertArchiveSelection: { kind: 'released-selection' },
          sourceGroupSummary: { kind: 'source' },
          readOnlyCount: 1,
          lockedCount: 2,
          releasedInsertArchive: { kind: 'archive' },
          notePlan: { kind: 'note-plan' },
        };
      },
      createPropertyPanelRenderCallbacks: (input) => {
        calls.push(['callbacks', input]);
        return {
          addReadonlyNote: input.addReadonlyNote,
          appendBranchContext: () => {},
        };
      },
      renderPropertyPanelSelectionBranches: (context, handlers) => {
        calls.push(['branches', context, handlers]);
        return { blockedAt: null };
      },
    },
  );

  assert.equal(result.rendered, true);
  assert.equal(result.blockedAt, null);
  assert.deepEqual(
    calls.map((entry) => entry[0]),
    ['assemble', 'callbacks', 'branches'],
  );
  assert.deepEqual(calls[0][3], {
    documentState: { kind: 'doc' },
    controller: { kind: 'controller' },
  });
  assert.equal(calls[1][1].glueFacade.kind, 'glue');
  assert.equal(calls[1][1].selectionInfoHelpers.kind, 'selection-info');
  assert.equal(calls[1][1].branchContextHelper.kind, 'branch-context');
  assert.equal(typeof calls[1][1].addReadonlyNote, 'function');
  assert.deepEqual(calls[2][1], {
    entities: [{ id: 1 }, { id: 2 }],
    readOnlyCount: 1,
    lockedCount: 2,
    releasedInsertArchive: { kind: 'archive' },
    notePlan: { kind: 'note-plan' },
  });
  assert.equal(typeof calls[2][2].addReadonlyNote, 'function');
});

test('renderPropertyPanelActiveSelection returns missing-state when render state assembly returns null', () => {
  const result = renderPropertyPanelActiveSelection(
    {
      entities: [{ id: 1 }],
      primary: { id: 1 },
      documentState: { kind: 'doc' },
      controller: { kind: 'controller' },
      glueFacade: {},
      selectionInfoHelpers: {},
      branchContextHelper: {},
      addReadonlyNote: () => {},
    },
    {
      assemblePropertyPanelRenderState: () => null,
      createPropertyPanelRenderCallbacks: () => {
        throw new Error('should not reach callbacks');
      },
      renderPropertyPanelSelectionBranches: () => {
        throw new Error('should not reach branches');
      },
    },
  );

  assert.deepEqual(result, {
    rendered: false,
    blockedAt: 'missing-state',
  });
});
