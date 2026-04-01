import test from 'node:test';
import assert from 'node:assert/strict';

import { executePropertyPanelRenderBranch } from '../ui/property_panel_render_branch_execution.js';

test('defaults branch calls renderCurrentLayerDefaults and returns rendered true', () => {
  const calls = [];
  const context = {
    controller: {
      renderCurrentLayerDefaults: () => calls.push('defaults'),
    },
  };
  const branchState = {
    kind: 'empty',
    shouldRenderCurrentLayerDefaults: true,
    shouldRenderActiveSelection: false,
    selectionContext: null,
  };

  const result = executePropertyPanelRenderBranch(context, branchState);

  assert.deepEqual(calls, ['defaults']);
  assert.deepEqual(result, { rendered: true, kind: 'empty' });
});

test('non-rendered branch returns rendered false without side effects', () => {
  const calls = [];
  const context = {
    controller: {
      renderCurrentLayerDefaults: () => calls.push('defaults'),
    },
  };
  const branchState = {
    kind: 'missing',
    shouldRenderCurrentLayerDefaults: false,
    shouldRenderActiveSelection: false,
    selectionContext: null,
  };

  const result = executePropertyPanelRenderBranch(context, branchState);

  assert.deepEqual(calls, []);
  assert.deepEqual(result, { rendered: false, kind: 'missing' });
});

test('active branch builds input from branchState.selectionContext and delegates to active render', () => {
  const calls = [];
  const entity = { id: 1, type: 'line' };
  const selectionContext = {
    kind: 'active',
    entities: [entity],
    primary: entity,
  };
  const context = {
    controller: {
      renderCurrentLayerDefaults: () => calls.push('defaults'),
    },
    glueFacade: { kind: 'glue' },
    selectionInfoHelpers: { kind: 'selectionInfo' },
  };
  const branchState = {
    kind: 'active',
    shouldRenderCurrentLayerDefaults: false,
    shouldRenderActiveSelection: true,
    selectionContext,
  };
  const activeResult = { rendered: true, blockedAt: null };

  const result = executePropertyPanelRenderBranch(context, branchState, {
    buildPropertyPanelActiveSelectionInput: (ctx, sc) => {
      calls.push(['build-active', sc]);
      return { entities: sc.entities, primary: sc.primary };
    },
    renderPropertyPanelActiveSelection: (payload) => {
      calls.push(['active', payload]);
      return activeResult;
    },
  });

  assert.deepEqual(calls, [
    ['build-active', selectionContext],
    ['active', { entities: [entity], primary: entity }],
  ]);
  assert.deepEqual(result, activeResult);
});

test('active branch uses default collaborators when deps omitted', () => {
  const entity = { id: 1, type: 'line' };
  const branchState = {
    kind: 'active',
    shouldRenderCurrentLayerDefaults: false,
    shouldRenderActiveSelection: true,
    selectionContext: {
      kind: 'active',
      entities: [entity],
      primary: entity,
    },
  };

  // When deps are omitted, the helper falls through to the real imports.
  // We verify it doesn't throw by providing just enough context shape.
  // The real buildPropertyPanelActiveSelectionInput will read context fields.
  const context = {
    controller: { renderCurrentLayerDefaults: () => {} },
    documentState: {},
    glueFacade: {},
    selectionInfoHelpers: {},
    branchContextHelper: {},
    addReadonlyNote: () => {},
    form: {},
  };

  // This will call the real active render path, which will try to assemble
  // render state. We inject only renderPropertyPanelActiveSelection to
  // avoid needing the full DOM environment.
  const result = executePropertyPanelRenderBranch(context, branchState, {
    renderPropertyPanelActiveSelection: () => ({ rendered: true, blockedAt: null }),
  });

  assert.equal(result.rendered, true);
});
