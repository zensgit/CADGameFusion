import test from 'node:test';
import assert from 'node:assert/strict';

import { createPropertyPanelDomAdapter } from '../ui/property_panel_dom_adapter.js';

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

  dispatch(type) {
    for (const listener of this._listeners.get(type) || []) {
      listener();
    }
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
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }
}

function createHarness() {
  const fakeDocument = new FakeDocument();
  const form = new FakeElement('form', fakeDocument);
  const adapter = createPropertyPanelDomAdapter({ form });
  return { form, adapter };
}

test('createPropertyPanelDomAdapter preserves action row wiring and datasets', () => {
  const { form, adapter } = createHarness();
  const calls = [];

  adapter.addActionRow([
    { id: 'locate-layer', label: 'Locate Layer', onClick: () => calls.push('locate') },
    null,
    { id: 'fit-source-group', label: 'Fit Source Group', onClick: () => calls.push('fit') },
  ]);

  assert.equal(form.childElementCount, 1);
  const row = form.children[0];
  assert.equal(row.className, 'cad-property-actions');
  assert.equal(row.dataset.propertyActions, 'true');
  assert.deepEqual(
    row.children.map((child) => [child.dataset.propertyAction, child.textContent]),
    [
      ['locate-layer', 'Locate Layer'],
      ['fit-source-group', 'Fit Source Group'],
    ],
  );

  row.children[0].dispatch('click');
  row.children[1].dispatch('click');
  assert.deepEqual(calls, ['locate', 'fit']);
});

test('createPropertyPanelDomAdapter preserves field descriptor routing', () => {
  const { form, adapter } = createHarness();
  const calls = [];

  adapter.appendFieldDescriptors([
    {
      kind: 'field',
      config: { label: 'Layer ID', name: 'layerId', type: 'number', value: '2' },
      onChange: (value) => calls.push(['field', value]),
    },
    {
      kind: 'toggle',
      label: 'Visible',
      checked: true,
      onChange: (checked) => calls.push(['toggle', checked]),
    },
  ]);

  assert.equal(form.childElementCount, 2);
  const numberInput = form.children[0].children[0];
  numberInput.value = '7';
  numberInput.dispatch('change');
  const toggleInput = form.children[1].children[0];
  toggleInput.checked = false;
  toggleInput.dispatch('change');

  assert.deepEqual(calls, [
    ['field', '7'],
    ['toggle', false],
  ]);
});

test('createPropertyPanelDomAdapter preserves info and note rows', () => {
  const { form, adapter } = createHarness();

  adapter.appendInfoRows([
    { label: 'Layer', value: '1:L1', key: 'layer' },
    { label: 'Space', value: 'Model', key: 'space' },
  ]);
  adapter.addNote('Editable selection', 'editable-note');
  adapter.addReadonlyNote('Read-only selection', 'read-only-note');

  assert.deepEqual(
    form.children.map((child) => [child.className, child.dataset.propertyInfo, child.textContent]),
    [
      ['cad-readonly-meta', 'layer', 'Layer: 1:L1'],
      ['cad-readonly-meta', 'space', 'Space: Model'],
      ['cad-readonly-meta', 'editable-note', 'Editable selection'],
      ['cad-readonly-note', 'read-only-note', 'Read-only selection'],
    ],
  );
});
