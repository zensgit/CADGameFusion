import test from 'node:test';
import assert from 'node:assert/strict';

import { appendSourceTextGuideRows } from '../ui/source_text_guide_rows.js';

function makeEntity(overrides = {}) {
  return {
    id: 1,
    type: 'text',
    sourceType: 'DIMENSION',
    editMode: 'proxy',
    proxyKind: 'text',
    sourceTextPos: { x: 5, y: 10 },
    sourceTextRotation: 0,
    ...overrides,
  };
}

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('appendSourceTextGuideRows does nothing for null entity', () => {
  const rows = [];
  appendSourceTextGuideRows(rows, null, null);
  assert.deepEqual(rows, []);
});

test('appendSourceTextGuideRows adds source text position and rotation rows', () => {
  const rows = [];
  appendSourceTextGuideRows(rows, makeEntity(), null);

  assert.deepEqual(toMap(rows), {
    'source-text-pos': '5, 10',
    'source-text-rotation': '0',
  });
});

test('appendSourceTextGuideRows omits guide-only rows for non-editable source text entities', () => {
  const rows = [];
  appendSourceTextGuideRows(rows, makeEntity({ editMode: '' }), {
    anchor: { x: 0, y: 0 },
    sourceOffset: { x: 0, y: 14 },
  });

  assert.deepEqual(rows.map((row) => row.key), ['source-text-pos', 'source-text-rotation']);
});

test('appendSourceTextGuideRows appends dimension anchor and offset rows', () => {
  const rows = [];
  appendSourceTextGuideRows(rows, makeEntity(), {
    sourceType: 'DIMENSION',
    anchor: { x: 0, y: 0 },
    anchorDriverId: 31,
    anchorDriverLabel: 'line midpoint',
    sourceOffset: { x: 0, y: 14 },
    currentOffset: { x: 4, y: 18 },
  });

  assert.deepEqual(toMap(rows), {
    'source-text-pos': '5, 10',
    'source-text-rotation': '0',
    'source-anchor': '0, 0',
    'source-anchor-driver': '31:line midpoint',
    'source-offset': '0, 14',
    'current-offset': '4, 18',
  });
  assert.deepEqual(rows.map((row) => row.key), [
    'source-text-pos',
    'source-text-rotation',
    'source-anchor',
    'source-anchor-driver',
    'source-offset',
    'current-offset',
  ]);
});

test('appendSourceTextGuideRows appends leader landing rows', () => {
  const rows = [];
  appendSourceTextGuideRows(rows, makeEntity({ sourceType: 'LEADER' }), {
    sourceType: 'LEADER',
    anchor: { x: 56, y: 6 },
    landingPoint: { x: 56, y: 6 },
    elbowPoint: { x: 50, y: 0 },
    landingLength: 8.485281374,
  });

  assert.deepEqual(toMap(rows), {
    'source-text-pos': '5, 10',
    'source-text-rotation': '0',
    'source-anchor': '56, 6',
    'leader-landing': '56, 6',
    'leader-elbow': '50, 0',
    'leader-landing-length': '8.485',
  });
  assert.deepEqual(rows.map((row) => row.key), [
    'source-text-pos',
    'source-text-rotation',
    'source-anchor',
    'leader-landing',
    'leader-elbow',
    'leader-landing-length',
  ]);
});
