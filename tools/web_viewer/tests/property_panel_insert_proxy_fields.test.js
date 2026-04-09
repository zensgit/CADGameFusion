import test from 'node:test';
import assert from 'node:assert/strict';

import { buildInsertProxyTextFieldDescriptors } from '../ui/property_panel_insert_proxy_fields.js';

test('buildInsertProxyTextFieldDescriptors preserves optional position fields', () => {
  const fields = buildInsertProxyTextFieldDescriptors(
    { type: 'text', textKind: 'attdef', value: 'DEF', position: { x: 26, y: 15 } },
    { allowPositionEditing: true },
    { patchSelection: () => {}, buildPatch: () => ({}) },
  );

  assert.deepEqual(
    fields.map((field) => [field.config.name, field.config.label]),
    [
      ['value', 'Default Text'],
      ['position.x', 'Position X'],
      ['position.y', 'Position Y'],
    ],
  );
});

test('buildInsertProxyTextFieldDescriptors preserves direct text patch and update message', () => {
  const calls = [];
  const fields = buildInsertProxyTextFieldDescriptors(
    { type: 'text', textKind: 'text', value: 'TEXT', position: { x: 10, y: 20 } },
    { allowPositionEditing: false },
    {
      patchSelection: (patch, message) => calls.push([patch, message]),
      buildPatch: () => ({ unexpected: true }),
    },
  );

  assert.equal(fields.length, 1);
  fields[0].onChange('UPDATED');
  assert.deepEqual(calls, [
    [{ value: 'UPDATED' }, 'Text updated'],
  ]);
});
