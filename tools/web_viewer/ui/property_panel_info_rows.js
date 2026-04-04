import {
  buildPropertyMetadataFacts,
  formatReleasedInsertArchiveModes,
  formatReleasedInsertArchiveOrigin,
} from './selection_presenter.js';
import {
  computeInsertGroupBounds,
  computeSourceGroupBounds,
  isInsertGroupEntity,
  isSourceGroupEntity,
} from '../insert_group.js';
import {
  formatCompactNumber,
  formatPoint,
  formatPeerContext,
  formatPeerTarget,
} from './selection_display_helpers.js';

function pushInfo(rows, label, value, key = '') {
  if (value === null || value === undefined || value === '') return;
  rows.push({
    key,
    label,
    value: String(value),
  });
}

function formatSourceGroup(entity) {
  const sourceType = typeof entity?.sourceType === 'string' ? entity.sourceType.trim().toUpperCase() : '';
  const proxyKind = typeof entity?.proxyKind === 'string' ? entity.proxyKind.trim().toLowerCase() : '';
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

function buildGroupInfoRows(entity, groupSummary, {
  listEntities = null,
  memberLabel = 'Source Group Members',
  memberKey = 'source-group-members',
  includeBlockName = false,
  includePeers = false,
  peerSummary = null,
} = {}) {
  if (!entity || !groupSummary) return [];
  const rows = [];
  const groupBounds = includePeers
    ? resolveInsertGroupBounds(entity, listEntities)
    : resolveSourceGroupBounds(entity, listEntities);
  if (Number.isFinite(entity.groupId)) {
    pushInfo(rows, 'Group ID', String(Math.trunc(entity.groupId)), 'group-id');
  }
  pushInfo(rows, 'Group Source', formatSourceGroup(entity), 'group-source');
  if (Number.isFinite(entity.sourceBundleId)
    && (!Number.isFinite(entity.groupId) || Math.trunc(entity.sourceBundleId) !== Math.trunc(entity.groupId))) {
    pushInfo(rows, 'Source Bundle ID', String(Math.trunc(entity.sourceBundleId)), 'source-bundle-id');
  }
  if (includeBlockName) {
    pushInfo(rows, 'Block Name', entity.blockName, 'block-name');
  }
  if (Array.isArray(groupSummary.memberIds) && groupSummary.memberIds.length > 0) {
    pushInfo(rows, memberLabel, String(groupSummary.memberIds.length), memberKey);
  }
  if (Array.isArray(groupSummary.readOnlyIds) && groupSummary.readOnlyIds.length > 0) {
    pushInfo(rows, 'Editable Members', String(groupSummary.editableIds.length), 'editable-members');
    pushInfo(rows, 'Read-only Members', String(groupSummary.readOnlyIds.length), 'read-only-members');
  }
  if (groupBounds) {
    pushInfo(rows, 'Group Center', formatPoint(groupBounds.center), 'group-center');
    pushInfo(
      rows,
      'Group Size',
      `${formatCompactNumber(groupBounds.width)} x ${formatCompactNumber(groupBounds.height)}`,
      'group-size',
    );
    pushInfo(
      rows,
      'Group Bounds',
      `${formatCompactNumber(groupBounds.minX)}, ${formatCompactNumber(groupBounds.minY)} -> ${formatCompactNumber(groupBounds.maxX)}, ${formatCompactNumber(groupBounds.maxY)}`,
      'group-bounds',
    );
  }
  if (peerSummary?.peerCount > 1) {
    const currentIndex = peerSummary.currentIndex >= 0 ? peerSummary.currentIndex : 0;
    pushInfo(rows, 'Peer Instance', `${currentIndex + 1} / ${peerSummary.peerCount}`, 'peer-instance');
    pushInfo(rows, 'Peer Instances', String(peerSummary.peerCount), 'peer-instances');
    pushInfo(
      rows,
      'Peer Layouts',
      peerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | '),
      'peer-layouts',
    );
    pushInfo(
      rows,
      'Peer Targets',
      peerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | '),
      'peer-targets',
    );
  }
  return rows;
}

export function buildEntityMetadataInfoRows(entity, { getLayer = null, listEntities = null } = {}) {
  if (!entity) return [];
  return buildPropertyMetadataFacts(entity, { getLayer, listEntities });
}

export function buildReleasedInsertArchiveSelectionInfoRows(selectionSummary) {
  if (!selectionSummary?.archive) return [];
  const rows = [];
  const { archive, entityCount, peerSummary, commonModes } = selectionSummary;
  pushInfo(rows, 'Released From', formatReleasedInsertArchiveOrigin(archive), 'released-from');
  if (Number.isFinite(archive?.groupId)) {
    pushInfo(rows, 'Released Group ID', String(Math.trunc(archive.groupId)), 'released-group-id');
  }
  pushInfo(rows, 'Released Block Name', archive?.blockName, 'released-block-name');
  pushInfo(rows, 'Released Selection Members', String(entityCount), 'released-selection-members');
  pushInfo(rows, 'Released Text Kind', archive?.textKind, 'released-text-kind');
  pushInfo(rows, 'Released Attribute Tag', archive?.attributeTag, 'released-attribute-tag');
  pushInfo(rows, 'Released Attribute Default', archive?.attributeDefault, 'released-attribute-default');
  pushInfo(rows, 'Released Attribute Prompt', archive?.attributePrompt, 'released-attribute-prompt');
  if (Number.isFinite(archive?.attributeFlags)) {
    pushInfo(rows, 'Released Attribute Flags', String(Math.trunc(archive.attributeFlags)), 'released-attribute-flags');
  }
  pushInfo(
    rows,
    'Released Attribute Modes',
    commonModes || formatReleasedInsertArchiveModes(archive),
    'released-attribute-modes',
  );
  if (peerSummary?.peerCount > 1) {
    const peerInstance = peerSummary.currentIndex >= 0
      ? `${peerSummary.currentIndex + 1} / ${peerSummary.peerCount}`
      : `Archived / ${peerSummary.peerCount}`;
    pushInfo(rows, 'Released Peer Instance', peerInstance, 'released-peer-instance');
    pushInfo(rows, 'Released Peer Instances', String(peerSummary.peerCount), 'released-peer-instances');
    pushInfo(
      rows,
      'Released Peer Layouts',
      peerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | '),
      'released-peer-layouts',
    );
    pushInfo(
      rows,
      'Released Peer Targets',
      peerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | '),
      'released-peer-targets',
    );
  }
  return rows;
}

export function buildSourceGroupInfoRows(entity, sourceGroupSummary, { listEntities = null } = {}) {
  return buildGroupInfoRows(entity, sourceGroupSummary, { listEntities });
}

export function buildInsertGroupInfoRows(entity, insertGroupSummary, { listEntities = null, peerSummary = null } = {}) {
  return buildGroupInfoRows(entity, insertGroupSummary, {
    listEntities,
    memberLabel: 'Insert Group Members',
    memberKey: 'insert-group-members',
    includeBlockName: true,
    includePeers: true,
    peerSummary,
  });
}
