import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSingleEntityEditFieldDescriptors } from '../ui/property_panel_single_entity_fields.js';

test('buildSingleEntityEditFieldDescriptors preserves line and arc field labels', () => {
  const lineFields = buildSingleEntityEditFieldDescriptors(
    { type: 'line', start: { x: 0, y: 1 }, end: { x: 2, y: 3 } },
    { patchSelection: () => {}, buildPatch: () => ({}) },
  );
  const arcFields = buildSingleEntityEditFieldDescriptors(
    { type: 'arc', center: { x: 4, y: 5 }, radius: 6, startAngle: 0.1, endAngle: 0.9 },
    { patchSelection: () => {}, buildPatch: () => ({}) },
  );

  assert.deepEqual(
    lineFields.map((field) => field.config.label),
    ['Start X', 'Start Y', 'End X', 'End Y'],
  );
  assert.deepEqual(
    arcFields.map((field) => field.config.label),
    ['Center X', 'Center Y', 'Radius', 'Start Angle (rad)', 'End Angle (rad)'],
  );
});

test('buildSingleEntityEditFieldDescriptors preserves polyline toggle semantics', () => {
  const calls = [];
  const fields = buildSingleEntityEditFieldDescriptors(
    { type: 'polyline', closed: false },
    {
      patchSelection: (patch, message) => calls.push([patch, message]),
      buildPatch: () => { throw new Error('buildPatch should not be used for polyline closed toggle'); },
    },
  );

  assert.equal(fields.length, 1);
  assert.equal(fields[0].kind, 'toggle');
  fields[0].onChange(true);
  assert.deepEqual(calls, [
    [{ closed: true }, 'Polyline closed updated'],
  ]);
});

test('buildSingleEntityEditFieldDescriptors preserves text delegation', () => {
  const fields = buildSingleEntityEditFieldDescriptors(
    { type: 'text', value: 'TEXT', position: { x: 10, y: 20 }, height: 2.5, rotation: 0 },
    { patchSelection: () => {}, buildPatch: () => ({}) },
  );

  assert.deepEqual(
    fields.map((field) => field.config.label),
    ['Text', 'Position X', 'Position Y', 'Height', 'Rotation (rad)'],
  );
});
