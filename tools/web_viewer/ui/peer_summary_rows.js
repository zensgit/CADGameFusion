import {
  formatPeerContext,
  formatPeerTarget,
} from './selection_display_helpers.js';

function pushRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({
    key,
    label,
    value: String(value),
  });
}

export function buildPeerSummaryRows(rows, peerSummary, { released = false } = {}) {
  if (!peerSummary || peerSummary.peerCount <= 1) return;
  const keyPrefix = released ? 'released-peer' : 'peer';
  const labelPrefix = released ? 'Released Peer' : 'Peer';
  let instanceValue;
  if (released) {
    instanceValue = peerSummary.currentIndex >= 0
      ? `${peerSummary.currentIndex + 1} / ${peerSummary.peerCount}`
      : `Archived / ${peerSummary.peerCount}`;
  } else {
    const currentIndex = peerSummary.currentIndex >= 0 ? peerSummary.currentIndex : 0;
    instanceValue = `${currentIndex + 1} / ${peerSummary.peerCount}`;
  }
  pushRow(rows, `${keyPrefix}-instance`, `${labelPrefix} Instance`, instanceValue);
  pushRow(rows, `${keyPrefix}-instances`, `${labelPrefix} Instances`, String(peerSummary.peerCount));
  pushRow(
    rows,
    `${keyPrefix}-layouts`,
    `${labelPrefix} Layouts`,
    peerSummary.peers.map((peer) => formatPeerContext(peer)).filter(Boolean).join(' | '),
  );
  pushRow(
    rows,
    `${keyPrefix}-targets`,
    `${labelPrefix} Targets`,
    peerSummary.peers.map((peer, index) => formatPeerTarget(peer, index)).filter(Boolean).join(' | '),
  );
}
