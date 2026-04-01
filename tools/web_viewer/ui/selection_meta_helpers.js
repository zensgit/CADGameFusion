function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

export function isReadOnlySelectionEntity(entity) {
  return !!entity && (entity.readOnly === true || entity.type === 'unsupported' || entity.editMode === 'proxy');
}

export function describeReadOnlySelectionEntity(entity) {
  if (!entity) return 'read-only proxy';
  if (entity.type === 'unsupported') return 'unsupported proxy';
  const sourceType = normalizeText(entity.sourceType);
  const proxyKind = normalizeText(entity.proxyKind);
  if (sourceType && proxyKind) return `${sourceType} ${proxyKind} proxy`;
  if (sourceType) return `${sourceType} derived proxy`;
  return 'read-only proxy';
}

export function describeSelectionOrigin(entity, { separator = ' / ', includeReadOnly = false } = {}) {
  if (!entity) return '';
  const sourceType = normalizeText(entity.sourceType);
  const proxyKind = normalizeText(entity.proxyKind);
  const editMode = normalizeText(entity.editMode);
  const parts = [];
  if (sourceType) parts.push(sourceType);
  if (proxyKind) parts.push(proxyKind);
  if (editMode) parts.push(editMode);
  if (includeReadOnly && isReadOnlySelectionEntity(entity) && editMode !== 'proxy') {
    parts.push('read-only');
  }
  return parts.join(separator);
}

export function formatSelectionLayer(entity, getLayer = null) {
  const layerId = Number.isFinite(entity?.layerId) ? Math.trunc(entity.layerId) : null;
  const layer = resolveLayer(getLayer, layerId);
  const name = normalizeText(layer?.name);
  if (layerId === null) return name;
  return name ? `${layerId}:${name}` : String(layerId);
}

export function formatSelectionLayerColor(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  return normalizeText(layer?.color);
}

export function listSelectionLayerFlags(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  if (!layer) return [];
  const flags = [];
  if (layer.visible === false) flags.push('Hidden');
  if (layer.locked === true) flags.push('Locked');
  if (layer.frozen === true) flags.push('Frozen');
  if (layer.printable === false) flags.push('NoPrint');
  if (layer.construction === true) flags.push('Construction');
  return flags;
}

export function formatSelectionLayerFlags(entity, getLayer = null, { separator = ' / ' } = {}) {
  return listSelectionLayerFlags(entity, getLayer).join(separator);
}

export function formatSelectionLayerState(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  if (!layer) return '';
  return [
    layer.visible === false ? 'Hidden' : 'Shown',
    layer.locked === true ? 'Locked' : 'Open',
    layer.frozen === true ? 'Frozen' : 'Live',
    layer.printable === false ? 'NoPrint' : 'Print',
    layer.construction === true ? 'Construction' : 'Normal',
  ].join(' / ');
}
