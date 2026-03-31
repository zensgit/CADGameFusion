import test from 'node:test';
import assert from 'node:assert/strict';

import { runPropertyPanelRenderPipeline } from '../ui/property_panel_render_pipeline.js';

function makeContext() {
  return {
    form: { innerHTML: 'dirty' },
    summary: { id: 'summary' },
    details: { id: 'details' },
    selectionState: { kind: 'test-selection' },
    documentState: { kind: 'test-document' },
    controller: { renderCurrentLayerDefaults: () => {} },
  };
}

function makeResolvedDeps(overrides = {}) {
  const calls = [];
  const selectionContext = overrides.selectionContext || {
    kind: 'active',
    entities: [{ id: 1, type: 'line' }],
    primary: { id: 1, type: 'line' },
  };
  const presentation = overrides.presentation || { summaryText: 'test', mode: 'single' };
  const branchState = overrides.branchState || {
    kind: 'active',
    presentation,
    selectionContext,
    shouldRenderCurrentLayerDefaults: false,
    shouldRenderActiveSelection: true,
  };
  const executionResult = overrides.executionResult || { rendered: true, kind: 'active' };

  return {
    calls,
    resolveSelectionContext: (selState, docState) => {
      calls.push(['resolveSelectionContext', selState, docState]);
      return selectionContext;
    },
    buildBranchState: (sc) => {
      calls.push(['buildBranchState', sc]);
      return branchState;
    },
    renderSelectionShells: (summary, details, pres) => {
      calls.push(['renderSelectionShells', summary, details, pres]);
    },
    executeBranch: (ctx, bs, rawDeps) => {
      calls.push(['executeBranch', ctx, bs, rawDeps]);
      return executionResult;
    },
  };
}

test('pipeline clears form innerHTML before any collaborator call', () => {
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps);

  assert.equal(context.form.innerHTML, '');
});

test('pipeline calls collaborators in correct order', () => {
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps);

  const callNames = deps.calls.map((c) => c[0]);
  assert.deepEqual(callNames, [
    'resolveSelectionContext',
    'buildBranchState',
    'renderSelectionShells',
    'executeBranch',
  ]);
});

test('pipeline passes context.selectionState and context.documentState to resolveSelectionContext', () => {
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps);

  const [, selState, docState] = deps.calls[0];
  assert.equal(selState, context.selectionState);
  assert.equal(docState, context.documentState);
});

test('pipeline passes branchState.presentation to renderSelectionShells', () => {
  const presentation = { summaryText: 'custom', mode: 'multiple' };
  const context = makeContext();
  const deps = makeResolvedDeps({ presentation });

  runPropertyPanelRenderPipeline(context, deps);

  const [, summary, details, pres] = deps.calls[2];
  assert.equal(summary, context.summary);
  assert.equal(details, context.details);
  assert.equal(pres, presentation);
});

test('pipeline passes context and branchState to executeBranch', () => {
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps);

  const [, ctx, bs] = deps.calls[3];
  assert.equal(ctx, context);
  assert.equal(bs.kind, 'active');
});

test('pipeline passes rawDeps as third argument to executeBranch', () => {
  const rawDeps = { customDep: () => 'custom' };
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps, rawDeps);

  const [, , , passedRawDeps] = deps.calls[3];
  assert.equal(passedRawDeps, rawDeps);
});

test('pipeline defaults rawDeps to empty object when third argument omitted', () => {
  const context = makeContext();
  const deps = makeResolvedDeps();

  runPropertyPanelRenderPipeline(context, deps);

  const [, , , passedRawDeps] = deps.calls[3];
  assert.deepEqual(passedRawDeps, {});
});

test('pipeline returns executeBranch result unchanged', () => {
  const executionResult = { rendered: false, kind: 'missing' };
  const context = makeContext();
  const deps = makeResolvedDeps({ executionResult });

  const result = runPropertyPanelRenderPipeline(context, deps);

  assert.deepEqual(result, executionResult);
});
