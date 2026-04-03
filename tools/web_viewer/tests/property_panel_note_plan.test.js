import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelNotePlan } from '../ui/property_panel_note_plan.js';

function makeLayer(overrides = {}) {
  return { id: 1, name: 'L1', locked: false, ...overrides };
}

function makeOptions(layers = []) {
  const layerMap = new Map(layers.map((l) => [l.id, l]));
  return { getLayer: (id) => layerMap.get(id) || null };
}

test('fully read-only single source-text proxy enables direct source-text edit', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'DIMENSION', proxyKind: 'text',
    editMode: 'proxy', readOnly: true, layerId: 1,
  };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer()]));

  assert.equal(plan.readOnly.blocksFurtherEditing, true);
  assert.equal(plan.readOnly.allowDirectSourceTextEditing, true);
  assert.equal(plan.readOnly.allowDirectInsertTextEditing, false);
  assert.ok(plan.readOnly.text.includes('source text proxy'));
});

test('fully read-only single insert text proxy enables direct insert-text edit', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'INSERT', proxyKind: 'text',
    editMode: 'proxy', readOnly: true, layerId: 1,
    attributeLockPosition: false,
  };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer()]));

  assert.equal(plan.readOnly.blocksFurtherEditing, true);
  assert.equal(plan.readOnly.allowDirectInsertTextEditing, true);
  assert.equal(plan.readOnly.allowInsertTextPositionEditing, true);
  assert.equal(plan.readOnly.allowDirectSourceTextEditing, false);
});

test('fully read-only lock-positioned insert text proxy keeps position editing disabled', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'INSERT', proxyKind: 'text',
    editMode: 'proxy', readOnly: true, layerId: 1,
    attributeLockPosition: true,
  };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer()]));

  assert.equal(plan.readOnly.allowDirectInsertTextEditing, true);
  assert.equal(plan.readOnly.allowInsertTextPositionEditing, false);
});

test('fully locked selection sets locked blocksFurtherEditing', () => {
  const entity = { id: 1, type: 'line', layerId: 1 };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer({ locked: true })]));

  assert.equal(plan.locked.blocksFurtherEditing, true);
  assert.ok(plan.locked.text.includes('locked layer'));
});

test('mixed read-only / editable keeps note text but does not block all editing', () => {
  const e1 = { id: 1, type: 'line', readOnly: true, layerId: 1 };
  const e2 = { id: 2, type: 'line', layerId: 1 };
  const plan = buildPropertyPanelNotePlan([e1, e2], e1, makeOptions([makeLayer()]));

  assert.equal(plan.readOnly.blocksFurtherEditing, false);
  assert.ok(plan.readOnly.text.includes('read-only'));
  assert.equal(plan.readOnly.allowDirectSourceTextEditing, false);
  assert.equal(plan.readOnly.allowDirectInsertTextEditing, false);
});

test('empty entities returns empty note texts and no blocking', () => {
  const plan = buildPropertyPanelNotePlan([], null, makeOptions([makeLayer()]));

  assert.equal(plan.readOnly.text, '');
  assert.equal(plan.readOnly.blocksFurtherEditing, false);
  assert.equal(plan.locked.text, '');
  assert.equal(plan.locked.blocksFurtherEditing, false);
  assert.equal(plan.releasedInsert.text, '');
});

test('released insert archive populates releasedInsert.text', () => {
  const archive = { sourceType: 'INSERT', proxyKind: 'fragment', textKind: 'ATTDEF' };
  const entity = { id: 1, type: 'text', releasedInsertArchive: archive, layerId: 1 };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer()]));

  assert.ok(plan.releasedInsert.text.includes('released from imported'));
});

test('source text on locked layer disables direct source text editing', () => {
  const entity = {
    id: 1, type: 'text', sourceType: 'DIMENSION', proxyKind: 'text',
    editMode: 'proxy', readOnly: true, layerId: 1,
  };
  const plan = buildPropertyPanelNotePlan([entity], entity, makeOptions([makeLayer({ locked: true })]));

  assert.equal(plan.readOnly.allowDirectSourceTextEditing, false);
  assert.equal(plan.locked.blocksFurtherEditing, true);
});
