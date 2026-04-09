import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelGlueFieldAppenders } from '../ui/property_panel_glue_field_appenders.js';

function createHarness(overrides = {}) {
  const fieldBatches = [];
  const patchCalls = [];
  const buildPatchCalls = [];
  const ensuredLayers = [];

  const appenders = createPropertyPanelGlueFieldAppenders({
    appendFieldDescriptors: (descriptors) => fieldBatches.push(descriptors),
    patchSelection: (patch, message) => patchCalls.push([patch, message]),
    buildPatch: (entity, key, value) => {
      buildPatchCalls.push([entity.id ?? null, key, value]);
      return { entityId: entity.id ?? null, key, value };
    },
    getLayer: () => null,
    ensureLayer: (layerId) => ensuredLayers.push(layerId),
    ...overrides,
  });

  return {
    appenders,
    fieldBatches,
    patchCalls,
    buildPatchCalls,
    ensuredLayers,
  };
}

test('createPropertyPanelGlueFieldAppenders threads common property field deps', () => {
  const primary = {
    id: 8,
    type: 'text',
    layerId: 2,
    color: '#778899',
    visible: true,
    lineType: 'BYLAYER',
    lineWeight: 0,
    lineTypeScale: 1,
  };
  const { appenders, fieldBatches, patchCalls, ensuredLayers } = createHarness();

  appenders.appendCommonPropertyFields(primary, '#112233', true);

  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.kind === 'toggle' ? descriptor.label : descriptor.config.name),
    ['layerId', 'color', 'Visible', 'lineType', 'lineWeight', 'lineTypeScale'],
  );

  fieldBatches[0][0].onChange('7');

  assert.deepEqual(ensuredLayers, [7]);
  assert.deepEqual(patchCalls, [
    [{ layerId: 7, colorSource: 'TRUECOLOR', colorAci: null }, 'Layer updated; imported color promoted to explicit'],
  ]);
});

test('createPropertyPanelGlueFieldAppenders threads source text field deps', () => {
  const primary = {
    id: 8,
    type: 'text',
    position: { x: 10, y: 20 },
    value: 'TEXT',
    height: 2.5,
    rotation: 0,
  };
  const { appenders, fieldBatches, patchCalls, buildPatchCalls } = createHarness();

  appenders.appendSourceTextFields(primary);

  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.config.name),
    ['value', 'position.x', 'position.y', 'height', 'rotation'],
  );

  fieldBatches[0][0].onChange('UPDATED');

  assert.deepEqual(buildPatchCalls, [[8, 'value', 'UPDATED']]);
  assert.deepEqual(patchCalls, [
    [{ entityId: 8, key: 'value', value: 'UPDATED' }, 'Text updated'],
  ]);
});

test('createPropertyPanelGlueFieldAppenders preserves insert proxy allowPositionEditing passthrough', () => {
  const primary = {
    id: 8,
    type: 'text',
    textKind: 'attdef',
    position: { x: 10, y: 20 },
    value: 'TEXT',
  };
  const { appenders, fieldBatches, patchCalls, buildPatchCalls } = createHarness();

  appenders.appendInsertProxyTextFields(primary, { allowPositionEditing: true });

  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.config.name),
    ['value', 'position.x', 'position.y'],
  );

  fieldBatches[0][1].onChange('42');

  assert.deepEqual(buildPatchCalls, [[8, 'position.x', '42']]);
  assert.deepEqual(patchCalls, [
    [{ entityId: 8, key: 'position.x', value: '42' }, 'Text position updated'],
  ]);
});

test('createPropertyPanelGlueFieldAppenders threads single entity field deps', () => {
  const primary = {
    id: 9,
    type: 'line',
    start: { x: 1, y: 2 },
    end: { x: 3, y: 4 },
  };
  const { appenders, fieldBatches, patchCalls, buildPatchCalls } = createHarness();

  appenders.appendSingleEntityFields(primary);

  assert.deepEqual(
    fieldBatches[0].map((descriptor) => descriptor.config.name),
    ['start.x', 'start.y', 'end.x', 'end.y'],
  );

  fieldBatches[0][3].onChange('7');

  assert.deepEqual(buildPatchCalls, [[9, 'end.y', '7']]);
  assert.deepEqual(patchCalls, [
    [{ entityId: 9, key: 'end.y', value: '7' }, 'Line end updated'],
  ]);
});
