import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePropertyPanelActionBags } from '../ui/property_panel_action_bags.js';

test('resolvePropertyPanelActionBags groups legacy flat callbacks', () => {
  const callbacks = {
    focusLayer: () => 'focus',
    useLayer: () => 'use',
    selectSourceGroup: () => 'source-group',
    fitSourceGroup: () => 'fit-source',
    selectInsertGroup: () => 'insert-group',
    openInsertPeer: () => 'open-peer',
    fitReleasedInsertGroup: () => 'fit-released',
  };

  const actionBags = resolvePropertyPanelActionBags(callbacks);

  assert.equal(actionBags.layer.focusLayer, callbacks.focusLayer);
  assert.equal(actionBags.layer.useLayer, callbacks.useLayer);
  assert.equal(actionBags.sourceGroup.selectSourceGroup, callbacks.selectSourceGroup);
  assert.equal(actionBags.sourceGroup.fitSourceGroup, callbacks.fitSourceGroup);
  assert.equal(actionBags.insertGroup.selectInsertGroup, callbacks.selectInsertGroup);
  assert.equal(actionBags.insertGroup.openInsertPeer, callbacks.openInsertPeer);
  assert.equal(actionBags.insertGroup.fitReleasedInsertGroup, callbacks.fitReleasedInsertGroup);
});

test('resolvePropertyPanelActionBags prefers nested actionHandlers over legacy flat callbacks', () => {
  const legacyFocus = () => 'legacy-focus';
  const nestedFocus = () => 'nested-focus';
  const legacyInsert = () => 'legacy-insert';
  const nestedInsert = () => 'nested-insert';

  const actionBags = resolvePropertyPanelActionBags({
    actionHandlers: {
      layer: {
        focusLayer: nestedFocus,
      },
      insertGroup: {
        selectInsertGroup: nestedInsert,
      },
    },
    focusLayer: legacyFocus,
    selectInsertGroup: legacyInsert,
  });

  assert.equal(actionBags.layer.focusLayer, nestedFocus);
  assert.equal(actionBags.insertGroup.selectInsertGroup, nestedInsert);
});
