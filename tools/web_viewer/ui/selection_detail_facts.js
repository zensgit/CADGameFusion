import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import {
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
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
import {
  normalizeText,
} from './selection_display_helpers.js';
import { resolveLayer } from './selection_layer_helpers.js';
import { formatSelectionAttributeModes } from './selection_attribute_mode_helpers.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';
import { appendSelectionLineStyleRows } from './selection_line_style_rows.js';
import {
  appendReleasedArchiveIdentityRows,
  appendReleasedArchiveAttributeRows,
} from './released_archive_metadata_rows.js';
import {
  buildSourceGroupInfoRows as buildSharedSourceGroupInfoRows,
  buildInsertGroupInfoRows as buildSharedInsertGroupInfoRows,
} from './group_info_rows.js';
import { appendSourceTextGuideRows } from './source_text_guide_rows.js';

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
  appendReleasedArchiveIdentityRows(facts, releasedInsertArchive);
  appendReleasedArchiveAttributeRows(facts, releasedInsertArchive);
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
  appendSelectionLineStyleRows(facts, effectiveStyle, styleSources);
  appendSourceTextGuideRows(facts, entity, sourceTextGuide);
  return facts;
}
