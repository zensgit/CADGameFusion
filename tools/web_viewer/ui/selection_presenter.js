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

import { buildPropertyMetadataFacts } from './property_metadata_facts.js';
export { buildPropertyMetadataFacts } from './property_metadata_facts.js';

import { buildSelectionActionContext } from './selection_action_context.js';
export { buildSelectionActionContext } from './selection_action_context.js';

import {
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildPropertyPanelLockedLayerNote,
} from './property_panel_note_helpers.js';
export {
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildPropertyPanelLockedLayerNote,
} from './property_panel_note_helpers.js';

import { buildPropertyPanelNotePlan } from './property_panel_note_plan.js';
export { buildPropertyPanelNotePlan } from './property_panel_note_plan.js';

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
