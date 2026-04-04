import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPeerSummaryRows } from '../ui/peer_summary_rows.js';

function toMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

test('buildPeerSummaryRows appends nothing when peerCount <= 1', () => {
  const rows = [];
  buildPeerSummaryRows(rows, { peerCount: 1, currentIndex: 0, peers: [{ space: 0 }] });
  assert.deepEqual(rows, []);
});

test('buildPeerSummaryRows appends nothing for null peerSummary', () => {
  const rows = [];
  buildPeerSummaryRows(rows, null);
  assert.deepEqual(rows, []);
});

test('buildPeerSummaryRows normal mode with currentIndex >= 0', () => {
  const rows = [];
  buildPeerSummaryRows(rows, {
    peerCount: 3,
    currentIndex: 1,
    peers: [
      { space: 1, layout: 'Layout-A' },
      { space: 1, layout: 'Layout-B' },
      { space: 1, layout: 'Layout-C' },
    ],
  });
  assert.deepEqual(toMap(rows), {
    'peer-instance': '2 / 3',
    'peer-instances': '3',
    'peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});

test('buildPeerSummaryRows normal mode with currentIndex < 0 defaults to index 0', () => {
  const rows = [];
  buildPeerSummaryRows(rows, {
    peerCount: 2,
    currentIndex: -1,
    peers: [
      { space: 1, layout: 'Layout-X' },
      { space: 1, layout: 'Layout-Y' },
    ],
  });
  assert.deepEqual(toMap(rows), {
    'peer-instance': '1 / 2',
    'peer-instances': '2',
    'peer-layouts': 'Paper / Layout-X | Paper / Layout-Y',
    'peer-targets': '1: Paper / Layout-X | 2: Paper / Layout-Y',
  });
});

test('buildPeerSummaryRows released mode with currentIndex >= 0', () => {
  const rows = [];
  buildPeerSummaryRows(rows, {
    peerCount: 3,
    currentIndex: 2,
    peers: [
      { space: 1, layout: 'Layout-A' },
      { space: 1, layout: 'Layout-B' },
      { space: 1, layout: 'Layout-C' },
    ],
  }, { released: true });
  assert.deepEqual(toMap(rows), {
    'released-peer-instance': '3 / 3',
    'released-peer-instances': '3',
    'released-peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'released-peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});

test('buildPeerSummaryRows released mode with currentIndex < 0 uses Archived / N wording', () => {
  const rows = [];
  buildPeerSummaryRows(rows, {
    peerCount: 3,
    currentIndex: -1,
    peers: [
      { space: 1, layout: 'Layout-A' },
      { space: 1, layout: 'Layout-B' },
      { space: 1, layout: 'Layout-C' },
    ],
  }, { released: true });
  assert.deepEqual(toMap(rows), {
    'released-peer-instance': 'Archived / 3',
    'released-peer-instances': '3',
    'released-peer-layouts': 'Paper / Layout-A | Paper / Layout-B | Paper / Layout-C',
    'released-peer-targets': '1: Paper / Layout-A | 2: Paper / Layout-B | 3: Paper / Layout-C',
  });
});
