import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPropertyPanelPatch,
  shouldPromoteImportedColorSource,
} from '../ui/property_panel_patch_helpers.js';

test('buildPropertyPanelPatch preserves common property coercion', () => {
  const entity = {
    type: 'line',
    lineWeight: 0.25,
    lineTypeScale: 2,
    start: { x: 1, y: 2 },
    end: { x: 3, y: 4 },
  };

  assert.deepEqual(buildPropertyPanelPatch(entity, 'visible', 'yes'), { visible: true });
  assert.deepEqual(buildPropertyPanelPatch(entity, 'lineType', ' hidden2 '), { lineType: 'HIDDEN2' });
  assert.deepEqual(
    buildPropertyPanelPatch(entity, 'lineWeight', '-1'),
    { lineWeight: 0, lineWeightSource: 'EXPLICIT' },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(entity, 'lineTypeScale', '0.5'),
    { lineTypeScale: 0.5, lineTypeScaleSource: 'EXPLICIT' },
  );
});

test('buildPropertyPanelPatch preserves line and polyline geometry editing semantics', () => {
  const line = {
    type: 'line',
    start: { x: 1, y: 2 },
    end: { x: 3, y: 4 },
  };
  const polyline = {
    type: 'polyline',
    closed: false,
  };

  assert.deepEqual(
    buildPropertyPanelPatch(line, 'start.x', '11'),
    { start: { x: 11, y: 2 }, end: { x: 3, y: 4 } },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(line, 'end.y', '14'),
    { start: { x: 1, y: 2 }, end: { x: 3, y: 14 } },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(polyline, 'closed', 'true'),
    { closed: true },
  );
});

test('buildPropertyPanelPatch preserves circle and arc clamping semantics', () => {
  const circle = {
    type: 'circle',
    center: { x: 5, y: 6 },
    radius: 7,
  };
  const arc = {
    type: 'arc',
    center: { x: 8, y: 9 },
    radius: 10,
    startAngle: 0.25,
    endAngle: 1.25,
  };

  assert.deepEqual(
    buildPropertyPanelPatch(circle, 'radius', '-9'),
    { center: { x: 5, y: 6 }, radius: 0.001 },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(arc, 'startAngle', '3.14'),
    { center: { x: 8, y: 9 }, startAngle: 3.14 },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(arc, 'endAngle', '6.28'),
    { center: { x: 8, y: 9 }, endAngle: 6.28 },
  );
});

test('buildPropertyPanelPatch preserves text editing semantics', () => {
  const text = {
    type: 'text',
    position: { x: 10, y: 20 },
    value: 'TEXT',
    height: 2.5,
    rotation: 0,
  };

  assert.deepEqual(
    buildPropertyPanelPatch(text, 'value', 'UPDATED'),
    { position: { x: 10, y: 20 }, value: 'UPDATED' },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(text, 'height', '-3'),
    { position: { x: 10, y: 20 }, height: 0.1 },
  );
  assert.deepEqual(
    buildPropertyPanelPatch(text, 'position.y', '42'),
    { position: { x: 10, y: 42 } },
  );
});

test('shouldPromoteImportedColorSource preserves BYBLOCK and INDEX detection', () => {
  assert.equal(
    shouldPromoteImportedColorSource([
      { colorSource: 'BYLAYER' },
      { colorSource: 'INDEX' },
    ]),
    true,
  );
  assert.equal(
    shouldPromoteImportedColorSource([
      { colorSource: ' truecolor ' },
      { colorSource: 'BYLAYER' },
    ]),
    false,
  );
});
