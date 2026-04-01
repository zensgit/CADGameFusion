import { formatSpaceLabel } from '../space_layout.js';
import {
  isReadOnlySelectionEntity,
  formatSelectionLayer,
  listSelectionLayerFlags,
} from './selection_meta_helpers.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushFact(facts, key, label, value, extra = {}) {
  if (value === null || value === undefined || value === '') return;
  facts.push({
    key,
    label,
    value: String(value),
    ...extra,
  });
}

export function buildSelectionBadges(entities, primaryId, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  if (list.length === 0) return [];
  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0];
  if (!primary) return [];

  const badges = [];
  pushFact(badges, 'type', 'Type', primary.type, { tone: 'type' });

  if (list.length === 1) {
    pushFact(badges, 'layer', 'Layer', formatSelectionLayer(primary, getLayer), { tone: 'layer' });
    pushFact(badges, 'space', 'Space', formatSpaceLabel(primary.space), { tone: 'space' });
    pushFact(badges, 'layout', 'Layout', normalizeText(primary.layout), { tone: 'space' });
    pushFact(badges, 'color-source', 'Color Source', normalizeText(primary.colorSource), { tone: 'provenance' });
    for (const flag of listSelectionLayerFlags(primary, getLayer)) {
      const key = `layer-${flag.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const tone = flag === 'Locked' ? 'warning' : 'state';
      pushFact(badges, key, 'Layer State', flag, { tone });
    }
    if (isReadOnlySelectionEntity(primary)) {
      pushFact(badges, 'read-only', 'Edit', 'read-only', { tone: 'warning' });
    }
    return badges;
  }

  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  if (readOnlyCount > 0) {
    pushFact(badges, 'read-only', 'Edit', `${readOnlyCount} read-only`, { tone: 'warning' });
  }
  return badges;
}
