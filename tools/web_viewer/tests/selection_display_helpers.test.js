import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatCompactNumber,
  formatPeerContext,
  formatPeerTarget,
  formatPoint,
  formatSourceGroup,
} from '../ui/selection_display_helpers.js';

test('formatCompactNumber trims trailing zeroes and normalizes negative zero', () => {
  assert.equal(formatCompactNumber(12.3400), '12.34');
  assert.equal(formatCompactNumber(-0.000000001), '0');
  assert.equal(formatCompactNumber(Number.NaN), '');
});

test('formatPoint formats finite points and rejects invalid values', () => {
  assert.equal(formatPoint({ x: 10, y: 2.5 }), '10, 2.5');
  assert.equal(formatPoint({ x: 10, y: Number.NaN }), '');
  assert.equal(formatPoint(null), '');
});

test('formatPeerContext includes space label and trimmed layout when present', () => {
  assert.equal(formatPeerContext({ space: 0, layout: ' Model ' }), 'Model / Model');
  assert.equal(formatPeerContext({ space: 1, layout: ' Layout-A ' }), 'Paper / Layout-A');
  assert.equal(formatPeerContext({ space: 1, layout: '' }), 'Paper');
});

test('formatPeerTarget prefixes the 1-based index', () => {
  assert.equal(formatPeerTarget({ space: 1, layout: 'Layout-A' }, 0), '1: Paper / Layout-A');
  assert.equal(formatPeerTarget(null, 0), '');
});

test('formatSourceGroup normalizes source type and proxy kind casing', () => {
  assert.equal(formatSourceGroup({ sourceType: ' dimension ', proxyKind: 'TEXT ' }), 'DIMENSION / text');
  assert.equal(formatSourceGroup({ sourceType: 'insert' }), 'INSERT');
  assert.equal(formatSourceGroup({ proxyKind: 'Fragment' }), 'fragment');
});
