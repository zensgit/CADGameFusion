import { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';
import { buildSelectionBadges } from './selection_badges.js';
import { buildSelectionDetailFacts, buildMultiSelectionDetailFacts } from './selection_detail_facts.js';

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

export function buildSelectionPresentation(entities, primaryId, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0] || null;
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const primaryLayer = primary ? resolveLayer(getLayer, primary.layerId) : null;
  return {
    mode: list.length === 0 ? 'empty' : (list.length === 1 ? 'single' : 'multiple'),
    entityCount: list.length,
    summaryText: formatSelectionSummary(list),
    statusText: formatSelectionStatus(list, primaryId),
    primary,
    primaryLayer,
    badges: buildSelectionBadges(list, primaryId, options),
    detailFacts: list.length === 1 ? buildSelectionDetailFacts(primary, options) : buildMultiSelectionDetailFacts(list, options),
  };
}
