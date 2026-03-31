import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCurrentLayerDefaultContent,
  buildCurrentLayerFieldDescriptors,
} from '../ui/property_panel_current_layer_defaults.js';

test('buildCurrentLayerDefaultContent preserves no-selection note and info rows', () => {
  const content = buildCurrentLayerDefaultContent(
    {
      id: 2,
      name: 'REDLINE',
      color: '#00AAFF',
      locked: false,
      visible: true,
      frozen: false,
      printable: true,
      construction: false,
    },
    { space: 0, layout: 'Model' },
  );

  assert.equal(
    content.note?.text,
    'No selection. Current layer and current space/layout apply to newly created Line/Polyline/Circle/Arc/Text entities.',
  );
  assert.deepEqual(
    content.infos.map((info) => [info.key, info.value]),
    [
      ['current-space', 'Model'],
      ['current-layout', 'Model'],
      ['current-layer', '2:REDLINE'],
      ['current-layer-color', '#00AAFF'],
      ['current-layer-state', 'Shown / Open / Live / Print / Normal'],
    ],
  );
});

test('buildCurrentLayerFieldDescriptors preserves field labels and defaults', () => {
  const fields = buildCurrentLayerFieldDescriptors(
    { id: 2, name: 'REDLINE', color: '#00AAFF', lineType: 'CENTER', lineWeight: 0.35 },
    { updateCurrentLayer: () => true },
  );

  assert.deepEqual(
    fields.map((field) => [field.config.name, field.config.label, field.config.value]),
    [
      ['currentLayerColor', 'Current Layer Color (#RRGGBB)', '#00AAFF'],
      ['currentLayerLineType', 'Current Layer Line Type', 'CENTER'],
      ['currentLayerLineWeight', 'Current Layer Line Weight', '0.35'],
    ],
  );
});

test('buildCurrentLayerFieldDescriptors forwards updates and status text', () => {
  const calls = [];
  const statuses = [];
  const [colorField, lineTypeField, lineWeightField] = buildCurrentLayerFieldDescriptors(
    { id: 2, name: 'REDLINE', color: '#808080', lineType: 'CONTINUOUS', lineWeight: 0 },
    {
      updateCurrentLayer: (id, patch) => {
        calls.push([id, patch]);
        return patch.lineType !== 'FAIL';
      },
      setStatus: (status) => statuses.push(status),
    },
  );

  colorField.onChange('#00AAFF');
  lineTypeField.onChange('FAIL');
  lineWeightField.onChange('0.35');

  assert.deepEqual(calls, [
    [2, { color: '#00AAFF' }],
    [2, { lineType: 'FAIL' }],
    [2, { lineWeight: 0.35 }],
  ]);
  assert.deepEqual(statuses, [
    'Current layer color: REDLINE',
    'Current layer line type unchanged: REDLINE',
    'Current layer line weight: REDLINE',
  ]);
});
