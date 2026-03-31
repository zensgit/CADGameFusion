import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPropertyPanel } from '../ui/property_panel_render.js';

test('renderPropertyPanel renders empty selection through current-layer defaults path', () => {
  const calls = [];
  const context = {
    form: { innerHTML: 'stale' },
    summary: { textContent: '' },
    details: { dataset: {} },
    selectionState: { kind: 'selection' },
    documentState: { kind: 'document' },
    controller: {
      renderCurrentLayerDefaults: () => calls.push(['defaults']),
    },
    glueFacade: {},
    selectionInfoHelpers: {},
    branchContextHelper: {},
    addReadonlyNote: () => calls.push(['readonly-note']),
  };

  const result = renderPropertyPanel(context, {
    resolvePropertyPanelSelectionContext: () => ({
      kind: 'empty',
      entities: [],
      primary: null,
      presentation: { summaryText: 'No selection', mode: 'empty' },
    }),
    renderPropertySelectionShells: (summary, details, presentation) => {
      summary.textContent = presentation.summaryText;
      details.dataset.mode = presentation.mode;
      calls.push(['shells', presentation.summaryText, presentation.mode]);
    },
    renderPropertyPanelActiveSelection: () => {
      throw new Error('should not render active selection');
    },
  });

  assert.equal(context.form.innerHTML, '');
  assert.equal(context.summary.textContent, 'No selection');
  assert.equal(context.details.dataset.mode, 'empty');
  assert.deepEqual(calls, [
    ['shells', 'No selection', 'empty'],
    ['defaults'],
  ]);
  assert.deepEqual(result, { rendered: true, kind: 'empty' });
});

test('renderPropertyPanel delegates active selection to renderPropertyPanelActiveSelection', () => {
  const activeResult = { rendered: true, blockedAt: null };
  const calls = [];
  const context = {
    form: { innerHTML: 'stale' },
    summary: { textContent: '' },
    details: { dataset: {} },
    selectionState: { kind: 'selection' },
    documentState: { kind: 'document' },
    controller: {
      renderCurrentLayerDefaults: () => calls.push(['defaults']),
    },
    glueFacade: { kind: 'glue' },
    selectionInfoHelpers: { kind: 'selectionInfo' },
    branchContextHelper: { kind: 'branchContext' },
    addReadonlyNote: () => calls.push(['readonly-note']),
  };

  const entity = { id: 1, type: 'line' };
  const result = renderPropertyPanel(context, {
    resolvePropertyPanelSelectionContext: () => ({
      kind: 'active',
      entities: [entity],
      primary: entity,
      presentation: { summaryText: '1 selected (line)', mode: 'single' },
    }),
    renderPropertySelectionShells: (summary, details, presentation) => {
      summary.textContent = presentation.summaryText;
      details.dataset.mode = presentation.mode;
      calls.push(['shells', presentation.summaryText, presentation.mode]);
    },
    buildPropertyPanelActiveSelectionInput: (inputContext, selectionContext) => {
      calls.push(['build-active', inputContext, selectionContext]);
      return {
        entities: selectionContext.entities,
        primary: selectionContext.primary,
        documentState: inputContext.documentState,
        controller: inputContext.controller,
        glueFacade: inputContext.glueFacade,
        selectionInfoHelpers: inputContext.selectionInfoHelpers,
        branchContextHelper: inputContext.branchContextHelper,
        addReadonlyNote: inputContext.addReadonlyNote,
      };
    },
    renderPropertyPanelActiveSelection: (payload) => {
      calls.push(['active', payload]);
      return activeResult;
    },
  });

  assert.equal(context.form.innerHTML, '');
  assert.equal(context.summary.textContent, '1 selected (line)');
  assert.equal(context.details.dataset.mode, 'single');
  assert.equal(calls[0][0], 'shells');
  assert.equal(calls[1][0], 'build-active');
  assert.equal(calls[2][0], 'active');
  assert.equal(calls[2][1].primary, entity);
  assert.equal(calls[2][1].glueFacade.kind, 'glue');
  assert.equal(calls[2][1].selectionInfoHelpers.kind, 'selectionInfo');
  assert.equal(calls[2][1].branchContextHelper.kind, 'branchContext');
  assert.deepEqual(result, activeResult);
});

test('renderPropertyPanel prefers addReadonlyNote from domBindings bag when present', () => {
  const readonlyFromBag = () => {};
  const readonlyLegacy = () => {};
  let observedReadonly = null;
  const entity = { id: 1, type: 'line' };
  const context = {
    form: { innerHTML: 'stale' },
    summary: { textContent: '' },
    details: { dataset: {} },
    domBindings: { addReadonlyNote: readonlyFromBag },
    selectionState: { kind: 'selection' },
    documentState: { kind: 'document' },
    controller: { renderCurrentLayerDefaults: () => {} },
    glueFacade: {},
    selectionInfoHelpers: {},
    branchContextHelper: {},
    addReadonlyNote: readonlyLegacy,
  };

  renderPropertyPanel(context, {
    resolvePropertyPanelSelectionContext: () => ({
      kind: 'active',
      entities: [entity],
      primary: entity,
      presentation: { summaryText: '1 selected (line)', mode: 'single' },
    }),
    renderPropertySelectionShells: () => {},
    renderPropertyPanelActiveSelection: (payload) => {
      observedReadonly = payload.addReadonlyNote;
      return { rendered: true, blockedAt: null };
    },
  });

  assert.equal(observedReadonly, readonlyFromBag);
  assert.notEqual(observedReadonly, readonlyLegacy);
});

test('renderPropertyPanel returns non-rendered for missing selection context without calling defaults or active render', () => {
  const calls = [];
  const context = {
    form: { innerHTML: 'stale' },
    summary: { textContent: '' },
    details: { dataset: {} },
    selectionState: {},
    documentState: {},
    controller: {
      renderCurrentLayerDefaults: () => calls.push(['defaults']),
    },
    glueFacade: {},
    selectionInfoHelpers: {},
    branchContextHelper: {},
    addReadonlyNote: () => calls.push(['readonly-note']),
  };

  const result = renderPropertyPanel(context, {
    resolvePropertyPanelSelectionContext: () => ({
      kind: 'missing',
      entities: [],
      primary: null,
      presentation: { summaryText: 'No selection', mode: 'empty' },
    }),
    renderPropertySelectionShells: () => calls.push(['shells']),
    renderPropertyPanelActiveSelection: () => {
      throw new Error('should not render active selection');
    },
  });

  assert.deepEqual(calls, [['shells']]);
  assert.deepEqual(result, { rendered: false, kind: 'missing' });
});
