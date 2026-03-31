import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { createPropertyPanel } from '../ui/property_panel.js';

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName || '').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.textContent = '';
    this.value = '';
    this.type = '';
    this.name = '';
    this.checked = false;
    this.parentNode = null;
    this._listeners = new Map();
    this._innerHTML = '';
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) {
      this._listeners.set(type, []);
    }
    this._listeners.get(type).push(listener);
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get childElementCount() {
    return this.children.length;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  registerElement(id, element) {
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

function createDomFixture() {
  const fakeDocument = new FakeDocument();
  const form = fakeDocument.registerElement('cad-property-form', new FakeElement('form', fakeDocument));
  const summary = fakeDocument.registerElement('cad-selection-summary', new FakeElement('div', fakeDocument));
  const details = fakeDocument.registerElement('cad-selection-details', new FakeElement('div', fakeDocument));
  return { fakeDocument, form, summary, details };
}

test('createPropertyPanel auto-renders and stays subscribed to selection/document changes', () => {
  const previousDocument = globalThis.document;
  const { fakeDocument, form, summary, details } = createDomFixture();
  globalThis.document = fakeDocument;

  try {
    const documentState = new DocumentState();
    const selectionState = new SelectionState();

    createPropertyPanel({
      documentState,
      selectionState,
      commandBus: {
        execute: () => ({ ok: true, changed: true, message: 'ok' }),
      },
      setStatus: () => {},
    });

    assert.equal(form.childElementCount, 0);
    assert.equal(summary.textContent, 'No selection');
    assert.equal(details.dataset.mode, 'empty');

    documentState.addEntity({
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      visible: true,
      color: '#ffffff',
    });
    selectionState.setSelection([1], 1);

    assert.notEqual(summary.textContent, 'No selection');
    assert.equal(details.dataset.mode, 'single');
    assert.ok(form.childElementCount > 0);
  } finally {
    globalThis.document = previousDocument;
  }
});

test('createPropertyPanel dispose removes selection/document subscriptions', () => {
  const previousDocument = globalThis.document;
  const { fakeDocument, summary, details } = createDomFixture();
  globalThis.document = fakeDocument;

  try {
    const documentState = new DocumentState();
    const selectionState = new SelectionState();

    const panel = createPropertyPanel({
      documentState,
      selectionState,
      commandBus: {
        execute: () => ({ ok: true, changed: true, message: 'ok' }),
      },
      setStatus: () => {},
    });

    panel.dispose();

    documentState.addEntity({
      type: 'line',
      start: { x: 0, y: 0 },
      end: { x: 10, y: 0 },
      layerId: 0,
      visible: true,
      color: '#ffffff',
    });
    selectionState.setSelection([1], 1);

    assert.equal(summary.textContent, 'No selection');
    assert.equal(details.dataset.mode, 'empty');
  } finally {
    globalThis.document = previousDocument;
  }
});
