import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelRenderCallbacks } from '../ui/property_panel_render_callbacks.js';

test('createPropertyPanelRenderCallbacks bridges branch-context and read-only field callbacks', () => {
  const calls = [];
  const primary = { id: 21 };
  const primaryLayer = { id: 5, name: 'ANNO' };
  const branchContext = { primary, primaryLayer, entityCount: 1 };
  const addReadonlyNote = () => calls.push(['readonly-note']);
  const callbacks = createPropertyPanelRenderCallbacks({
    addReadonlyNote,
    primary,
    primaryLayer,
    actionContext: { sourceGroup: { summary: { memberIds: [21] } } },
    branchContext,
    displayedColor: '#445566',
    insertGroupSummary: null,
    promoteImportedColorSource: true,
    releasedInsertArchiveSelection: null,
    sourceGroupSummary: { memberIds: [21] },
    glueFacade: {
      appendSourceTextFields: (entity) => calls.push(['source-text', entity.id]),
      appendInsertProxyTextFields: (entity, options) => calls.push(['insert-proxy-text', entity.id, options]),
      appendCommonSelectionActions: () => calls.push(['selection-actions']),
      appendCommonPropertyFields: () => calls.push(['property-fields']),
      appendStyleActions: () => calls.push(['style-actions']),
      appendSingleEntityFields: () => calls.push(['entity-fields']),
    },
    selectionInfoHelpers: {
      appendSingleSelectionInfo: () => calls.push(['single-info']),
      appendGroupedSelectionInfo: () => calls.push(['grouped-info']),
    },
    branchContextHelper: {
      appendBranchContext: (context, options) => calls.push(['branch-context', context, options]),
    },
  });

  callbacks.appendBranchContext({ showReleasedActions: true });
  callbacks.appendFullTextFields();
  callbacks.appendInsertProxyTextFields({ allowPositionEditing: true });
  callbacks.addReadonlyNote();

  assert.deepEqual(calls, [
    ['branch-context', branchContext, { showReleasedActions: true }],
    ['source-text', 21],
    ['insert-proxy-text', 21, { allowPositionEditing: true }],
    ['readonly-note'],
  ]);
});

test('createPropertyPanelRenderCallbacks preserves grouped selection wiring', () => {
  const calls = [];
  const primary = { id: 30 };
  const primaryLayer = { id: 7, name: 'TEXT' };
  const actionContext = {
    insertGroup: {
      peerSummary: {
        peerCount: 2,
      },
    },
  };
  const sourceGroupSummary = { memberIds: [30, 31] };
  const insertGroupSummary = { memberIds: [30, 31], editableIds: [30] };
  const releasedInsertArchiveSelection = { archive: { groupId: 900 } };
  const callbacks = createPropertyPanelRenderCallbacks({
    addReadonlyNote: () => calls.push(['readonly-note']),
    primary,
    primaryLayer,
    actionContext,
    branchContext: { primary, entityCount: 2 },
    displayedColor: '#abcdef',
    insertGroupSummary,
    promoteImportedColorSource: false,
    releasedInsertArchiveSelection,
    sourceGroupSummary,
    glueFacade: {
      appendSourceTextFields: () => calls.push(['source-text']),
      appendInsertProxyTextFields: () => calls.push(['insert-proxy-text']),
      appendCommonSelectionActions: (entity, context) => calls.push(['selection-actions', entity.id, context]),
      appendCommonPropertyFields: (entity, displayedColor, promoteImportedColorSource) => calls.push(['property-fields', entity.id, displayedColor, promoteImportedColorSource]),
      appendStyleActions: (entity, layer) => calls.push(['style-actions', entity.id, layer.id]),
      appendSingleEntityFields: (entity) => calls.push(['entity-fields', entity.id]),
    },
    selectionInfoHelpers: {
      appendSingleSelectionInfo: () => calls.push(['single-info']),
      appendGroupedSelectionInfo: (...args) => calls.push(['grouped-info', ...args]),
    },
    branchContextHelper: {
      appendBranchContext: () => calls.push(['branch-context']),
    },
  });

  callbacks.appendGroupedSelectionInfo();
  callbacks.appendCommonSelectionActions();
  callbacks.appendCommonPropertyFields();
  callbacks.appendStyleActions();
  callbacks.appendSingleEntityFields();
  callbacks.addReadonlyNote();

  assert.deepEqual(calls, [
    ['grouped-info', primary, sourceGroupSummary, insertGroupSummary, releasedInsertArchiveSelection, actionContext],
    ['selection-actions', 30, actionContext],
    ['property-fields', 30, '#abcdef', false],
    ['style-actions', 30, 7],
    ['entity-fields', 30],
    ['readonly-note'],
  ]);
});

test('createPropertyPanelRenderCallbacks preserves single-selection info wiring', () => {
  const calls = [];
  const primary = { id: 77 };
  const primaryLayer = { id: 12, name: 'DIM' };
  const callbacks = createPropertyPanelRenderCallbacks({
    addReadonlyNote: () => calls.push(['readonly-note']),
    primary,
    primaryLayer,
    actionContext: null,
    branchContext: { primary },
    displayedColor: '#ffffff',
    insertGroupSummary: null,
    promoteImportedColorSource: false,
    releasedInsertArchiveSelection: null,
    sourceGroupSummary: null,
    glueFacade: {
      appendSourceTextFields: () => {},
      appendInsertProxyTextFields: () => {},
      appendCommonSelectionActions: () => {},
      appendCommonPropertyFields: () => {},
      appendStyleActions: () => {},
      appendSingleEntityFields: () => {},
    },
    selectionInfoHelpers: {
      appendSingleSelectionInfo: (entity, layer) => calls.push([entity.id, layer.id]),
      appendGroupedSelectionInfo: () => {},
    },
    branchContextHelper: {
      appendBranchContext: () => {},
    },
  });

  callbacks.appendSingleSelectionInfo();
  callbacks.addReadonlyNote();

  assert.deepEqual(calls, [[77, 12], ['readonly-note']]);
});
