import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import {
  isDirectEditableSourceTextEntity,
  isInsertGroupEntity,
  isSourceGroupEntity,
  resolveSourceTextGuide,
  resolveReleasedInsertArchive,
  summarizeInsertGroupMembers,
  summarizeInsertPeerInstances,
  summarizeReleasedInsertPeerInstances,
  summarizeSourceGroupMembers,
} from '../insert_group.js';
import { formatSpaceLabel } from '../space_layout.js';
import {
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
} from './selection_meta_helpers.js';
import {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
import {
  normalizeText,
  formatCompactNumber,
  formatPoint,
} from './selection_display_helpers.js';
import { resolveLayer } from './selection_layer_helpers.js';
import { formatSelectionAttributeModes } from './selection_attribute_mode_helpers.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';
import {
  buildSourceGroupInfoRows as buildSharedSourceGroupInfoRows,
  buildInsertGroupInfoRows as buildSharedInsertGroupInfoRows,
} from './group_info_rows.js';

function pushFact(facts, key, label, value, extra = {}) {
  if (value === null || value === undefined || value === '') return;
  facts.push({
    key,
    label,
    value: String(value),
    ...extra,
  });
}

function formatSourceGroup(entity) {
  const sourceType = normalizeText(entity?.sourceType);
  const proxyKind = normalizeText(entity?.proxyKind);
  return [sourceType, proxyKind].filter(Boolean).join(' / ');
}

export function buildMultiSelectionDetailFacts(entities, options = {}) {
  const releasedInsertArchiveSelection = summarizeReleasedInsertArchiveSelection(entities, options);
  return buildReleasedInsertArchiveSelectionRows(releasedInsertArchiveSelection);
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
  pushFact(facts, 'attribute-modes', 'Attribute Modes', formatSelectionAttributeModes(entity));
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
  const groupRows = insertGroupSummary
    ? buildSharedInsertGroupInfoRows(entity, insertGroupSummary, {
      listEntities,
      peerSummary: insertPeerSummary,
      includeIdentityRows: false,
      includeBlockName: false,
      includeBounds: true,
    })
    : buildSharedSourceGroupInfoRows(entity, sourceGroupSummary, {
      listEntities,
      includeIdentityRows: false,
    });
  facts.push(...groupRows);
  buildPeerSummaryRows(facts, releasedInsertPeerSummary, { released: true });
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
