import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelSelectionPresentation } from '../ui/property_panel_selection_presentation.js';

function createResolution({ entities = [], layers = [] } = {}) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return {
    getLayer: (id) => layerMap.get(id) || null,
    listEntities: () => entities,
  };
}

test('passes presentationEntities through to buildSelectionPresentation', () => {
  const entity = {
    id: 1, type: 'line', layerId: 1, visible: true, color: '#fff',
    colorSource: 'BYLAYER', lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1,
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, space: 0, layout: 'Model',
  };
  const layer = {
    id: 1, name: 'L1', color: '#fff', visible: true, locked: false,
    frozen: false, printable: true, construction: false,
  };
  const resolution = createResolution({ entities: [entity], layers: [layer] });
  const contextState = {
    presentationEntities: [entity],
    presentationPrimaryId: 1,
  };

  const result = buildPropertyPanelSelectionPresentation(resolution, contextState);

  assert.equal(result.mode, 'single');
  assert.equal(result.summaryText, '1 selected (line)');
});

test('passes presentationPrimaryId through to buildSelectionPresentation', () => {
  const entity1 = {
    id: 1, type: 'line', layerId: 1, visible: true, color: '#fff',
    colorSource: 'BYLAYER', lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1,
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, space: 0, layout: 'Model',
  };
  const entity2 = {
    id: 2, type: 'circle', layerId: 1, visible: true, color: '#fff',
    colorSource: 'BYLAYER', lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1,
    center: { x: 5, y: 5 }, radius: 3, space: 0, layout: 'Model',
  };
  const layer = {
    id: 1, name: 'L1', color: '#fff', visible: true, locked: false,
    frozen: false, printable: true, construction: false,
  };
  const resolution = createResolution({ entities: [entity1, entity2], layers: [layer] });
  const contextState = {
    presentationEntities: [entity1, entity2],
    presentationPrimaryId: 2,
  };

  const result = buildPropertyPanelSelectionPresentation(resolution, contextState);

  assert.equal(result.mode, 'multiple');
  assert.ok(result.primary);
  assert.equal(result.primary.id, 2);
});

test('passes getLayer and listEntities from resolution', () => {
  const resolution = createResolution();
  const contextState = {
    presentationEntities: [],
    presentationPrimaryId: null,
  };

  const result = buildPropertyPanelSelectionPresentation(resolution, contextState);

  assert.equal(result.mode, 'empty');
  assert.equal(result.summaryText, 'No selection');
});

test('returns buildSelectionPresentation result unchanged', () => {
  const entity = {
    id: 1, type: 'line', layerId: 1, visible: true, color: '#fff',
    colorSource: 'BYLAYER', lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1,
    start: { x: 0, y: 0 }, end: { x: 10, y: 0 }, space: 0, layout: 'Model',
  };
  const layer = {
    id: 1, name: 'L1', color: '#fff', visible: true, locked: false,
    frozen: false, printable: true, construction: false,
  };
  const resolution = createResolution({ entities: [entity], layers: [layer] });
  const contextState = {
    presentationEntities: [entity],
    presentationPrimaryId: 1,
  };

  const result = buildPropertyPanelSelectionPresentation(resolution, contextState);

  assert.equal(typeof result.mode, 'string');
  assert.equal(typeof result.summaryText, 'string');
  assert.ok(result.primary);
  assert.ok(Array.isArray(result.badges));
  assert.ok(Array.isArray(result.detailFacts));
});
