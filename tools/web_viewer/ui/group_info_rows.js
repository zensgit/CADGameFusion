import {
  computeInsertGroupBounds,
  computeSourceGroupBounds,
  isInsertGroupEntity,
  isSourceGroupEntity,
} from '../insert_group.js';
import {
  formatCompactNumber,
  formatPoint,
  normalizeText,
} from './selection_display_helpers.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';

function pushRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({
    key,
    label,
    value: String(value),
  });
}

function formatSourceGroup(entity) {
  const sourceType = normalizeText(entity?.sourceType).toUpperCase();
  const proxyKind = normalizeText(entity?.proxyKind);
  return [sourceType, proxyKind].filter(Boolean).join(' / ');
}

function resolveEntities(listEntities) {
  if (typeof listEntities !== 'function') return [];
  const entities = listEntities();
  return Array.isArray(entities) ? entities.filter(Boolean) : [];
}

function resolveSourceGroupBounds(entity, listEntities) {
  if (!isSourceGroupEntity(entity)) return null;
  const entities = resolveEntities(listEntities);
  if (entities.length === 0) return null;
  return computeSourceGroupBounds(entities, entity);
}

function resolveInsertGroupBounds(entity, listEntities) {
  if (!isInsertGroupEntity(entity)) return null;
  const entities = resolveEntities(listEntities);
  if (entities.length === 0) return null;
  return computeInsertGroupBounds(entities, entity);
}

function appendIdentityRows(rows, entity, { includeGroupSource = true, includeBlockName = false } = {}) {
  if (Number.isFinite(entity?.groupId)) {
    pushRow(rows, 'group-id', 'Group ID', String(Math.trunc(entity.groupId)));
  }
  if (includeGroupSource) {
    pushRow(rows, 'group-source', 'Group Source', formatSourceGroup(entity));
  }
  if (
    Number.isFinite(entity?.sourceBundleId)
    && (!Number.isFinite(entity?.groupId) || Math.trunc(entity.sourceBundleId) !== Math.trunc(entity.groupId))
  ) {
    pushRow(rows, 'source-bundle-id', 'Source Bundle ID', String(Math.trunc(entity.sourceBundleId)));
  }
  if (includeBlockName) {
    pushRow(rows, 'block-name', 'Block Name', normalizeText(entity?.blockName));
  }
}

function appendMemberRows(rows, groupSummary, {
  memberLabel = 'Source Group Members',
  memberKey = 'source-group-members',
} = {}) {
  if (Array.isArray(groupSummary?.memberIds) && groupSummary.memberIds.length > 0) {
    pushRow(rows, memberKey, memberLabel, String(groupSummary.memberIds.length));
  }
  if (Array.isArray(groupSummary?.readOnlyIds) && groupSummary.readOnlyIds.length > 0) {
    pushRow(rows, 'editable-members', 'Editable Members', String(groupSummary.editableIds.length));
    pushRow(rows, 'read-only-members', 'Read-only Members', String(groupSummary.readOnlyIds.length));
  }
}

function appendBoundsRows(rows, groupBounds) {
  if (!groupBounds) return;
  pushRow(rows, 'group-center', 'Group Center', formatPoint(groupBounds.center));
  pushRow(rows, 'group-size', 'Group Size', `${formatCompactNumber(groupBounds.width)} x ${formatCompactNumber(groupBounds.height)}`);
  pushRow(
    rows,
    'group-bounds',
    'Group Bounds',
    `${formatCompactNumber(groupBounds.minX)}, ${formatCompactNumber(groupBounds.minY)} -> ${formatCompactNumber(groupBounds.maxX)}, ${formatCompactNumber(groupBounds.maxY)}`,
  );
}

function appendPeerRows(rows, peerSummary) {
  buildPeerSummaryRows(rows, peerSummary);
}

export function buildSourceGroupInfoRows(entity, sourceGroupSummary, {
  listEntities = null,
  includeIdentityRows = true,
} = {}) {
  if (!entity || !sourceGroupSummary) return [];
  const rows = [];
  if (includeIdentityRows) {
    appendIdentityRows(rows, entity, { includeGroupSource: true, includeBlockName: false });
  }
  appendMemberRows(rows, sourceGroupSummary, {
    memberLabel: 'Source Group Members',
    memberKey: 'source-group-members',
  });
  appendBoundsRows(rows, resolveSourceGroupBounds(entity, listEntities));
  return rows;
}

export function buildInsertGroupInfoRows(entity, insertGroupSummary, {
  listEntities = null,
  peerSummary = null,
  includeIdentityRows = true,
  includeBlockName = true,
  includeBounds = true,
} = {}) {
  if (!entity || !insertGroupSummary) return [];
  const rows = [];
  if (includeIdentityRows) {
    appendIdentityRows(rows, entity, { includeGroupSource: true, includeBlockName });
  }
  appendMemberRows(rows, insertGroupSummary, {
    memberLabel: 'Insert Group Members',
    memberKey: 'insert-group-members',
  });
  if (includeBounds) {
    appendBoundsRows(rows, resolveInsertGroupBounds(entity, listEntities));
  }
  appendPeerRows(rows, peerSummary);
  return rows;
}
