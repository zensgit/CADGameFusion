import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPropertyPanelActiveSelectionInput,
  resolvePropertyPanelReadonlyNote,
} from '../ui/property_panel_render_inputs.js';

test('resolvePropertyPanelReadonlyNote prefers domBindings bag over legacy field', () => {
  const fromBag = () => {};
  const legacy = () => {};

  assert.equal(
    resolvePropertyPanelReadonlyNote({
      domBindings: { addReadonlyNote: fromBag },
      addReadonlyNote: legacy,
    }),
    fromBag,
  );
  assert.notEqual(
    resolvePropertyPanelReadonlyNote({
      domBindings: { addReadonlyNote: fromBag },
      addReadonlyNote: legacy,
    }),
    legacy,
  );
});

test('buildPropertyPanelActiveSelectionInput preserves render payload wiring', () => {
  const entity = { id: 1, type: 'line' };
  const addReadonlyNote = () => {};
  const context = {
    documentState: { kind: 'document' },
    controller: { kind: 'controller' },
    glueFacade: { kind: 'glue' },
    selectionInfoHelpers: { kind: 'selection-info' },
    branchContextHelper: { kind: 'branch-context' },
    addReadonlyNote,
  };
  const selectionContext = {
    entities: [entity],
    primary: entity,
  };

  assert.deepEqual(
    buildPropertyPanelActiveSelectionInput(context, selectionContext),
    {
      entities: [entity],
      primary: entity,
      documentState: { kind: 'document' },
      controller: { kind: 'controller' },
      glueFacade: { kind: 'glue' },
      selectionInfoHelpers: { kind: 'selection-info' },
      branchContextHelper: { kind: 'branch-context' },
      addReadonlyNote,
    },
  );
});
