import {
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import { buildSelectionDetailContext } from './selection_detail_context.js';
import { buildSelectionDetailPipeline } from './selection_detail_pipeline.js';

export function buildMultiSelectionDetailFacts(entities, options = {}) {
  const releasedInsertArchiveSelection = summarizeReleasedInsertArchiveSelection(entities, options);
  return buildReleasedInsertArchiveSelectionRows(releasedInsertArchiveSelection);
}

export function buildSelectionDetailFacts(entity, options = {}) {
  if (!entity) return [];
  const context = buildSelectionDetailContext(entity, options);
  return buildSelectionDetailPipeline(entity, context);
}
