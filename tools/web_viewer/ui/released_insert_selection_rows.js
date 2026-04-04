import {
  appendReleasedArchiveIdentityRows,
  appendReleasedArchiveAttributeRows,
} from './released_archive_metadata_rows.js';
import { buildPeerSummaryRows } from './peer_summary_rows.js';

function pushReleasedSelectionRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({
    key,
    label,
    value: String(value),
  });
}

export function buildReleasedInsertArchiveSelectionRows(selectionSummary) {
  if (!selectionSummary?.archive) return [];
  const rows = [];
  const { archive, entityCount, peerSummary, commonModes } = selectionSummary;
  appendReleasedArchiveIdentityRows(rows, archive);
  pushReleasedSelectionRow(rows, 'released-selection-members', 'Released Selection Members', String(entityCount));
  appendReleasedArchiveAttributeRows(rows, archive, { commonModes });
  buildPeerSummaryRows(rows, peerSummary, { released: true });
  return rows;
}
