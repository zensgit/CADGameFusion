import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderSelectionBadgeRow,
  renderSelectionFactList,
} from '../ui/property_panel_selection_row_renderers.js';

class FakeElement {
  constructor(ownerDocument, tagName = 'div') {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

// --- renderSelectionBadgeRow ---

test('renderSelectionBadgeRow returns null for empty array', () => {
  const doc = new FakeDocument();
  assert.equal(renderSelectionBadgeRow(doc, []), null);
});

test('renderSelectionBadgeRow returns null for non-array', () => {
  const doc = new FakeDocument();
  assert.equal(renderSelectionBadgeRow(doc, null), null);
  assert.equal(renderSelectionBadgeRow(doc, undefined), null);
});

test('renderSelectionBadgeRow renders badges with correct class and dataset', () => {
  const doc = new FakeDocument();
  const row = renderSelectionBadgeRow(doc, [
    { key: 'layer', value: '1:L1' },
    { key: 'space', value: 'Paper' },
  ]);
  assert.equal(row.className, 'cad-selection-badges');
  assert.equal(row.children.length, 2);
  assert.equal(row.children[0].className, 'cad-selection-badge');
  assert.equal(row.children[0].dataset.selectionBadge, 'layer');
  assert.equal(row.children[0].textContent, '1:L1');
  assert.equal(row.children[1].dataset.selectionBadge, 'space');
  assert.equal(row.children[1].textContent, 'Paper');
});

test('renderSelectionBadgeRow applies tone class', () => {
  const doc = new FakeDocument();
  const row = renderSelectionBadgeRow(doc, [
    { key: 'status', value: 'Active', tone: 'muted' },
  ]);
  assert.equal(row.children[0].className, 'cad-selection-badge is-muted');
});

test('renderSelectionBadgeRow omits tone class when tone is absent', () => {
  const doc = new FakeDocument();
  const row = renderSelectionBadgeRow(doc, [
    { key: 'status', value: 'Active' },
  ]);
  assert.equal(row.children[0].className, 'cad-selection-badge');
});

// --- renderSelectionFactList ---

test('renderSelectionFactList returns null for empty array', () => {
  const doc = new FakeDocument();
  assert.equal(renderSelectionFactList(doc, []), null);
});

test('renderSelectionFactList returns null for non-array', () => {
  const doc = new FakeDocument();
  assert.equal(renderSelectionFactList(doc, null), null);
  assert.equal(renderSelectionFactList(doc, undefined), null);
});

test('renderSelectionFactList renders facts with label and value', () => {
  const doc = new FakeDocument();
  const facts = renderSelectionFactList(doc, [
    { key: 'space', label: 'Space', value: 'Paper' },
  ]);
  assert.equal(facts.className, 'cad-selection-facts');
  assert.equal(facts.children.length, 1);
  assert.equal(facts.children[0].className, 'cad-selection-fact');
  assert.equal(facts.children[0].dataset.selectionField, 'space');
  // label span, then strong value (no swatch)
  assert.equal(facts.children[0].children.length, 2);
  assert.equal(facts.children[0].children[0].textContent, 'Space');
  assert.equal(facts.children[0].children[1].textContent, 'Paper');
});

test('renderSelectionFactList renders swatch when present', () => {
  const doc = new FakeDocument();
  const facts = renderSelectionFactList(doc, [
    { key: 'effective-color', label: 'Effective Color', value: '#ff0000', swatch: '#ff0000' },
  ]);
  const row = facts.children[0];
  // label span, swatch span, strong value
  assert.equal(row.children.length, 3);
  assert.equal(row.children[1].className, 'cad-selection-fact__swatch');
  assert.equal(row.children[1].style.background, '#ff0000');
});

test('renderSelectionFactList omits swatch when absent', () => {
  const doc = new FakeDocument();
  const facts = renderSelectionFactList(doc, [
    { key: 'space', label: 'Space', value: 'Model' },
  ]);
  const row = facts.children[0];
  assert.equal(row.children.length, 2);
});
