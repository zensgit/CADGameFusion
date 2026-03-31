import test from "node:test";
import assert from "node:assert/strict";

import {
  CADGF_ENTITY_TYPES,
  buildCadgfDocumentFocusRegion,
  buildCadgfDocumentLinePreview,
} from "../document_preview_fallback.js";

test("buildCadgfDocumentLinePreview converts common 2D entities into line segments", () => {
  const preview = buildCadgfDocumentLinePreview({
    entities: [
      { id: 1, type: CADGF_ENTITY_TYPES.LINE, layer_id: 1, line: [[0, 0], [10, 0]] },
      { id: 2, type: CADGF_ENTITY_TYPES.POLYLINE, layer_id: 1, polyline: [[0, 0], [0, 5], [5, 5]] },
      { id: 3, type: CADGF_ENTITY_TYPES.ARC, layer_id: 2, arc: { c: [0, 0], r: 5, a0: 0, a1: Math.PI / 2, cw: 0 } },
      { id: 4, type: CADGF_ENTITY_TYPES.CIRCLE, layer_id: 2, circle: { c: [10, 10], r: 2 } },
      { id: 5, type: CADGF_ENTITY_TYPES.ELLIPSE, layer_id: 3, ellipse: { c: [20, 20], rx: 3, ry: 1.5, rot: 0, a0: 0, a1: Math.PI } },
      { id: 6, type: CADGF_ENTITY_TYPES.POINT, layer_id: 4, point: [30, 30] },
      { id: 7, type: CADGF_ENTITY_TYPES.TEXT, layer_id: 5, text: { pos: [40, 40], value: "ignored" } },
    ],
  });

  assert.ok(preview.segmentCount > 10);
  assert.equal(preview.renderableEntityCount, 6);
  assert.equal(preview.slices.length, 6);
  assert.deepEqual(preview.slices.map((slice) => slice.id), [1, 2, 3, 4, 5, 6]);
  assert.ok(preview.positions.length > 0);
  assert.ok(preview.indices.length > 0);
  assert.ok(preview.bounds);
  assert.equal(preview.bounds.minX, 0);
  assert.equal(preview.bounds.minY, 0);
  assert.ok(preview.bounds.maxX >= 30);
  assert.ok(preview.bounds.maxY >= 30);
});

test("buildCadgfDocumentLinePreview returns empty output for metadata-only documents", () => {
  const preview = buildCadgfDocumentLinePreview({
    entities: [
      { id: 1, type: CADGF_ENTITY_TYPES.TEXT, text: { pos: [0, 0], value: "text-only" } },
      { id: 2, type: CADGF_ENTITY_TYPES.SPLINE },
    ],
  });

  assert.equal(preview.segmentCount, 0);
  assert.equal(preview.renderableEntityCount, 0);
  assert.deepEqual(preview.positions, []);
  assert.deepEqual(preview.indices, []);
  assert.equal(preview.bounds, null);
});

test("buildCadgfDocumentFocusRegion prefers dense interior geometry over a sparse border", () => {
  const preview = buildCadgfDocumentLinePreview({
    entities: [
      {
        id: 1,
        type: CADGF_ENTITY_TYPES.POLYLINE,
        layer_id: 1,
        closed: true,
        polyline: [[0, 0], [220, 0], [220, 140], [0, 140]],
      },
      ...Array.from({ length: 18 }, (_, index) => ({
        id: 100 + index,
        type: CADGF_ENTITY_TYPES.LINE,
        layer_id: 2,
        line: [[60 + index * 3, 24], [60 + index * 3, 88]],
      })),
      ...Array.from({ length: 10 }, (_, index) => ({
        id: 200 + index,
        type: CADGF_ENTITY_TYPES.LINE,
        layer_id: 2,
        line: [[46, 28 + index * 6], [160, 28 + index * 6]],
      })),
      {
        id: 300,
        type: CADGF_ENTITY_TYPES.LINE,
        layer_id: 3,
        line: [[110, 0], [110, 140]],
      },
    ],
  });

  const focusRegion = buildCadgfDocumentFocusRegion(preview);
  assert.ok(focusRegion);
  assert.equal(focusRegion.strategy, "density-cluster");
  assert.ok(focusRegion.coverageRatio < 0.5);
  assert.ok(focusRegion.bounds.minX > 30);
  assert.ok(focusRegion.bounds.maxX < 180);
  assert.ok(focusRegion.bounds.minY < 30);
  assert.ok(focusRegion.bounds.maxY < 110);
});
