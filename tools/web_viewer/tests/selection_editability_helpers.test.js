import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveLayer,
  supportsInsertTextPositionEditing,
} from '../ui/selection_editability_helpers.js';

test('supportsInsertTextPositionEditing returns true for unlocked editable insert text proxies', () => {
  assert.equal(
    supportsInsertTextPositionEditing({
      type: 'text',
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      attributeConstant: false,
      attributeLockPosition: false,
    }),
    true,
  );
});

test('supportsInsertTextPositionEditing returns false for lock-positioned insert text proxies', () => {
  assert.equal(
    supportsInsertTextPositionEditing({
      type: 'text',
      sourceType: 'INSERT',
      proxyKind: 'text',
      editMode: 'proxy',
      attributeConstant: false,
      attributeLockPosition: true,
    }),
    false,
  );
});

test('supportsInsertTextPositionEditing returns false for non-insert-text entities', () => {
  assert.equal(
    supportsInsertTextPositionEditing({
      type: 'line',
      attributeLockPosition: false,
    }),
    false,
  );
});

test('resolveLayer returns null when getter is missing or layerId is invalid', () => {
  assert.equal(resolveLayer(null, 1), null);
  assert.equal(resolveLayer(() => ({ id: 1 }), Number.NaN), null);
  assert.equal(resolveLayer(() => ({ id: 1 }), undefined), null);
});

test('resolveLayer returns null when getter result is not an object', () => {
  assert.equal(resolveLayer(() => 'L1', 1), null);
  assert.equal(resolveLayer(() => null, 1), null);
});

test('resolveLayer returns layer object for valid getter and layerId', () => {
  const layer = { id: 3, name: 'Notes', locked: true };
  assert.deepEqual(resolveLayer((id) => (id === 3 ? layer : null), 3), layer);
  assert.deepEqual(resolveLayer((id) => (id === 3 ? layer : null), 3.9), layer);
});
