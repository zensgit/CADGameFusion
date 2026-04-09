import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCommonPropertyFieldDescriptors } from '../ui/property_panel_common_property_fields.js';

test('buildCommonPropertyFieldDescriptors preserves common field labels and names', () => {
  const fields = buildCommonPropertyFieldDescriptors(
    { layerId: 2, color: '#00AAFF', visible: true, lineType: 'BYLAYER', lineWeight: 0, lineTypeScale: 1 },
    { displayedColor: '#00AAFF', promoteImportedColorSource: false },
    { patchSelection: () => {}, buildPatch: () => ({}), getLayer: () => null, ensureLayer: () => {} },
  );

  assert.deepEqual(
    fields.map((field) => field.kind === 'toggle' ? [field.label, field.checked] : [field.config.name, field.config.label]),
    [
      ['layerId', 'Layer ID'],
      ['color', 'Color Override (#RRGGBB)'],
      ['Visible', true],
      ['lineType', 'Line Type Override'],
      ['lineWeight', 'Line Weight Override'],
      ['lineTypeScale', 'Line Type Scale Override'],
    ],
  );
});

test('buildCommonPropertyFieldDescriptors preserves imported layer promotion behavior', () => {
  const calls = [];
  const ensured = [];
  const fields = buildCommonPropertyFieldDescriptors(
    { layerId: 1, color: '#808080', visible: true, lineType: 'CONTINUOUS', lineWeight: 0, lineTypeScale: 1 },
    { displayedColor: '#808080', promoteImportedColorSource: true },
    {
      patchSelection: (patch, message) => calls.push([patch, message]),
      buildPatch: (entity, key, value) => ({ key, value }),
      getLayer: () => null,
      ensureLayer: (layerId) => ensured.push(layerId),
    },
  );

  fields[0].onChange('7');
  fields[2].onChange(false);
  fields[5].onChange('2.5');

  assert.deepEqual(ensured, [7]);
  assert.deepEqual(calls, [
    [{ layerId: 7, colorSource: 'TRUECOLOR', colorAci: null }, 'Layer updated; imported color promoted to explicit'],
    [{ visible: false }, 'Visibility updated'],
    [{ key: 'lineTypeScale', value: '2.5' }, 'Line type scale updated'],
  ]);
});
