import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import {
  classifyInsertSelectionScope,
  computeSourceGroupBounds,
  computeInsertGroupBounds,
  isDirectEditableInsertTextProxyEntity,
  isDirectEditableSourceTextEntity,
  isInsertGroupEntity,
  isInsertTextProxyEntity,
  isSourceGroupEntity,
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
import { formatSpaceLabel } from '../space_layout.js';
import {
  describeReadOnlySelectionEntity,
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerFlags,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
  listSelectionLayerFlags,
} from './selection_meta_helpers.js';
import { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';
export { formatSpaceLabel } from '../space_layout.js';
export { resolveReleasedInsertArchive } from '../insert_group.js';
export {
  describeReadOnlySelectionEntity,
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerFlags,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
  listSelectionLayerFlags,
} from './selection_meta_helpers.js';
export { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

function pushFact(facts, key, label, value, extra = {}) {
  if (value === null || value === undefined || value === '') return;
  facts.push({
    key,
    label,
    value: String(value),
    ...extra,
  });
}

function insertFactsAfterFirstKey(facts, keys, extraFacts) {
  if (!Array.isArray(facts) || !Array.isArray(extraFacts) || extraFacts.length === 0) return facts;
  const anchors = Array.isArray(keys) ? keys : [keys];
  const index = anchors.reduce((found, key) => {
    if (found >= 0) return found;
    return facts.findIndex((fact) => fact?.key === key);
  }, -1);
  if (index < 0) {
    facts.push(...extraFacts);
    return facts;
  }
  facts.splice(index + 1, 0, ...extraFacts);
  return facts;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  const text = Number(rounded).toFixed(3).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

function formatPoint(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return '';
  return `${formatCompactNumber(value.x)}, ${formatCompactNumber(value.y)}`;
}

function formatPeerContext(peer) {
  if (!peer) return '';
  const space = formatSpaceLabel(peer.space);
  const layout = normalizeText(peer.layout);
  return layout ? `${space} / ${layout}` : space;
}

function formatPeerTarget(peer, index) {
  const context = formatPeerContext(peer);
  if (!context) return '';
  return `${index + 1}: ${context}`;
}

function formatSourceGroup(entity) {
  const sourceType = normalizeText(entity?.sourceType);
  const proxyKind = normalizeText(entity?.proxyKind);
  return [sourceType, proxyKind].filter(Boolean).join(' / ');
}

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

export function supportsInsertTextPositionEditing(entity) {
  return isDirectEditableInsertTextProxyEntity(entity)
    && typeof entity?.attributeLockPosition === 'boolean'
    && entity.attributeLockPosition !== true;
}

import {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
export {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';

function formatAttributeModes(entity) {
  const hasAttributeMetadata = Number.isFinite(entity?.attributeFlags)
    || typeof entity?.attributeInvisible === 'boolean'
    || typeof entity?.attributeConstant === 'boolean'
    || typeof entity?.attributeVerify === 'boolean'
    || typeof entity?.attributePreset === 'boolean'
    || typeof entity?.attributeLockPosition === 'boolean';
  if (!hasAttributeMetadata) return '';
  const modes = [];
  if (entity?.attributeInvisible === true) modes.push('Invisible');
  if (entity?.attributeConstant === true) modes.push('Constant');
  if (entity?.attributeVerify === true) modes.push('Verify');
  if (entity?.attributePreset === true) modes.push('Preset');
  if (entity?.attributeLockPosition === true) modes.push('Lock Position');
  return modes.length > 0 ? modes.join(' / ') : 'None';
}

import { buildSelectionContract } from './selection_contract.js';
export { buildSelectionContract } from './selection_contract.js';

import { buildSelectionDetailFacts, buildMultiSelectionDetailFacts } from './selection_detail_facts.js';
export { buildSelectionDetailFacts } from './selection_detail_facts.js';

export function buildPropertyMetadataFacts(entity, options = {}) {
  if (!entity) return [];
  const facts = [...buildSelectionDetailFacts(entity, options)];

  const provenanceFacts = [];
  pushFact(provenanceFacts, 'source-type', 'Source Type', normalizeText(entity.sourceType));
  pushFact(provenanceFacts, 'edit-mode', 'Edit Mode', normalizeText(entity.editMode));
  pushFact(provenanceFacts, 'proxy-kind', 'Proxy Kind', normalizeText(entity.proxyKind));
  insertFactsAfterFirstKey(facts, 'entity-visibility', provenanceFacts);

  const hatchFacts = [];
  if (Number.isFinite(entity.hatchId)) {
    pushFact(hatchFacts, 'hatch-id', 'Hatch ID', String(Math.trunc(entity.hatchId)));
  }
  pushFact(hatchFacts, 'hatch-pattern', 'Hatch Pattern', normalizeText(entity.hatchPattern));
  insertFactsAfterFirstKey(facts, 'line-type-scale-source', hatchFacts);

  const dimFacts = [];
  if (Number.isFinite(entity.dimType)) {
    pushFact(dimFacts, 'dim-type', 'Dim Type', String(entity.dimType));
  }
  pushFact(dimFacts, 'dim-style', 'Dim Style', normalizeText(entity.dimStyle));
  insertFactsAfterFirstKey(facts, ['attribute-modes', 'released-attribute-modes'], dimFacts);

  const dimTextFacts = [];
  if (entity.dimTextPos && Number.isFinite(entity.dimTextPos.x) && Number.isFinite(entity.dimTextPos.y)) {
    pushFact(dimTextFacts, 'dim-text-pos', 'Dim Text Pos', formatPoint(entity.dimTextPos));
  }
  if (Number.isFinite(entity.dimTextRotation)) {
    pushFact(dimTextFacts, 'dim-text-rotation', 'Dim Text Rotation', formatCompactNumber(entity.dimTextRotation));
  }
  insertFactsAfterFirstKey(facts, ['current-offset', 'source-text-rotation', 'source-text-pos'], dimTextFacts);

  return facts;
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

export function buildPropertyPanelReadOnlyNote(entities, primary, actionContext = null) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0 || !primary) return '';
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  if (readOnlyCount <= 0) return '';

  const insertGroupSummary = actionContext?.insertGroup?.summary || null;
  const sourceGroupSummary = actionContext?.sourceGroup?.summary || null;
  const fullInsertGroupSelected = !!insertGroupSummary
    && insertGroupSummary.readOnlyIds.length > 0
    && actionContext?.insertGroup?.selectionMatchesGroup === true;
  const fullSourceGroupSelected = !insertGroupSummary
    && !!sourceGroupSummary
    && sourceGroupSummary.readOnlyIds.length > 0
    && actionContext?.sourceGroup?.selectionMatchesGroup === true;

  if (readOnlyCount === list.length) {
    if (list.length === 1) {
      if (isDirectEditableSourceTextEntity(primary)) {
        return `Selected entity is a read-only source text proxy (${describeReadOnlySelectionEntity(primary)}); text overrides stay editable while geometry remains proxy-only.`;
      }
      if (isDirectEditableInsertTextProxyEntity(primary)) {
        const positionClause = supportsInsertTextPositionEditing(primary)
          ? 'text position stays editable while instance geometry remains proxy-only'
          : (primary?.attributeLockPosition === true
          ? 'position stays lock-positioned until release'
          : 'instance geometry remains proxy-only');
        return String(primary?.textKind || '').trim().toLowerCase() === 'attdef'
          ? `Selected entity is a read-only INSERT ATTDEF text proxy (${describeReadOnlySelectionEntity(primary)}); default text stays editable while prompt remains read-only, ${positionClause}${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden until focused through insert text selection' : ''}.`
          : `Selected entity is a read-only INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); text value stays editable, ${positionClause}${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden until focused through insert text selection' : ''}.`;
      }
      if (isInsertTextProxyEntity(primary) && primary?.attributeConstant === true) {
        return `Selected entity is a read-only constant INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); constant attribute values stay importer-authored until release, instance geometry remains proxy-only${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden by default' : ''}.`;
      }
      if (isInsertTextProxyEntity(primary) && primary?.attributeInvisible === true) {
        return `Selected entity is a read-only invisible INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); hidden attribute text is inspectable through insert text focus, but geometry remains proxy-only.`;
      }
      return `Selected entity is read-only (${describeReadOnlySelectionEntity(primary)}); editing disabled.`;
    }
    return fullInsertGroupSelected
      ? 'Selected entities are a read-only imported insert group; full-group move/rotate/scale/copy/delete stay instance-level until release.'
      : (fullSourceGroupSelected
          ? 'Selected entities are a read-only source group; full-group move/rotate/scale/copy/delete stay bundle-level until release while source-text edit stays available when the bundle has text.'
          : 'Selected entities are read-only proxies; editing disabled.');
  }

  return fullInsertGroupSelected
    ? `Contains ${readOnlyCount} read-only derived/proxy entities; property edits skip them, full-group move/rotate/scale/copy/delete stay instance-level, and release detaches the group to editable geometry.`
    : (fullSourceGroupSelected
        ? `Contains ${readOnlyCount} read-only derived/proxy entities; full-group move/rotate/scale/copy/delete stay bundle-level, source-group selection/fit/release stay available, and source-text edit can release straight into editable text when present.`
        : `Contains ${readOnlyCount} read-only derived/proxy entities; property edits skip them.`);
}

export function buildPropertyPanelReleasedArchiveNote(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  if (!archive) return '';
  const archiveOrigin = formatReleasedInsertArchiveOrigin(archive) || 'INSERT / text / proxy';
  const archiveTextKind = String(archive?.textKind || '').trim().toLowerCase();
  return archiveTextKind === 'attdef'
    ? `Selected entity was released from imported ${archiveOrigin}; archived ATTDEF provenance remains visible as read-only context while the detached text now edits like plain text.`
    : `Selected entity was released from imported ${archiveOrigin}; archived insert provenance remains visible as read-only context while the detached text now edits like plain text.`;
}

export function buildPropertyPanelLockedLayerNote(entities, primary, getLayer = null) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0 || !primary) return '';
  const lockedCount = list.filter((entity) => resolveLayer(getLayer, entity?.layerId)?.locked === true).length;
  if (lockedCount <= 0) return '';
  if (lockedCount === list.length) {
    const layerSummary = formatSelectionLayer(primary, getLayer);
    return list.length === 1
      ? `Selected entity is on locked layer ${layerSummary}; editing disabled until the layer is unlocked.`
      : 'Selected entities are on locked layers; editing disabled.';
  }
  return `Contains ${lockedCount} entities on locked layers; edits skip them.`;
}

export function buildPropertyPanelNotePlan(entities, primary, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const actionContext = options.actionContext || null;
  const primaryLayer = primary ? resolveLayer(getLayer, primary.layerId) : null;
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  const lockedCount = list.filter((entity) => resolveLayer(getLayer, entity?.layerId)?.locked === true).length;
  const readOnlyBlocksFurtherEditing = readOnlyCount > 0 && readOnlyCount === list.length;
  const lockedBlocksFurtherEditing = lockedCount > 0 && lockedCount === list.length;
  const allowDirectSourceTextEditing = readOnlyBlocksFurtherEditing
    && list.length === 1
    && isDirectEditableSourceTextEntity(primary)
    && primaryLayer?.locked !== true;
  const allowDirectInsertTextEditing = readOnlyBlocksFurtherEditing
    && list.length === 1
    && isDirectEditableInsertTextProxyEntity(primary)
    && primaryLayer?.locked !== true;
  const allowInsertTextPositionEditing = allowDirectInsertTextEditing
    && supportsInsertTextPositionEditing(primary);

  return {
    readOnly: {
      text: buildPropertyPanelReadOnlyNote(list, primary, actionContext),
      blocksFurtherEditing: readOnlyBlocksFurtherEditing,
      allowDirectSourceTextEditing,
      allowDirectInsertTextEditing,
      allowInsertTextPositionEditing,
    },
    releasedInsert: {
      text: buildPropertyPanelReleasedArchiveNote(primary?.releasedInsertArchive ?? primary?.released_insert_archive),
    },
    locked: {
      text: buildPropertyPanelLockedLayerNote(list, primary, getLayer),
      blocksFurtherEditing: lockedBlocksFurtherEditing,
    },
  };
}

import { buildSelectionBadges } from './selection_badges.js';
export { buildSelectionBadges } from './selection_badges.js';

export function buildSelectionPresentation(entities, primaryId, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0] || null;
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const primaryLayer = primary ? resolveLayer(getLayer, primary.layerId) : null;
  return {
    mode: list.length === 0 ? 'empty' : (list.length === 1 ? 'single' : 'multiple'),
    entityCount: list.length,
    summaryText: formatSelectionSummary(list),
    statusText: formatSelectionStatus(list, primaryId),
    primary,
    primaryLayer,
    badges: buildSelectionBadges(list, primaryId, options),
    detailFacts: list.length === 1 ? buildSelectionDetailFacts(primary, options) : buildMultiSelectionDetailFacts(list, options),
  };
}
