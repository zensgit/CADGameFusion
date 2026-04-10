import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSingleEntityFields } from '../ui/property_panel_single_entity_field_appender.js';

test('appendSingleEntityFields preserves single-entity descriptor threading and update behavior', () => {
  const fieldBatches = [];
  const patchCalls = [];
  const buildPatchCalls = [];
  const primary = {
    id: 9,
    type: 'line',
    start: { x: 1, y: 2 },
    end: { x: 3, y: 4 },
  };

  appendSingleEntityFields(
    (descriptors) => fieldBatches.push(descriptors),
    primary,
    {
      patchSelection: (patch, message) => patchCalls.push([patch, message]),
      buildPatch: (entity, key, value) => {
        buildPatchCalls.push([entity.id ?? null, key, value]);
        return { entityId: entity.id ?? null, key, value };
      },
    },
  );

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
