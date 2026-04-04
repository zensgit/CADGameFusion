import {
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';
import { appendSelectionLineStyleRows } from './selection_line_style_rows.js';
import { appendSelectionBaseFacts } from './selection_base_facts.js';
import { buildSelectionDetailContext } from './selection_detail_context.js';
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
  const context = buildSelectionDetailContext(entity, options);
  const facts = [];
  appendSelectionBaseFacts(facts, entity, { getLayer: context.getLayer, effectiveColor: context.effectiveColor });
  appendReleasedArchiveIdentityRows(facts, context.releasedInsertArchive);
  appendReleasedArchiveAttributeRows(facts, context.releasedInsertArchive);
  const groupRows = context.insertGroupSummary
    ? buildSharedInsertGroupInfoRows(entity, context.insertGroupSummary, {
      listEntities: context.listEntities,
      peerSummary: context.insertPeerSummary,
      includeIdentityRows: false,
      includeBlockName: false,
      includeBounds: true,
    })
    : buildSharedSourceGroupInfoRows(entity, context.sourceGroupSummary, {
      listEntities: context.listEntities,
      includeIdentityRows: false,
    });
  facts.push(...groupRows);
  buildPeerSummaryRows(facts, context.releasedInsertPeerSummary, { released: true });
  appendSelectionLineStyleRows(facts, context.effectiveStyle, context.styleSources);
  appendSourceTextGuideRows(facts, entity, context.sourceTextGuide);
  return facts;
}
