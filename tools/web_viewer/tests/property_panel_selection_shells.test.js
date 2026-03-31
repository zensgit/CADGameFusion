import test from 'node:test';
import assert from 'node:assert/strict';

import {
  renderPropertySelectionShells,
  setPropertySelectionDetails,
  setPropertySelectionSummary,
} from '../ui/property_panel_selection_shells.js';

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

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    this.textContent = '';
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(this, tagName);
  }
}

test('setPropertySelectionSummary sets text content', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);
  setPropertySelectionSummary(element, '1 selected (line)');
  assert.equal(element.textContent, '1 selected (line)');
});

test('renderPropertySelectionShells writes summary and details together', () => {
  const doc = new FakeDocument();
  const summary = new FakeElement(doc);
  const details = new FakeElement(doc);

  renderPropertySelectionShells(summary, details, {
    summaryText: '1 selected (circle)',
    mode: 'single',
    entityCount: 1,
    primary: {
      id: 3,
      type: 'circle',
      color: '#ffffff',
    },
    primaryLayer: {
      id: 1,
      name: 'L1',
      locked: false,
      frozen: false,
      printable: true,
      construction: false,
    },
    badges: [],
    detailFacts: [],
  });

  assert.equal(summary.textContent, '1 selected (circle)');
  assert.equal(details.dataset.mode, 'single');
  assert.ok(details.children.length >= 1);
});

test('setPropertySelectionDetails dispatches empty shell when no primary', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);
  setPropertySelectionDetails(element, { mode: 'empty' });
  assert.equal(element.dataset.mode, 'empty');
  assert.equal(element.children.length, 1);
  assert.equal(element.children[0].className, 'cad-selection-empty');
});

test('setPropertySelectionDetails dispatches single shell', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);
  setPropertySelectionDetails(element, {
    mode: 'single',
    entityCount: 1,
    primary: { id: 7, type: 'line', color: '#ffffff' },
    primaryLayer: { id: 1, name: 'L1', locked: false, frozen: false, printable: true, construction: false },
    badges: [],
    detailFacts: [],
  });

  assert.equal(element.dataset.mode, 'single');
  assert.ok(element.children.length >= 1);
});

test('setPropertySelectionDetails dispatches multiple shell', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);
  setPropertySelectionDetails(element, {
    mode: 'multiple',
    entityCount: 3,
    primary: { id: 1, type: 'line' },
    badges: [{ key: 'read-only', value: 'Read-only' }],
    detailFacts: [{ key: 'released-group-id', label: 'Group', value: '700' }],
  });

  assert.equal(element.dataset.mode, 'multiple');
  assert.ok(element.children.length >= 1);
});
