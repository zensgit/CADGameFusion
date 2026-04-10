import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSourceTextFields } from '../ui/property_panel_source_text_field_appender.js';

test('appendSourceTextFields preserves descriptor threading and text update behavior', () => {
  const fieldBatches = [];
  const patchCalls = [];
  const buildPatchCalls = [];
  const primary = {
    id: 8,
    type: 'text',
    position: { x: 10, y: 20 },
    value: 'TEXT',
    height: 2.5,
    rotation: 0,
  };

  appendSourceTextFields(
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
    ['value', 'position.x', 'position.y', 'height', 'rotation'],
  );

  fieldBatches[0][0].onChange('UPDATED');

  assert.deepEqual(buildPatchCalls, [[8, 'value', 'UPDATED']]);
  assert.deepEqual(patchCalls, [
    [{ entityId: 8, key: 'value', value: 'UPDATED' }, 'Text updated'],
  ]);
});
