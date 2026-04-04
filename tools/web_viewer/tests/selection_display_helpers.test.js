import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  formatCompactNumber,
  formatPoint,
  formatPeerContext,
  formatPeerTarget,
} from '../ui/selection_display_helpers.js';

test('normalizeText trims strings', () => {
  assert.equal(normalizeText('  hello  '), 'hello');
  assert.equal(normalizeText(''), '');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText(undefined), '');
  assert.equal(normalizeText(42), '');
});

test('formatCompactNumber formats finite numbers compactly', () => {
  assert.equal(formatCompactNumber(0), '0');
  assert.equal(formatCompactNumber(1), '1');
  assert.equal(formatCompactNumber(1.5), '1.5');
  assert.equal(formatCompactNumber(1.123), '1.123');
  assert.equal(formatCompactNumber(1.100), '1.1');
  assert.equal(formatCompactNumber(-0), '0');
  assert.equal(formatCompactNumber(1e-10), '0');
  assert.equal(formatCompactNumber(NaN), '');
  assert.equal(formatCompactNumber(Infinity), '');
  assert.equal(formatCompactNumber(undefined), '');
});

test('formatPoint formats {x, y} objects', () => {
  assert.equal(formatPoint({ x: 5, y: 10 }), '5, 10');
  assert.equal(formatPoint({ x: -20, y: 14.5 }), '-20, 14.5');
  assert.equal(formatPoint({ x: 0, y: 0 }), '0, 0');
  assert.equal(formatPoint(null), '');
  assert.equal(formatPoint(undefined), '');
  assert.equal(formatPoint({ x: NaN, y: 0 }), '');
  assert.equal(formatPoint({}), '');
});

test('formatPeerContext formats peer space and layout', () => {
  assert.equal(formatPeerContext({ space: 0, layout: 'Model' }), 'Model / Model');
  assert.equal(formatPeerContext({ space: 1, layout: 'Layout-A' }), 'Paper / Layout-A');
  assert.equal(formatPeerContext({ space: 1, layout: '' }), 'Paper');
  assert.equal(formatPeerContext({ space: 1 }), 'Paper');
  assert.equal(formatPeerContext(null), '');
  assert.equal(formatPeerContext(undefined), '');
});

test('formatPeerTarget formats indexed peer target', () => {
  assert.equal(formatPeerTarget({ space: 1, layout: 'Layout-A' }, 0), '1: Paper / Layout-A');
  assert.equal(formatPeerTarget({ space: 1, layout: 'Layout-B' }, 2), '3: Paper / Layout-B');
  assert.equal(formatPeerTarget(null, 0), '');
});
