import test from 'node:test';
import assert from 'node:assert/strict';

import { assemblePropertyPanelRenderState } from '../ui/property_panel_render_state.js';

function createDocumentState({ layers = [], entities = [] } = {}) {
  const layerMap = new Map(layers.map((layer) => [layer.id, layer]));
  return {
    getLayer(layerId) {
      return layerMap.get(layerId) || null;
    },
    listEntities() {
      return entities;
    },
  };
}

test('assemblePropertyPanelRenderState preserves single-selection derived state and note plan', () => {
  const entities = [{
    id: 9,
    type: 'text',
    layerId: 4,
    visible: true,
    color: '#99aabb',
    colorSource: 'BYBLOCK',
    lineType: 'CENTER',
    lineWeight: 0.4,
    lineTypeScale: 1.5,
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'dimension',
    space: 1,
    layout: 'Layout-A',
    position: { x: 10, y: 20 },
    sourceTextPos: { x: 10, y: 20 },
    sourceTextRotation: 0,
    sourceAnchor: { x: 0, y: 0 },
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'midpoint',
    dimTextPos: { x: 10, y: 20 },
    dimTextRotation: 0,
  }];
  const documentState = createDocumentState({
    layers: [{
      id: 4,
      name: 'DIM',
      color: '#445566',
      visible: true,
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
    }],
    entities,
  });
  const controller = {
    resolveSelectionActionContext(entity, selectionIds) {
      return {
        selectionIds,
        sourceGroup: {
          summary: { memberIds: [9], editableIds: [], readOnlyIds: [9] },
          selectionMatchesGroup: true,
          selectionMatchesText: true,
          textIds: [9],
          textMemberCount: 1,
          resettableTextIds: [9],
          resettableTextMemberCount: 1,
          sourceTextGuide: { sourceType: entity.sourceType },
        },
        insertGroup: null,
        releasedInsert: null,
      };
    },
  };

  const renderState = assemblePropertyPanelRenderState(entities, entities[0], {
    documentState,
    controller,
  });

  assert.equal(renderState.promoteImportedColorSource, true);
  assert.equal(renderState.readOnlyCount, 1);
  assert.equal(renderState.lockedCount, 0);
  assert.equal(renderState.primaryLayer.id, 4);
  assert.equal(renderState.displayedColor, '#99aabb');
  assert.deepEqual(renderState.selectionIds, [9]);
  assert.equal(renderState.actionContext.sourceGroup.selectionMatchesText, true);
  assert.equal(renderState.notePlan.readOnly.blocksFurtherEditing, true);
  assert.equal(renderState.notePlan.readOnly.allowDirectSourceTextEditing, true);
  assert.equal(renderState.branchContext.primary.id, 9);
  assert.equal(renderState.branchContext.entityCount, 1);
});

test('assemblePropertyPanelRenderState preserves grouped released-insert selection summary', () => {
  const entities = [{
    id: 21,
    type: 'text',
    layerId: 1,
    visible: true,
    color: '#9ca3af',
    colorSource: 'BYLAYER',
    sourceType: 'INSERT',
    proxyKind: 'text',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
    position: { x: 0, y: 20 },
    releasedInsertArchive: {
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      groupId: 700,
      blockName: 'DoorTag',
      textKind: 'attdef',
      attributeTag: 'TAG',
      attributeDefault: 'DEFAULT',
      attributePrompt: 'PROMPT',
      attributeFlags: 4,
      attributeVerify: true,
    },
  }, {
    id: 22,
    type: 'line',
    layerId: 1,
    visible: true,
    color: '#9ca3af',
    colorSource: 'BYLAYER',
    sourceType: 'INSERT',
    groupId: 500,
    blockName: 'DoorTag',
    space: 1,
    layout: 'Layout-B',
    start: { x: -18, y: 20 },
    end: { x: 18, y: 34 },
    releasedInsertArchive: {
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      groupId: 700,
      blockName: 'DoorTag',
      textKind: 'attdef',
      attributeTag: 'TAG',
      attributeDefault: 'DEFAULT',
      attributePrompt: 'PROMPT',
      attributeFlags: 4,
      attributeVerify: true,
    },
  }];
  const documentState = createDocumentState({
    layers: [{
      id: 1,
      name: 'L1',
      color: '#9ca3af',
      visible: true,
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
    }],
    entities,
  });
  const controller = {
    resolveSelectionActionContext(_entity, selectionIds) {
      return {
        selectionIds,
        sourceGroup: null,
        insertGroup: {
          summary: { memberIds: [21, 22], editableIds: [21], readOnlyIds: [22] },
          peerSummary: {
            peerCount: 2,
            currentIndex: 0,
            peers: [
              { space: 1, layout: 'Layout-A' },
              { space: 1, layout: 'Layout-B' },
            ],
          },
        },
        releasedInsert: null,
      };
    },
  };

  const renderState = assemblePropertyPanelRenderState(entities, entities[0], {
    documentState,
    controller,
  });

  assert.equal(renderState.releasedInsertArchive, null);
  assert.equal(renderState.insertGroupSummary.memberIds.length, 2);
  assert.equal(renderState.releasedInsertArchiveSelection.archive.groupId, 700);
  assert.equal(renderState.releasedInsertArchiveSelection.entityCount, 2);
  assert.equal(renderState.branchContext.releasedInsertArchiveSelection.archive.blockName, 'DoorTag');
  assert.equal(renderState.branchContext.actionContext.insertGroup.peerSummary.peerCount, 2);
});
