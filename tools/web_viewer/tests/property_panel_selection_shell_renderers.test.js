import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendEmptySelectionShell,
  appendMultipleSelectionShell,
  appendSingleSelectionShell,
} from '../ui/property_panel_selection_shell_renderers.js';

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

test('appendEmptySelectionShell preserves empty selection shell', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendEmptySelectionShell(doc, element);

  assert.equal(element.children.length, 1);
  assert.equal(element.children[0].className, 'cad-selection-empty');
  assert.equal(element.children[0].textContent, 'Select an entity to inspect provenance and effective style.');
});

test('appendSingleSelectionShell preserves single-selection hero, badges, and facts', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendSingleSelectionShell(
    doc,
    element,
    {
      id: 7,
      type: 'line',
      color: '#ffffff',
      sourceType: 'INSERT',
      proxyKind: 'fragment',
      layerId: 1,
    },
    [
      { key: 'layer', value: '1:L1' },
      { key: 'space', value: 'Paper' },
    ],
    [
      { key: 'effective-color', label: 'Effective Color', value: '#ff0000', swatch: '#ff0000' },
      { key: 'space', label: 'Space', value: 'Paper' },
    ],
  );

  assert.equal(element.children[0].className, 'cad-selection-hero');
  assert.equal(element.children[0].children[0].dataset.selectionColor, '#ff0000');
  assert.equal(element.children[0].children[1].children[0].textContent, 'line');
  assert.equal(element.children[0].children[1].children[1].textContent, 'INSERT / fragment');
  assert.equal(element.children[1].className, 'cad-selection-badges');
  assert.equal(element.children[1].children.length, 2);
  assert.equal(element.children[2].className, 'cad-selection-facts');
  assert.equal(element.children[2].children.length, 2);
});

test('appendMultipleSelectionShell preserves multiple-selection mixed shell', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendMultipleSelectionShell(
    doc,
    element,
    [{ key: 'read-only', value: 'Read-only' }],
    [{ key: 'released-group-id', label: 'Released Group ID', value: '700' }],
  );

  assert.equal(element.children[0].textContent, 'Multiple selection: common edit fields stay in Properties; shared provenance is summarized below.');
  assert.equal(element.children[1].className, 'cad-selection-badges');
  assert.equal(element.children[2].className, 'cad-selection-facts');
  assert.equal(element.children[2].children[0].dataset.selectionField, 'released-group-id');
});

test('appendMultipleSelectionShell preserves shared badge and fact rendering helpers across modes', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendMultipleSelectionShell(
    doc,
    element,
    [{ key: 'layer', value: '1:L1', tone: 'muted' }],
    [{ key: 'effective-color', label: 'Effective Color', value: '#00ff00', swatch: '#00ff00' }],
  );

  assert.equal(element.children[1].className, 'cad-selection-badges');
  assert.equal(element.children[1].children[0].className, 'cad-selection-badge is-muted');
  assert.equal(element.children[2].className, 'cad-selection-facts');
  assert.equal(element.children[2].children[0].children[1].className, 'cad-selection-fact__swatch');
  assert.equal(element.children[2].children[0].children[1].style.background, '#00ff00');
});

test('appendMultipleSelectionShell preserves multiple-selection no-detail fallback copy', () => {
  const doc = new FakeDocument();
  const element = new FakeElement(doc);

  appendMultipleSelectionShell(doc, element, [], []);

  assert.equal(
    element.children[0].textContent,
    'Multiple selection: common edit fields stay in Properties; provenance detail is shown for single selection only.',
  );
  assert.equal(element.children.length, 1);
});
