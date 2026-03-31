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
export { formatSpaceLabel } from '../space_layout.js';
export { resolveReleasedInsertArchive } from '../insert_group.js';

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

export function formatReleasedInsertArchiveOrigin(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  const sourceType = normalizeText(archive?.sourceType);
  const proxyKind = normalizeText(archive?.proxyKind);
  const editMode = normalizeText(archive?.editMode);
  return [sourceType, proxyKind, editMode].filter(Boolean).join(' / ');
}

export function formatReleasedInsertArchiveModes(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  const hasAttributeMetadata = Number.isFinite(archive?.attributeFlags)
    || typeof archive?.attributeInvisible === 'boolean'
    || typeof archive?.attributeConstant === 'boolean'
    || typeof archive?.attributeVerify === 'boolean'
    || typeof archive?.attributePreset === 'boolean'
    || typeof archive?.attributeLockPosition === 'boolean';
  if (!hasAttributeMetadata) return '';
  const modes = [];
  if (archive?.attributeInvisible === true) modes.push('Invisible');
  if (archive?.attributeConstant === true) modes.push('Constant');
  if (archive?.attributeVerify === true) modes.push('Verify');
  if (archive?.attributePreset === true) modes.push('Preset');
  if (archive?.attributeLockPosition === true) modes.push('Lock Position');
  return modes.length > 0 ? modes.join(' / ') : 'None';
}

function resolveCommonArchiveString(archives, key) {
  if (!Array.isArray(archives) || archives.length === 0) return '';
  const first = normalizeText(archives[0]?.[key]);
  if (!first) return '';
  return archives.every((archive) => normalizeText(archive?.[key]) === first) ? first : '';
}

function resolveCommonArchiveInteger(archives, key) {
  if (!Array.isArray(archives) || archives.length === 0) return undefined;
  const first = Number.isFinite(archives[0]?.[key]) ? Math.trunc(Number(archives[0][key])) : undefined;
  if (!Number.isFinite(first)) return undefined;
  return archives.every((archive) => Number.isFinite(archive?.[key]) && Math.trunc(Number(archive[key])) === first)
    ? first
    : undefined;
}

