import test from 'node:test';
import assert from 'node:assert/strict';

import { attachPropertyPanelLifecycle } from '../ui/property_panel_lifecycle.js';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchChange() {
    for (const listener of this.listeners.get('change') || []) {
      listener();
    }
  }
}

test('attachPropertyPanelLifecycle auto-renders and subscribes both state emitters', () => {
  const selectionState = new FakeEventTarget();
  const documentState = new FakeEventTarget();
  const calls = [];

  const lifecycle = attachPropertyPanelLifecycle({
    selectionState,
    documentState,
    render: () => calls.push('render'),
  });

  assert.deepEqual(calls, ['render']);

  selectionState.dispatchChange();
  documentState.dispatchChange();

  assert.deepEqual(calls, ['render', 'render', 'render']);
  assert.equal(typeof lifecycle.render, 'function');
  assert.equal(typeof lifecycle.dispose, 'function');
});

test('attachPropertyPanelLifecycle dispose removes subscriptions', () => {
  const selectionState = new FakeEventTarget();
  const documentState = new FakeEventTarget();
  const calls = [];

  const lifecycle = attachPropertyPanelLifecycle({
    selectionState,
    documentState,
    render: () => calls.push('render'),
  });

  lifecycle.dispose();
  selectionState.dispatchChange();
  documentState.dispatchChange();

  assert.deepEqual(calls, ['render']);
});

test('attachPropertyPanelLifecycle supports disabled auto-render', () => {
  const calls = [];

  const lifecycle = attachPropertyPanelLifecycle({
    selectionState: null,
    documentState: null,
    render: () => calls.push('render'),
    autoRender: false,
  });

  assert.deepEqual(calls, []);
  lifecycle.render();
  assert.deepEqual(calls, ['render']);
});
