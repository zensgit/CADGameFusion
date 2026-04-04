import { formatSpaceLabel } from '../space_layout.js';

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  const text = Number(rounded).toFixed(3).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

export function formatPoint(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return '';
  return `${formatCompactNumber(value.x)}, ${formatCompactNumber(value.y)}`;
}

export function formatPeerContext(peer) {
  if (!peer) return '';
  const space = formatSpaceLabel(peer.space);
  const layout = normalizeText(peer.layout);
  return layout ? `${space} / ${layout}` : space;
}

export function formatPeerTarget(peer, index) {
  const context = formatPeerContext(peer);
  if (!context) return '';
  return `${index + 1}: ${context}`;
}
