import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelRenderBranchState } from '../ui/property_panel_render_branch_state.js';

test('empty selection context routes to current-layer defaults branch', () => {
  const selectionContext = {
    kind: 'empty',
    entities: [],
    primary: null,
    presentation: { summaryText: 'No selection', mode: 'empty' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.kind, 'empty');
  assert.equal(state.shouldRenderCurrentLayerDefaults, true);
  assert.equal(state.shouldRenderActiveSelection, false);
  assert.equal(state.presentation, selectionContext.presentation);
  assert.equal(state.selectionContext, selectionContext);
});

test('missing selection context routes to non-rendered branch', () => {
  const selectionContext = {
    kind: 'missing',
    entities: [],
    primary: null,
    presentation: { summaryText: 'No selection', mode: 'empty' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.kind, 'missing');
  assert.equal(state.shouldRenderCurrentLayerDefaults, false);
  assert.equal(state.shouldRenderActiveSelection, false);
});

test('active selection with no entities routes to non-rendered branch', () => {
  const selectionContext = {
    kind: 'active',
    entities: [],
    primary: null,
    presentation: { summaryText: 'No selection', mode: 'empty' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.kind, 'active');
  assert.equal(state.shouldRenderCurrentLayerDefaults, false);
  assert.equal(state.shouldRenderActiveSelection, false);
});

test('active selection with entities but no primary routes to non-rendered branch', () => {
  const entity = { id: 1, type: 'line' };
  const selectionContext = {
    kind: 'active',
    entities: [entity],
    primary: null,
    presentation: { summaryText: '1 selected (line)', mode: 'single' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.kind, 'active');
  assert.equal(state.shouldRenderCurrentLayerDefaults, false);
  assert.equal(state.shouldRenderActiveSelection, false);
});

test('active selection with primary routes to active-render branch', () => {
  const entity = { id: 1, type: 'line' };
  const selectionContext = {
    kind: 'active',
    entities: [entity],
    primary: entity,
    presentation: { summaryText: '1 selected (line)', mode: 'single' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.kind, 'active');
  assert.equal(state.shouldRenderCurrentLayerDefaults, false);
  assert.equal(state.shouldRenderActiveSelection, true);
  assert.equal(state.presentation, selectionContext.presentation);
  assert.equal(state.selectionContext, selectionContext);
});

test('active multiple selection with primary routes to active-render branch', () => {
  const entity1 = { id: 1, type: 'line' };
  const entity2 = { id: 2, type: 'circle' };
  const selectionContext = {
    kind: 'active',
    entities: [entity1, entity2],
    primary: entity1,
    presentation: { summaryText: '2 selected', mode: 'multiple' },
  };

  const state = buildPropertyPanelRenderBranchState(selectionContext);

  assert.equal(state.shouldRenderActiveSelection, true);
  assert.equal(state.shouldRenderCurrentLayerDefaults, false);
});
