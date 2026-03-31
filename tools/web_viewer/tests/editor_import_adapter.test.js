import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentState } from '../state/documentState.js';
import { SelectionState } from '../state/selectionState.js';
import { SnapState } from '../state/snapState.js';
import { ViewState } from '../state/viewState.js';
import {
  adaptConvertCliDocument,
  applyResolvedEditorImport,
  isConvertCliDocument,
  resolveEditorImportPayload,
} from '../adapters/editor_import_adapter.js';
import { hydrateDocument } from '../adapters/document_json_adapter.js';

test('resolveEditorImportPayload adapts convert_cli payloads into editor snapshots', () => {
  const payload = {
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 2,
        layer_id: 0,
        color: 0xffffff,
        color_source: 'BYLAYER',
        line_type: 'HIDDEN2',
        line_weight: 0.35,
        line_type_scale: 1.7,
        line: [[0, 0], [10, 0]],
      },
    ],
  };

  assert.equal(isConvertCliDocument(payload), true);
  const adapted = adaptConvertCliDocument(payload);
  assert.equal(adapted.entities[0].type, 'line');
  assert.deepEqual(adapted.entities[0].start, { x: 0, y: 0 });
  assert.deepEqual(adapted.entities[0].end, { x: 10, y: 0 });

  const resolved = resolveEditorImportPayload(payload);
  assert.equal(resolved.kind, 'convert-cli');
  assert.equal(resolved.docSnapshot.entities[0].type, 'line');

  const document = new DocumentState();
  document.restore(resolved.docSnapshot);
  const entity = document.getEntity(1);
  assert.equal(entity?.type, 'line');
  assert.equal(entity?.lineType, 'HIDDEN2');
  assert.equal(entity?.lineWeight, 0.35);
  assert.equal(entity?.lineTypeScale, 1.7);
});

test('applyResolvedEditorImport aligns current space/layout to imported external content', () => {
  const payload = {
    cadgf_version: '1.0.0',
    schema_version: 1,
    feature_flags: {},
    metadata: {
      label: 'paper-only',
      author: '',
      company: '',
      comment: '',
      created_at: '',
      modified_at: '',
      unit_name: 'mm',
      meta: {},
    },
    settings: { unit_scale: 1 },
    layers: [
      { id: 1, name: 'PLOT', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 7,
        type: 2,
        layer_id: 1,
        color: 0xffffff,
        color_source: 'BYLAYER',
        space: 1,
        layout: 'Layout-A',
        line: [[-24, 6], [24, 6]],
      },
    ],
  };

  const resolved = resolveEditorImportPayload(payload);
  const document = new DocumentState();
  applyResolvedEditorImport(document, resolved, null, null, null, { silent: true });

  assert.deepEqual(document.getCurrentSpaceContext(), { space: 1, layout: 'Layout-A' });
  assert.deepEqual(document.listVisibleEntities().map((entity) => entity.id), [7]);
});

test('applyResolvedEditorImport restores editor envelopes and state payloads', () => {
  const payload = {
    schema: 'vemcad-web-2d-v1',
    document: {
      nextEntityId: 2,
      nextLayerId: 1,
      nextConstraintId: 1,
      layers: [
        { id: 0, name: '0', visible: true, locked: false, printable: true, frozen: false, construction: false, color: '#ffffff' },
      ],
      entities: [
        {
          id: 1,
          type: 'line',
          layerId: 0,
          visible: true,
          color: '#ffffff',
          start: { x: 0, y: 0 },
          end: { x: 5, y: 0 },
        },
      ],
      constraints: [],
      meta: {
        label: '',
        author: '',
        comment: '',
        unit: 'mm',
        schema: 'vemcad-web-2d-v1',
        currentSpace: 1,
        currentLayout: 'Layout-A',
      },
    },
    selection: {
      entityIds: [1],
      primaryId: 1,
      boxSelectEnabled: false,
    },
    snap: {
      endpoint: true,
      midpoint: false,
      snapRadiusPx: 20,
    },
    view: {
      zoom: 2,
      pan: { x: 10, y: 20 },
      showGrid: true,
    },
  };

  const resolved = resolveEditorImportPayload(payload);
  const document = new DocumentState();
  const selection = new SelectionState();
  const snap = new SnapState();
  const view = new ViewState();

  applyResolvedEditorImport(document, resolved, selection, snap, view);

  assert.equal(document.getEntity(1)?.type, 'line');
  assert.deepEqual(selection.entityIds, [1]);
  assert.equal(selection.primaryId, 1);
  assert.equal(selection.boxSelectEnabled, false);
  assert.equal(snap.options.midpoint, false);
  assert.equal(snap.options.snapRadiusPx, 20);
  assert.equal(view.zoom, 2);
  assert.deepEqual(view.pan, { x: 10, y: 20 });
  assert.equal(view.showGrid, true);
});

test('hydrateDocument normalizes convert_cli payloads before restore', () => {
  const payload = {
    layers: [
      { id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0, printable: 1, frozen: 0, construction: 0 },
    ],
    entities: [
      {
        id: 1,
        type: 7,
        layer_id: 0,
        color: 0xffffff,
        text: { pos: [3, 4], h: 2.5, rot: 0, value: 'NOTE' },
      },
    ],
  };

  const document = new DocumentState();
  hydrateDocument(document, payload);

  const entity = document.getEntity(1);
  assert.equal(entity?.type, 'text');
  assert.deepEqual(entity?.position, { x: 3, y: 4 });
  assert.equal(entity?.value, 'NOTE');
});

test('DocumentState.restore rejects raw CADGF and convert_cli payloads', () => {
  const document = new DocumentState();

  assert.throws(() => {
    document.restore({
      cadgf_version: '1.0.0',
      schema_version: 1,
      layers: [],
      entities: [],
      metadata: {},
      settings: {},
      feature_flags: {},
    });
  }, /editor snapshot payload/);

  assert.throws(() => {
    document.restore({
      layers: [{ id: 0, name: '0', color: 0xffffff, visible: 1, locked: 0 }],
      entities: [{ id: 1, type: 2, line: [[0, 0], [1, 1]] }],
    });
  }, /editor snapshot payload/);
});
