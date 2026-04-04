import {
  buildPropertyMetadataFacts,
} from './selection_presenter.js';
import { buildReleasedInsertArchiveSelectionRows } from './released_insert_selection_rows.js';
import {
  buildSourceGroupInfoRows as buildSharedSourceGroupInfoRows,
  buildInsertGroupInfoRows as buildSharedInsertGroupInfoRows,
} from './group_info_rows.js';

export function buildEntityMetadataInfoRows(entity, { getLayer = null, listEntities = null } = {}) {
  if (!entity) return [];
  return buildPropertyMetadataFacts(entity, { getLayer, listEntities });
}

export function buildReleasedInsertArchiveSelectionInfoRows(selectionSummary) {
  return buildReleasedInsertArchiveSelectionRows(selectionSummary);
}

export function buildSourceGroupInfoRows(entity, sourceGroupSummary, { listEntities = null } = {}) {
  return buildSharedSourceGroupInfoRows(entity, sourceGroupSummary, { listEntities });
}

export function buildInsertGroupInfoRows(entity, insertGroupSummary, { listEntities = null, peerSummary = null } = {}) {
  return buildSharedInsertGroupInfoRows(entity, insertGroupSummary, {
    listEntities,
    peerSummary,
  });
}
