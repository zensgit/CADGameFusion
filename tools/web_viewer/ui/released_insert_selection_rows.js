import {
  formatReleasedInsertArchiveModes,
  formatReleasedInsertArchiveOrigin,
} from './selection_released_archive_helpers.js';
import {
  formatPeerContext,
  formatPeerTarget,
} from './selection_display_helpers.js';

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
  if (peerSummary?.peerCount > 1) {
    const peerInstance = peerSummary.currentIndex >= 0
      ? `${peerSummary.currentIndex + 1} / ${peerSummary.peerCount}`
      : `Archived / ${peerSummary.peerCount}`;
    pushReleasedSelectionRow(rows, 'released-peer-instance', 'Released Peer Instance', peerInstance);
    pushReleasedSelectionRow(rows, 'released-peer-instances', 'Released Peer Instances', String(peerSummary.peerCount));
    pushReleasedSelectionRow(
      rows,
      'released-peer-layouts',
      'Released Peer Layouts',
      peerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | '),
    );
    pushReleasedSelectionRow(
      rows,
      'released-peer-targets',
      'Released Peer Targets',
      peerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | '),
    );
  }
  return rows;
}
