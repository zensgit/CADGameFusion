import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import {
  isInsertGroupEntity,
  resolveSourceTextGuide,
  resolveReleasedInsertArchive,
  summarizeInsertGroupMembers,
  summarizeInsertPeerInstances,
  summarizeReleasedInsertPeerInstances,
  summarizeSourceGroupMembers,
} from '../insert_group.js';
import {
  isReadOnlySelectionEntity,
} from './selection_meta_helpers.js';
import {
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
import { resolveLayer } from './selection_layer_helpers.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';
import { appendSelectionLineStyleRows } from './selection_line_style_rows.js';
import { appendSelectionBaseFacts } from './selection_base_facts.js';
import {
  appendReleasedArchiveIdentityRows,
  appendReleasedArchiveAttributeRows,
} from './released_archive_metadata_rows.js';
import {
  buildSourceGroupInfoRows as buildSharedSourceGroupInfoRows,
  buildInsertGroupInfoRows as buildSharedInsertGroupInfoRows,
} from './group_info_rows.js';
import { appendSourceTextGuideRows } from './source_text_guide_rows.js';

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
  appendSelectionBaseFacts(facts, entity, { getLayer, effectiveColor });
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
