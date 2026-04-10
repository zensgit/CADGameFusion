import test from 'node:test';
import assert from 'node:assert/strict';

import { appendInsertProxyTextFields } from '../ui/property_panel_insert_proxy_field_appender.js';

test('appendInsertProxyTextFields preserves allowPositionEditing passthrough and update behavior', () => {
  const fieldBatches = [];
  const patchCalls = [];
  const buildPatchCalls = [];
  const primary = {
    id: 8,
    type: 'text',
    textKind: 'attdef',
    position: { x: 10, y: 20 },
    value: 'TEXT',
  };

  appendInsertProxyTextFields(
    (descriptors) => fieldBatches.push(descriptors),
    primary,
    { allowPositionEditing: true },
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
    ['value', 'position.x', 'position.y'],
  );

  fieldBatches[0][1].onChange('42');

  assert.deepEqual(buildPatchCalls, [[8, 'position.x', '42']]);
  assert.deepEqual(patchCalls, [
    [{ entityId: 8, key: 'position.x', value: '42' }, 'Text position updated'],
  ]);
});
