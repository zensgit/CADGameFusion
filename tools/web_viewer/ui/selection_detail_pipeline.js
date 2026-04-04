import {
  appendReleasedArchiveIdentityRows,
  appendReleasedArchiveAttributeRows,
} from './released_archive_metadata_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';
import { appendSelectionLineStyleRows } from './selection_line_style_rows.js';
import { appendSelectionBaseFacts } from './selection_base_facts.js';
import {
  buildSourceGroupInfoRows as buildSharedSourceGroupInfoRows,
  buildInsertGroupInfoRows as buildSharedInsertGroupInfoRows,
} from './group_info_rows.js';
import { appendSourceTextGuideRows } from './source_text_guide_rows.js';

export function buildSelectionDetailPipeline(entity, context) {
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
