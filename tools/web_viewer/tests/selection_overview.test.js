import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSelectionSummary, formatSelectionStatus } from '../ui/selection_overview.js';

function makeEntity(overrides = {}) {
  return { id: 1, type: 'line', ...overrides };
}

// --- formatSelectionSummary ---

test('formatSelectionSummary returns "No selection" for empty list', () => {
  assert.equal(formatSelectionSummary([]), 'No selection');
});

test('formatSelectionSummary returns "No selection" for null/undefined', () => {
  assert.equal(formatSelectionSummary(null), 'No selection');
  assert.equal(formatSelectionSummary(undefined), 'No selection');
});

test('formatSelectionSummary lists types for single entity', () => {
  assert.equal(formatSelectionSummary([makeEntity({ type: 'circle' })]), '1 selected (circle)');
});

test('formatSelectionSummary lists types for multiple entities', () => {
  const entities = [
    makeEntity({ id: 1, type: 'line' }),
    makeEntity({ id: 2, type: 'circle' }),
    makeEntity({ id: 3, type: 'text' }),
  ];
  assert.equal(formatSelectionSummary(entities), '3 selected (line, circle, text)');
});

// --- formatSelectionStatus ---

test('formatSelectionStatus returns "Selection: none" for empty list', () => {
  assert.equal(formatSelectionStatus([], null), 'Selection: none');
});

test('formatSelectionStatus returns "Selection: none" for null/undefined', () => {
  assert.equal(formatSelectionStatus(null, null), 'Selection: none');
});

test('formatSelectionStatus shows type for single entity', () => {
  const entity = makeEntity({ type: 'circle' });
  assert.equal(formatSelectionStatus([entity], 1), 'Selection: circle');
});

test('formatSelectionStatus shows provenance detail for single entity with origin', () => {
  const entity = makeEntity({ type: 'line', sourceType: 'INSERT', proxyKind: 'fragment' });
  assert.equal(formatSelectionStatus([entity], 1), 'Selection: line | INSERT / fragment');
});

test('formatSelectionStatus uses primary fallback to first entity when primaryId not found', () => {
  const e1 = makeEntity({ id: 1, type: 'line' });
  assert.equal(formatSelectionStatus([e1], 999), 'Selection: line');
});

test('formatSelectionStatus shows entity count and types for multi-selection', () => {
  const entities = [
    makeEntity({ id: 1, type: 'line' }),
    makeEntity({ id: 2, type: 'circle' }),
  ];
  assert.equal(formatSelectionStatus(entities, 1), 'Selection: 2 entities | line,circle');
});

test('formatSelectionStatus shows read-only count for multi-selection', () => {
  const entities = [
    makeEntity({ id: 1, type: 'line', readOnly: true }),
    makeEntity({ id: 2, type: 'circle' }),
    makeEntity({ id: 3, type: 'text', readOnly: true }),
  ];
  assert.equal(formatSelectionStatus(entities, 1), 'Selection: 3 entities | line,circle,text | 2 read-only');
});

test('formatSelectionStatus omits read-only segment when no read-only entities', () => {
  const entities = [
    makeEntity({ id: 1, type: 'line' }),
    makeEntity({ id: 2, type: 'circle' }),
  ];
  const result = formatSelectionStatus(entities, 1);
  assert.ok(!result.includes('read-only'));
});

test('formatSelectionStatus limits type summary to 3 unique types', () => {
  const entities = [
    makeEntity({ id: 1, type: 'line' }),
    makeEntity({ id: 2, type: 'circle' }),
    makeEntity({ id: 3, type: 'text' }),
    makeEntity({ id: 4, type: 'arc' }),
  ];
  assert.equal(formatSelectionStatus(entities, 1), 'Selection: 4 entities | line,circle,text');
});
