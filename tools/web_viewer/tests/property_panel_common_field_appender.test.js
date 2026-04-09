import test from 'node:test';
import assert from 'node:assert/strict';

import { appendCommonPropertyFields } from '../ui/property_panel_common_field_appender.js';

test('appendCommonPropertyFields preserves descriptor threading and imported-layer promotion behavior', () => {
  const fieldBatches = [];
  const patchCalls = [];
  const ensuredLayers = [];
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

  appendCommonPropertyFields(
    (descriptors) => fieldBatches.push(descriptors),
    primary,
    '#112233',
    true,
    {
      patchSelection: (patch, message) => patchCalls.push([patch, message]),
      buildPatch: (entity, key, value) => ({ entityId: entity.id ?? null, key, value }),
      getLayer: () => null,
      ensureLayer: (layerId) => ensuredLayers.push(layerId),
    },
  );

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