export function summarizeReleasedInsertArchiveSelection(entities, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0) return null;
  const archives = list.map((entity) => resolveReleasedInsertArchive(entity));
  if (archives.some((archive) => !archive || normalizeText(archive?.sourceType).toUpperCase() !== 'INSERT')) {
    return null;
  }
  const groupId = resolveCommonArchiveInteger(archives, 'groupId');
  if (!Number.isFinite(groupId)) {
    return null;
  }
  const blockName = resolveCommonArchiveString(archives, 'blockName');
  if (!blockName) {
    return null;
  }
  const listEntities = typeof options.listEntities === 'function' ? options.listEntities : null;
  const peerSummary = listEntities
    ? summarizeReleasedInsertPeerInstances(listEntities(), list[0], { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const archive = {
    sourceType: 'INSERT',
    editMode: resolveCommonArchiveString(archives, 'editMode'),
    proxyKind: resolveCommonArchiveString(archives, 'proxyKind'),
    groupId,
    blockName,
    textKind: resolveCommonArchiveString(archives, 'textKind'),
    attributeTag: resolveCommonArchiveString(archives, 'attributeTag'),
    attributeDefault: resolveCommonArchiveString(archives, 'attributeDefault'),
    attributePrompt: resolveCommonArchiveString(archives, 'attributePrompt'),
  };
  const attributeFlags = resolveCommonArchiveInteger(archives, 'attributeFlags');
  if (Number.isFinite(attributeFlags)) {
    archive.attributeFlags = attributeFlags;
  }
  const commonModes = formatReleasedInsertArchiveModes(archive);
  return {
    archive,
    entityCount: list.length,
    entityIds: list.map((entity) => entity.id),
    peerSummary,
    commonModes,
  };
}

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

export function isReadOnlySelectionEntity(entity) {
  return !!entity && (entity.readOnly === true || entity.type === 'unsupported' || entity.editMode === 'proxy');
}

export function describeReadOnlySelectionEntity(entity) {
  if (!entity) return 'read-only proxy';
  if (entity.type === 'unsupported') return 'unsupported proxy';
  const sourceType = normalizeText(entity.sourceType);
  const proxyKind = normalizeText(entity.proxyKind);
  if (sourceType && proxyKind) return `${sourceType} ${proxyKind} proxy`;
  if (sourceType) return `${sourceType} derived proxy`;
  return 'read-only proxy';
}

export function describeSelectionOrigin(entity, { separator = ' / ', includeReadOnly = false } = {}) {
  if (!entity) return '';
  const sourceType = normalizeText(entity.sourceType);
  const proxyKind = normalizeText(entity.proxyKind);
  const editMode = normalizeText(entity.editMode);
  const parts = [];
  if (sourceType) parts.push(sourceType);
  if (proxyKind) parts.push(proxyKind);
  if (editMode) parts.push(editMode);
  if (includeReadOnly && isReadOnlySelectionEntity(entity) && editMode !== 'proxy') {
    parts.push('read-only');
  }
  return parts.join(separator);
}

export function formatSelectionLayer(entity, getLayer = null) {
  const layerId = Number.isFinite(entity?.layerId) ? Math.trunc(entity.layerId) : null;
  const layer = resolveLayer(getLayer, layerId);
  const name = normalizeText(layer?.name);
  if (layerId === null) return name;
  return name ? `${layerId}:${name}` : String(layerId);
}

export function formatSelectionLayerColor(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  return normalizeText(layer?.color);
}

export function listSelectionLayerFlags(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  if (!layer) return [];
  const flags = [];
  if (layer.visible === false) flags.push('Hidden');
  if (layer.locked === true) flags.push('Locked');
  if (layer.frozen === true) flags.push('Frozen');
  if (layer.printable === false) flags.push('NoPrint');
  if (layer.construction === true) flags.push('Construction');
  return flags;
}

export function formatSelectionLayerFlags(entity, getLayer = null, { separator = ' / ' } = {}) {
  return listSelectionLayerFlags(entity, getLayer).join(separator);
}

export function formatSelectionLayerState(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  if (!layer) return '';
  return [
    layer.visible === false ? 'Hidden' : 'Shown',
    layer.locked === true ? 'Locked' : 'Open',
    layer.frozen === true ? 'Frozen' : 'Live',
    layer.printable === false ? 'NoPrint' : 'Print',
    layer.construction === true ? 'Construction' : 'Normal',
  ].join(' / ');
}

import { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';
export { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';

function formatSelectionColor(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effectiveColor = resolveEffectiveEntityColor(entity, layer);
  const parts = [];
  const color = normalizeText(effectiveColor);
  if (color) parts.push(color);
  const colorSource = normalizeText(entity?.colorSource).toUpperCase();
  if (colorSource) {
    parts.push(colorSource);
  } else if (color) {
    parts.push('TRUECOLOR');
  }
  if (Number.isFinite(entity?.colorAci)) {
    parts.push(`ACI ${entity.colorAci}`);
  }
  return parts.join(' | ');
}

function formatSelectionSpace(entity) {
  const parts = [];
  const space = formatSpaceLabel(entity?.space);
  if (space) parts.push(space);
  const layout = normalizeText(entity?.layout);
  if (layout) parts.push(layout);
  return parts.join(' / ');
}

function formatSelectionStyle(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effective = resolveEffectiveEntityStyle(entity, layer);
  const styleSources = resolveEntityStyleSources(entity);
  const parts = [];
  const lineType = normalizeText(effective.lineType).toUpperCase() || 'CONTINUOUS';
  parts.push(`LT ${lineType}`);
  if (styleSources.lineWeightSource === 'EXPLICIT' || (Number.isFinite(effective.lineWeight) && Number(effective.lineWeight) > 0)) {
    parts.push(`LW ${effective.lineWeight}`);
  }
  const lineTypeScale = Number.isFinite(effective.lineTypeScale) ? effective.lineTypeScale : 1;
  parts.push(`LTS ${lineTypeScale}`);
  return parts.join(' | ');
}

export function buildSelectionContract(entities, primaryId = null, options = {}) {
  const list = Array.isArray(entities) ? entities.filter((entity) => !!entity) : [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const releasedInsertArchiveSelection = list.length > 1
    ? summarizeReleasedInsertArchiveSelection(list, options)
    : null;
  if (list.length === 0) {
    return {
      mode: 'none',
      entityCount: 0,
      primaryType: '',
      readOnly: false,
      summaryText: 'No selection',
      rows: [],
      note: 'Select one entity to inspect provenance and style.',
    };
  }

  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0];
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  const summaryText = formatSelectionSummary(list);

  if (!primary) {
    return {
      mode: 'none',
      entityCount: 0,
      primaryType: '',
      readOnly: false,
      summaryText: 'No selection',
      rows: [],
      note: 'Select one entity to inspect provenance and style.',
    };
  }

  if (list.length > 1) {
    const rows = [];
    const typeSummary = [...new Set(list.map((entity) => entity?.type).filter(Boolean))].slice(0, 4).join(' | ');
    if (typeSummary) {
      rows.push({ key: 'types', label: 'Types', value: typeSummary });
    }
    if (readOnlyCount > 0) {
      rows.push({
        key: 'access',
        label: 'Access',
        value: readOnlyCount === list.length ? 'All selected entities are read-only' : `${readOnlyCount} read-only in selection`,
      });
    }
    if (releasedInsertArchiveSelection) {
      rows.push({ key: 'released-from', label: 'Released From', value: formatReleasedInsertArchiveOrigin(releasedInsertArchiveSelection.archive) });
      rows.push({ key: 'released-block-name', label: 'Released Block Name', value: releasedInsertArchiveSelection.archive.blockName });
      rows.push({ key: 'released-group-id', label: 'Released Group ID', value: String(releasedInsertArchiveSelection.archive.groupId) });
    }
    return {
      mode: 'multi',
      entityCount: list.length,
      primaryType: String(primary.type || ''),
      readOnly: readOnlyCount > 0 ? (readOnlyCount === list.length ? 'all' : 'mixed') : false,
      summaryText,
      rows,
      note: 'Single-select to inspect provenance and effective style.',
    };
  }

  const rows = [];
  const origin = describeSelectionOrigin(primary);
  if (origin) rows.push({ key: 'origin', label: 'Origin', value: origin });
  const layer = formatSelectionLayer(primary, getLayer);
  if (layer) rows.push({ key: 'layer', label: 'Layer', value: layer });
  const layerColor = formatSelectionLayerColor(primary, getLayer);
  if (layerColor) rows.push({ key: 'layer-color', label: 'Layer Color', value: layerColor });
  const layerState = formatSelectionLayerState(primary, getLayer);
  if (layerState) rows.push({ key: 'layer-state', label: 'Layer State', value: layerState });
  const color = formatSelectionColor(primary, getLayer);
  if (color) rows.push({ key: 'color', label: 'Color', value: color });
  const space = formatSelectionSpace(primary);
  if (space) rows.push({ key: 'space', label: 'Space', value: space });
  const style = formatSelectionStyle(primary, getLayer);
  if (style) rows.push({ key: 'style', label: 'Style', value: style });
  if (isReadOnlySelectionEntity(primary)) {
    rows.push({ key: 'access', label: 'Access', value: describeReadOnlySelectionEntity(primary) });
  }
  return {
    mode: 'single',
    entityCount: 1,
    primaryType: String(primary.type || ''),
    readOnly: isReadOnlySelectionEntity(primary),
    summaryText,
    rows,
    note: '',
  };
}

function buildMultiSelectionDetailFacts(entities, options = {}) {
  const facts = [];
  const releasedInsertArchiveSelection = summarizeReleasedInsertArchiveSelection(entities, options);
  if (!releasedInsertArchiveSelection) {
    return facts;
  }
  const { archive, peerSummary, entityCount, commonModes } = releasedInsertArchiveSelection;
  pushFact(facts, 'released-from', 'Released From', formatReleasedInsertArchiveOrigin(archive));
  pushFact(facts, 'released-group-id', 'Released Group ID', String(archive.groupId));
  pushFact(facts, 'released-block-name', 'Released Block Name', archive.blockName);
  pushFact(facts, 'released-selection-members', 'Released Selection Members', String(entityCount));
  pushFact(facts, 'released-text-kind', 'Released Text Kind', archive.textKind);
  pushFact(facts, 'released-attribute-tag', 'Released Attribute Tag', archive.attributeTag);
  pushFact(facts, 'released-attribute-default', 'Released Attribute Default', archive.attributeDefault);
  pushFact(facts, 'released-attribute-prompt', 'Released Attribute Prompt', archive.attributePrompt);
  if (Number.isFinite(archive.attributeFlags)) {
    pushFact(facts, 'released-attribute-flags', 'Released Attribute Flags', String(archive.attributeFlags));
  }
  pushFact(facts, 'released-attribute-modes', 'Released Attribute Modes', commonModes);
  if (peerSummary?.peerCount > 1) {
    const peerInstance = peerSummary.currentIndex >= 0
      ? `${peerSummary.currentIndex + 1} / ${peerSummary.peerCount}`
      : `Archived / ${peerSummary.peerCount}`;
    pushFact(facts, 'released-peer-instance', 'Released Peer Instance', peerInstance);
    pushFact(facts, 'released-peer-instances', 'Released Peer Instances', String(peerSummary.peerCount));
    pushFact(
      facts,
      'released-peer-layouts',
      'Released Peer Layouts',
      peerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | ')
    );
    pushFact(
      facts,
      'released-peer-targets',
      'Released Peer Targets',
      peerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | ')
    );
  }
  return facts;
}

export function buildSelectionDetailFacts(entity, options = {}) {
  if (!entity) return [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const listEntities = typeof options.listEntities === 'function' ? options.listEntities : null;
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effectiveStyle = resolveEffectiveEntityStyle(entity, layer);
  const effectiveColor = resolveEffectiveEntityColor(entity, layer);
  const styleSources = resolveEntityStyleSources(entity);
  const entities = listEntities ? listEntities() : null;
  const sourceGroupSummary = entities ? summarizeSourceGroupMembers(entities, entity, { isReadOnly: isReadOnlySelectionEntity }) : null;
  const sourceGroupBounds = entities ? computeSourceGroupBounds(entities, entity) : null;
  const insertGroupSummary = isInsertGroupEntity(entity)
    ? summarizeInsertGroupMembers(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const insertPeerSummary = isInsertGroupEntity(entity)
    ? summarizeInsertPeerInstances(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const releasedInsertPeerSummary = resolveReleasedInsertArchive(entity)
    ? summarizeReleasedInsertPeerInstances(entities, entity, { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const sourceTextGuide = entities ? resolveSourceTextGuide(entities, entity) : null;
  const facts = [];
  pushFact(facts, 'origin', 'Origin', describeSelectionOrigin(entity, { separator: ' / ', includeReadOnly: true }));
  pushFact(facts, 'layer', 'Layer', formatSelectionLayer(entity, getLayer));
  const layerColor = formatSelectionLayerColor(entity, getLayer);
  pushFact(facts, 'layer-color', 'Layer Color', layerColor, { swatch: layerColor || undefined });
  pushFact(facts, 'layer-state', 'Layer State', formatSelectionLayerState(entity, getLayer));
  pushFact(facts, 'entity-visibility', 'Entity Visibility', entity.visible === false ? 'Hidden' : 'Shown');
  pushFact(facts, 'effective-color', 'Effective Color', normalizeText(effectiveColor), { swatch: normalizeText(effectiveColor) });
  pushFact(facts, 'color-source', 'Color Source', normalizeText(entity.colorSource));
  if (Number.isFinite(entity.colorAci)) {
    pushFact(facts, 'color-aci', 'Color ACI', String(entity.colorAci));
  }
  pushFact(facts, 'space', 'Space', formatSpaceLabel(entity.space));
  pushFact(facts, 'layout', 'Layout', normalizeText(entity.layout));
  if (Number.isFinite(entity.groupId)) {
    pushFact(facts, 'group-id', 'Group ID', String(Math.trunc(entity.groupId)));
  }
  if (isSourceGroupEntity(entity)) {
    pushFact(facts, 'group-source', 'Group Source', formatSourceGroup(entity));
  }
  if (Number.isFinite(entity.sourceBundleId) && (!Number.isFinite(entity.groupId) || Math.trunc(entity.sourceBundleId) !== Math.trunc(entity.groupId))) {
    pushFact(facts, 'source-bundle-id', 'Source Bundle ID', String(Math.trunc(entity.sourceBundleId)));
  }
  pushFact(facts, 'block-name', 'Block Name', normalizeText(entity.blockName));
  pushFact(facts, 'text-kind', 'Text Kind', normalizeText(entity.textKind));
  pushFact(facts, 'attribute-tag', 'Attribute Tag', normalizeText(entity.attributeTag));
  pushFact(facts, 'attribute-default', 'Attribute Default', normalizeText(entity.attributeDefault));
  pushFact(facts, 'attribute-prompt', 'Attribute Prompt', normalizeText(entity.attributePrompt));
  if (Number.isFinite(entity.attributeFlags)) {
    pushFact(facts, 'attribute-flags', 'Attribute Flags', String(Math.trunc(entity.attributeFlags)));
  }
  pushFact(facts, 'attribute-modes', 'Attribute Modes', formatAttributeModes(entity));
  const releasedInsertArchive = resolveReleasedInsertArchive(entity);
  pushFact(facts, 'released-from', 'Released From', formatReleasedInsertArchiveOrigin(releasedInsertArchive));
  if (Number.isFinite(releasedInsertArchive?.groupId)) {
    pushFact(facts, 'released-group-id', 'Released Group ID', String(Math.trunc(releasedInsertArchive.groupId)));
  }
  pushFact(facts, 'released-block-name', 'Released Block Name', normalizeText(releasedInsertArchive?.blockName));
  pushFact(facts, 'released-text-kind', 'Released Text Kind', normalizeText(releasedInsertArchive?.textKind));
  pushFact(facts, 'released-attribute-tag', 'Released Attribute Tag', normalizeText(releasedInsertArchive?.attributeTag));
  pushFact(facts, 'released-attribute-default', 'Released Attribute Default', normalizeText(releasedInsertArchive?.attributeDefault));
  pushFact(facts, 'released-attribute-prompt', 'Released Attribute Prompt', normalizeText(releasedInsertArchive?.attributePrompt));
  if (Number.isFinite(releasedInsertArchive?.attributeFlags)) {
    pushFact(facts, 'released-attribute-flags', 'Released Attribute Flags', String(Math.trunc(releasedInsertArchive.attributeFlags)));
  }
  pushFact(facts, 'released-attribute-modes', 'Released Attribute Modes', formatReleasedInsertArchiveModes(releasedInsertArchive));
  if (insertGroupSummary?.memberIds?.length > 0) {
    pushFact(facts, 'insert-group-members', 'Insert Group Members', String(insertGroupSummary.memberIds.length));
    if (insertGroupSummary.readOnlyIds.length > 0) {
      pushFact(facts, 'editable-members', 'Editable Members', String(insertGroupSummary.editableIds.length));
      pushFact(facts, 'read-only-members', 'Read-only Members', String(insertGroupSummary.readOnlyIds.length));
    }
  } else if (sourceGroupSummary?.memberIds?.length > 0) {
    pushFact(facts, 'source-group-members', 'Source Group Members', String(sourceGroupSummary.memberIds.length));
    if (sourceGroupSummary.readOnlyIds.length > 0) {
      pushFact(facts, 'editable-members', 'Editable Members', String(sourceGroupSummary.editableIds.length));
      pushFact(facts, 'read-only-members', 'Read-only Members', String(sourceGroupSummary.readOnlyIds.length));
    }
  }
  if (sourceGroupBounds) {
    pushFact(facts, 'group-center', 'Group Center', formatPoint(sourceGroupBounds.center));
    pushFact(facts, 'group-size', 'Group Size', `${formatCompactNumber(sourceGroupBounds.width)} x ${formatCompactNumber(sourceGroupBounds.height)}`);
    pushFact(
      facts,
      'group-bounds',
      'Group Bounds',
      `${formatCompactNumber(sourceGroupBounds.minX)}, ${formatCompactNumber(sourceGroupBounds.minY)} -> ${formatCompactNumber(sourceGroupBounds.maxX)}, ${formatCompactNumber(sourceGroupBounds.maxY)}`,
    );
  }
  if (insertPeerSummary?.peerCount > 1) {
    const currentIndex = insertPeerSummary.currentIndex >= 0 ? insertPeerSummary.currentIndex : 0;
    pushFact(facts, 'peer-instance', 'Peer Instance', `${currentIndex + 1} / ${insertPeerSummary.peerCount}`);
    pushFact(facts, 'peer-instances', 'Peer Instances', String(insertPeerSummary.peerCount));
    pushFact(
      facts,
      'peer-layouts',
      'Peer Layouts',
      insertPeerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | ')
    );
    pushFact(
      facts,
      'peer-targets',
      'Peer Targets',
      insertPeerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | ')
    );
  }
  if (releasedInsertPeerSummary?.peerCount > 1) {
    const peerInstance = releasedInsertPeerSummary.currentIndex >= 0
      ? `${releasedInsertPeerSummary.currentIndex + 1} / ${releasedInsertPeerSummary.peerCount}`
      : `Archived / ${releasedInsertPeerSummary.peerCount}`;
    pushFact(facts, 'released-peer-instance', 'Released Peer Instance', peerInstance);
    pushFact(facts, 'released-peer-instances', 'Released Peer Instances', String(releasedInsertPeerSummary.peerCount));
    pushFact(
      facts,
      'released-peer-layouts',
      'Released Peer Layouts',
      releasedInsertPeerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | ')
    );
    pushFact(
      facts,
      'released-peer-targets',
      'Released Peer Targets',
      releasedInsertPeerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | ')
    );
  }
  pushFact(facts, 'line-type', 'Line Type', normalizeText(effectiveStyle.lineType));
  pushFact(facts, 'line-type-source', 'Line Type Source', styleSources.lineTypeSource);
  if (styleSources.lineWeightSource === 'EXPLICIT' || (Number.isFinite(effectiveStyle.lineWeight) && Number(effectiveStyle.lineWeight) > 0)) {
    pushFact(facts, 'line-weight', 'Line Weight', String(effectiveStyle.lineWeight));
  }
  pushFact(facts, 'line-weight-source', 'Line Weight Source', styleSources.lineWeightSource);
  if (Number.isFinite(effectiveStyle.lineTypeScale)) {
    pushFact(facts, 'line-type-scale', 'Line Type Scale', String(effectiveStyle.lineTypeScale));
  }
  pushFact(facts, 'line-type-scale-source', 'Line Type Scale Source', styleSources.lineTypeScaleSource);
  if (entity.sourceTextPos && Number.isFinite(entity.sourceTextPos.x) && Number.isFinite(entity.sourceTextPos.y)) {
    pushFact(facts, 'source-text-pos', 'Source Text Pos', formatPoint(entity.sourceTextPos));
  }
  if (Number.isFinite(entity.sourceTextRotation)) {
    pushFact(facts, 'source-text-rotation', 'Source Text Rotation', formatCompactNumber(entity.sourceTextRotation));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.anchor) {
    pushFact(facts, 'source-anchor', 'Source Anchor', formatPoint(sourceTextGuide.anchor));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.landingPoint) {
    pushFact(facts, 'leader-landing', 'Leader Landing', formatPoint(sourceTextGuide.landingPoint));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.elbowPoint) {
    pushFact(facts, 'leader-elbow', 'Leader Elbow', formatPoint(sourceTextGuide.elbowPoint));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && Number.isFinite(sourceTextGuide?.landingLength)) {
    pushFact(facts, 'leader-landing-length', 'Leader Landing Length', formatCompactNumber(sourceTextGuide.landingLength));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.anchorDriverId) {
    const driverValue = sourceTextGuide?.anchorDriverLabel
      ? `${sourceTextGuide.anchorDriverId}:${sourceTextGuide.anchorDriverLabel}`
      : String(sourceTextGuide.anchorDriverId);
    pushFact(facts, 'source-anchor-driver', 'Source Anchor Driver', driverValue);
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceOffset) {
    pushFact(facts, 'source-offset', 'Source Offset', formatPoint(sourceTextGuide.sourceOffset));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.currentOffset) {
    pushFact(facts, 'current-offset', 'Current Offset', formatPoint(sourceTextGuide.currentOffset));
  }
  return facts;
}

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
