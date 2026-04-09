import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFullTextEditFieldDescriptors } from '../ui/property_panel_full_text_fields.js';

test('buildFullTextEditFieldDescriptors preserves text field labels and names', () => {
  const fields = buildFullTextEditFieldDescriptors(
    { type: 'text', value: 'TEXT', position: { x: 10, y: 20 }, height: 2.5, rotation: 0 },
    { patchSelection: () => {}, buildPatch: () => ({}) },
  );

  assert.deepEqual(
    fields.map((field) => [field.config.name, field.config.label]),
    [
      ['value', 'Text'],
      ['position.x', 'Position X'],
      ['position.y', 'Position Y'],
      ['height', 'Height'],
      ['rotation', 'Rotation (rad)'],
    ],
  );
});

test('buildFullTextEditFieldDescriptors preserves update messages', () => {
  const calls = [];
  const fields = buildFullTextEditFieldDescriptors(
    { id: 8, type: 'text', value: 'TEXT', position: { x: 10, y: 20 }, height: 2.5, rotation: 0 },
    {
      patchSelection: (patch, message) => calls.push([patch, message]),
      buildPatch: (entity, key, value) => ({ entityId: entity.id, key, value }),
    },
  );

  fields[0].onChange('UPDATED');
  fields[3].onChange('3.0');

  assert.deepEqual(calls, [
    [{ entityId: 8, key: 'value', value: 'UPDATED' }, 'Text updated'],
    [{ entityId: 8, key: 'height', value: '3.0' }, 'Text height updated'],
  ]);
});
