import {
  isReadOnlySelectionEntity,
  describeSelectionOrigin,
} from './selection_presenter.js';

export function formatSelectionSummary(entities) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0) {
    return 'No selection';
  }
  return `${list.length} selected (${list.map((entity) => entity.type).join(', ')})`;
}

export function formatSelectionStatus(entities, primaryId) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0) {
    return 'Selection: none';
  }
  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0];
  if (!primary) {
    return 'Selection: none';
  }
  if (list.length === 1) {
    const detail = describeSelectionOrigin(primary, { separator: ' / ' });
    return detail
      ? `Selection: ${primary.type} | ${detail}`
      : `Selection: ${primary.type}`;
  }
  const typeSummary = [...new Set(list.map((entity) => entity?.type).filter(Boolean))].slice(0, 3).join(',');
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  let summary = `Selection: ${list.length} entities`;
  if (typeSummary) {
    summary += ` | ${typeSummary}`;
  }
  if (readOnlyCount > 0) {
    summary += ` | ${readOnlyCount} read-only`;
  }
  return summary;
}
