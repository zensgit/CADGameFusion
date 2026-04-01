import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePropertyPanelDomRoots } from '../ui/property_panel_dom_roots.js';

class FakeDocument {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }

  getElementById(id) {
    return this.entries.get(id) || null;
  }
}

test('resolvePropertyPanelDomRoots returns form, summary, and details when form exists', () => {
  const roots = resolvePropertyPanelDomRoots({
    rootDocument: new FakeDocument({
      'cad-property-form': { kind: 'form' },
      'cad-selection-summary': { kind: 'summary' },
      'cad-selection-details': { kind: 'details' },
    }),
  });

  assert.deepEqual(roots, {
    form: { kind: 'form' },
    summary: { kind: 'summary' },
    details: { kind: 'details' },
  });
});

test('resolvePropertyPanelDomRoots returns null when form is missing', () => {
  const roots = resolvePropertyPanelDomRoots({
    rootDocument: new FakeDocument({
      'cad-selection-summary': { kind: 'summary' },
      'cad-selection-details': { kind: 'details' },
    }),
  });

  assert.equal(roots, null);
});

test('resolvePropertyPanelDomRoots tolerates missing summary/details shells', () => {
  const roots = resolvePropertyPanelDomRoots({
    rootDocument: new FakeDocument({
      'cad-property-form': { kind: 'form' },
    }),
  });

  assert.deepEqual(roots, {
    form: { kind: 'form' },
    summary: null,
    details: null,
  });
});
