import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSelectionActionContext } from '../ui/selection_action_context.js';

test('null entity returns empty context', () => {
  const ctx = buildSelectionActionContext(null);
  assert.deepEqual(ctx.selectionIds, []);
  assert.equal(ctx.sourceGroup, null);
  assert.equal(ctx.insertGroup, null);
  assert.equal(ctx.releasedInsert, null);
});

test('plain entity without groups returns null groups', () => {
  const entity = { id: 1, type: 'line' };
  const ctx = buildSelectionActionContext(entity, [1], { listEntities: () => [entity] });
  assert.deepEqual(ctx.selectionIds, [1]);
  assert.equal(ctx.sourceGroup, null);
  assert.equal(ctx.insertGroup, null);
  assert.equal(ctx.releasedInsert, null);
});

test('source-group entity populates sourceGroup with summary and selectionMatches', () => {
  const text = { id: 1, type: 'text', groupId: 100, sourceType: 'DIMENSION', proxyKind: 'text', editMode: 'proxy' };
  const line = { id: 2, type: 'line', groupId: 100 };
  const entities = [text, line];
  const ctx = buildSelectionActionContext(text, [1, 2], { listEntities: () => entities });

  assert.ok(ctx.sourceGroup);
  assert.ok(ctx.sourceGroup.summary);
  assert.equal(ctx.sourceGroup.textMemberCount, 1);
  assert.ok(Array.isArray(ctx.sourceGroup.textIds));
  assert.ok(Array.isArray(ctx.sourceGroup.resettableTextIds));
  assert.equal(typeof ctx.sourceGroup.selectionMatchesGroup, 'boolean');
  assert.equal(typeof ctx.sourceGroup.selectionMatchesText, 'boolean');
});

test('insert-group entity populates insertGroup with peerTargets and scope', () => {
  const proxy = { id: 1, type: 'line', groupId: 200, sourceType: 'INSERT', proxyKind: 'fragment', editMode: 'proxy', readOnly: true };
  const editable = { id: 2, type: 'line', groupId: 200, sourceType: 'INSERT' };
  const entities = [proxy, editable];
  const ctx = buildSelectionActionContext(proxy, [1, 2], { listEntities: () => entities });

  assert.ok(ctx.insertGroup);
  assert.ok(ctx.insertGroup.summary);
  assert.ok(Array.isArray(ctx.insertGroup.peerTargets));
  assert.equal(typeof ctx.insertGroup.peerScope, 'string');
  assert.equal(typeof ctx.insertGroup.peerNavigableSelection, 'boolean');
  assert.equal(typeof ctx.insertGroup.selectionMatchesGroup, 'boolean');
  assert.equal(typeof ctx.insertGroup.selectionMatchesText, 'boolean');
  assert.equal(typeof ctx.insertGroup.selectionMatchesEditableText, 'boolean');
  assert.equal(typeof ctx.insertGroup.selectionMatchesEditableMembers, 'boolean');
});

test('released insert entity populates releasedInsert with archive and peerTargets', () => {
  const archive = { sourceType: 'INSERT', proxyKind: 'fragment', groupId: 700, blockName: 'TITLEBLOCK' };
  const entity = { id: 1, type: 'line', releasedInsertArchive: archive };
  const ctx = buildSelectionActionContext(entity, [1], { listEntities: () => [entity] });

  assert.ok(ctx.releasedInsert);
  assert.equal(ctx.releasedInsert.archive, archive);
  assert.ok(Array.isArray(ctx.releasedInsert.peerTargets));
  assert.equal(typeof ctx.releasedInsert.selectionMatchesGroup, 'boolean');
});

test('selectionIds filters non-finite values', () => {
  const entity = { id: 1, type: 'line' };
  const ctx = buildSelectionActionContext(entity, [1, null, NaN, 'bad', 2], { listEntities: () => [entity] });
  assert.deepEqual(ctx.selectionIds, [1, 2]);
});
