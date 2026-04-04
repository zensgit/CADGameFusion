import {
  classifyInsertSelectionScope,
  isDirectEditableSourceTextEntity,
  isInsertGroupEntity,
  listEditableInsertTextMembers,
  listInsertGroupTextMembers,
  resolveSourceTextGuide,
  resolveReleasedInsertArchive,
  summarizeReleasedInsertGroupMembers,
  summarizeInsertGroupMembers,
  summarizeInsertPeerInstances,
  summarizeReleasedInsertPeerInstances,
  summarizeSourceGroupMembers,
} from '../insert_group.js';
import { isReadOnlySelectionEntity } from './selection_meta_helpers.js';
import { formatPeerTarget } from './selection_display_helpers.js';

function idsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function hasSourceTextPlacement(entity) {
  return isDirectEditableSourceTextEntity(entity)
    && entity?.sourceTextPos
    && Number.isFinite(entity.sourceTextPos.x)
    && Number.isFinite(entity.sourceTextPos.y)
    && Number.isFinite(entity.sourceTextRotation);
}

function buildPeerTargets(peerSummary) {
  if (!peerSummary || !Array.isArray(peerSummary.peers)) return [];
  return peerSummary.peers.map((peer, index) => ({
    index,
    peer,
    target: formatPeerTarget(peer, index),
    isCurrent: index === peerSummary.currentIndex,
  }));
}

export function buildSelectionActionContext(entity, selectionIds = [], options = {}) {
  if (!entity) {
    return {
      selectionIds: [],
      sourceGroup: null,
      insertGroup: null,
      releasedInsert: null,
    };
  }

  const listEntities = typeof options.listEntities === 'function' ? options.listEntities : null;
  const entities = listEntities ? listEntities() : [];
  const normalizedSelectionIds = Array.isArray(selectionIds) ? selectionIds.filter(Number.isFinite) : [];

  const sourceGroupSummary = summarizeSourceGroupMembers(entities, entity, { isReadOnly: isReadOnlySelectionEntity });
  const sourceTextGuide = resolveSourceTextGuide(entities, entity);
  const sourceTextIds = sourceGroupSummary
    ? sourceGroupSummary.members.filter((member) => member?.type === 'text').map((member) => member.id)
    : [];
  const resettableTextIds = sourceGroupSummary
    ? sourceGroupSummary.members.filter((member) => hasSourceTextPlacement(member)).map((member) => member.id)
    : [];

  const insertGroupSummary = isInsertGroupEntity(entity)
    ? summarizeInsertGroupMembers(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const insertPeerSummary = insertGroupSummary
    ? summarizeInsertPeerInstances(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const insertPeerTargets = buildPeerTargets(insertPeerSummary);
  const insertTextIds = insertGroupSummary
    ? listInsertGroupTextMembers(insertGroupSummary.members, entity).map((member) => member.id)
    : [];
  const editableInsertTextIds = insertGroupSummary
    ? listEditableInsertTextMembers(insertGroupSummary.members, entity).map((member) => member.id)
    : [];
  const insertPeerScope = insertGroupSummary
    ? classifyInsertSelectionScope(entity, normalizedSelectionIds, insertGroupSummary)
    : '';
  const insertPeerNavigableSelection = insertPeerScope === 'single'
    || insertPeerScope === 'full'
    || insertPeerScope === 'editable'
    || insertPeerScope === 'text'
    || insertPeerScope === 'editable-text';

  const releasedInsertArchive = resolveReleasedInsertArchive(entity);
  const releasedInsertGroupSummary = releasedInsertArchive
    ? summarizeReleasedInsertGroupMembers(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const releasedInsertPeerSummary = releasedInsertArchive
    ? summarizeReleasedInsertPeerInstances(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const releasedInsertPeerTargets = buildPeerTargets(releasedInsertPeerSummary);

  return {
    selectionIds: normalizedSelectionIds,
    sourceGroup: sourceGroupSummary
      ? {
        summary: sourceGroupSummary,
        sourceTextGuide,
        textIds: sourceTextIds,
        textMemberCount: sourceTextIds.length,
        resettableTextIds,
        resettableTextMemberCount: resettableTextIds.length,
        selectionMatchesGroup: idsEqual(normalizedSelectionIds, sourceGroupSummary.memberIds),
        selectionMatchesText: idsEqual(normalizedSelectionIds, sourceTextIds),
      }
      : null,
    insertGroup: insertGroupSummary
      ? {
        summary: insertGroupSummary,
        peerSummary: insertPeerSummary,
        peerTargets: insertPeerTargets,
        textIds: insertTextIds,
        textMemberCount: insertTextIds.length,
        editableTextIds: editableInsertTextIds,
        editableTextMemberCount: editableInsertTextIds.length,
        peerScope: insertPeerScope,
        peerNavigableSelection: insertPeerNavigableSelection,
        selectionMatchesGroup: idsEqual(normalizedSelectionIds, insertGroupSummary.memberIds),
        selectionMatchesText: idsEqual(normalizedSelectionIds, insertTextIds),
        selectionMatchesEditableText: idsEqual(normalizedSelectionIds, editableInsertTextIds),
        selectionMatchesEditableMembers: idsEqual(normalizedSelectionIds, insertGroupSummary.editableIds),
      }
      : null,
    releasedInsert: releasedInsertArchive
      ? {
        archive: releasedInsertArchive,
        groupSummary: releasedInsertGroupSummary,
        peerSummary: releasedInsertPeerSummary,
        peerTargets: releasedInsertPeerTargets,
        selectionMatchesGroup: idsEqual(normalizedSelectionIds, releasedInsertGroupSummary?.memberIds || []),
      }
      : null,
  };
}
