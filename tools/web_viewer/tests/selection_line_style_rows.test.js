import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSelectionLineStyleRows } from '../ui/selection_line_style_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('appendSelectionLineStyleRows appends all rows in stable order for explicit style values', () => {
  const rows = [];
  appendSelectionLineStyleRows(rows, {
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1.25,
  }, {
    lineTypeSource: 'EXPLICIT',
    lineWeightSource: 'EXPLICIT',
    lineTypeScaleSource: 'EXPLICIT',
  });

  assert.deepEqual(rows.map((row) => row.key), [
    'line-type',
    'line-type-source',
    'line-weight',
    'line-weight-source',
    'line-type-scale',
    'line-type-scale-source',
  ]);
  assert.deepEqual(toMap(rows), {
    'line-type': 'CENTER',
    'line-type-source': 'EXPLICIT',
    'line-weight': '0.35',
    'line-weight-source': 'EXPLICIT',
    'line-type-scale': '1.25',
    'line-type-scale-source': 'EXPLICIT',
  });
});

test('appendSelectionLineStyleRows keeps line-weight for positive BYLAYER effective weight', () => {
  const rows = [];
  appendSelectionLineStyleRows(rows, {
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineTypeScale: 1,
  }, {
    lineTypeSource: 'BYLAYER',
    lineWeightSource: 'BYLAYER',
    lineTypeScaleSource: 'DEFAULT',
  });

  assert.equal(toMap(rows)['line-weight'], '0.35');
  assert.equal(toMap(rows)['line-weight-source'], 'BYLAYER');
});

test('appendSelectionLineStyleRows omits line-weight when non-explicit and zero', () => {
  const rows = [];
  appendSelectionLineStyleRows(rows, {
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineTypeScale: 1,
  }, {
    lineTypeSource: 'BYLAYER',
    lineWeightSource: 'BYLAYER',
    lineTypeScaleSource: 'DEFAULT',
  });

  const keys = rows.map((row) => row.key);
  assert.ok(!keys.includes('line-weight'));
  assert.ok(keys.includes('line-weight-source'));
});

test('appendSelectionLineStyleRows omits line-type-scale when not finite', () => {
  const rows = [];
  appendSelectionLineStyleRows(rows, {
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineTypeScale: null,
  }, {
    lineTypeSource: 'BYLAYER',
    lineWeightSource: 'BYLAYER',
    lineTypeScaleSource: 'DEFAULT',
  });

  const keys = rows.map((row) => row.key);
  assert.ok(!keys.includes('line-type-scale'));
  assert.ok(keys.includes('line-type-scale-source'));
});
