import {
  formatReleasedInsertArchiveModes,
  formatReleasedInsertArchiveOrigin,
} from './selection_released_archive_helpers.js';
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
  pushReleasedSelectionRow(rows, 'released-from', 'Released From', formatReleasedInsertArchiveOrigin(archive));
  if (Number.isFinite(archive?.groupId)) {
    pushReleasedSelectionRow(rows, 'released-group-id', 'Released Group ID', String(Math.trunc(archive.groupId)));
  }
  pushReleasedSelectionRow(rows, 'released-block-name', 'Released Block Name', archive?.blockName);
  pushReleasedSelectionRow(rows, 'released-selection-members', 'Released Selection Members', String(entityCount));
  pushReleasedSelectionRow(rows, 'released-text-kind', 'Released Text Kind', archive?.textKind);
  pushReleasedSelectionRow(rows, 'released-attribute-tag', 'Released Attribute Tag', archive?.attributeTag);
  pushReleasedSelectionRow(rows, 'released-attribute-default', 'Released Attribute Default', archive?.attributeDefault);
  pushReleasedSelectionRow(rows, 'released-attribute-prompt', 'Released Attribute Prompt', archive?.attributePrompt);
  if (Number.isFinite(archive?.attributeFlags)) {
    pushReleasedSelectionRow(rows, 'released-attribute-flags', 'Released Attribute Flags', String(Math.trunc(archive.attributeFlags)));
  }
  pushReleasedSelectionRow(
    rows,
    'released-attribute-modes',
    'Released Attribute Modes',
    commonModes || formatReleasedInsertArchiveModes(archive),
  );
  buildPeerSummaryRows(rows, peerSummary, { released: true });
  return rows;
}
