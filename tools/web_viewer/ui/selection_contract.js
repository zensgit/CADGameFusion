import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import { formatSpaceLabel } from '../space_layout.js';
import {
  describeReadOnlySelectionEntity,
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
} from './selection_meta_helpers.js';
import { formatSelectionSummary } from './selection_overview.js';
import {
  formatReleasedInsertArchiveOrigin,
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

function formatSelectionColor(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effectiveColor = resolveEffectiveEntityColor(entity, layer);
  const parts = [];
  const color = normalizeText(effectiveColor);
  if (color) parts.push(color);
  const colorSource = normalizeText(entity?.colorSource).toUpperCase();
  if (colorSource) {
    parts.push(colorSource);
  } else if (color) {
    parts.push('TRUECOLOR');
  }
  if (Number.isFinite(entity?.colorAci)) {
    parts.push(`ACI ${entity.colorAci}`);
  }
  return parts.join(' | ');
}

function formatSelectionSpace(entity) {
  const parts = [];
  const space = formatSpaceLabel(entity?.space);
  if (space) parts.push(space);
  const layout = normalizeText(entity?.layout);
  if (layout) parts.push(layout);
  return parts.join(' / ');
}

function formatSelectionStyle(entity, getLayer = null) {
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effective = resolveEffectiveEntityStyle(entity, layer);
  const styleSources = resolveEntityStyleSources(entity);
  const parts = [];
  const lineType = normalizeText(effective.lineType).toUpperCase() || 'CONTINUOUS';
  parts.push(`LT ${lineType}`);
  if (styleSources.lineWeightSource === 'EXPLICIT' || (Number.isFinite(effective.lineWeight) && Number(effective.lineWeight) > 0)) {
    parts.push(`LW ${effective.lineWeight}`);
  }
  const lineTypeScale = Number.isFinite(effective.lineTypeScale) ? effective.lineTypeScale : 1;
  parts.push(`LTS ${lineTypeScale}`);
  return parts.join(' | ');
}

export function buildSelectionContract(entities, primaryId = null, options = {}) {
  const list = Array.isArray(entities) ? entities.filter((entity) => !!entity) : [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const releasedInsertArchiveSelection = list.length > 1
    ? summarizeReleasedInsertArchiveSelection(list, options)
    : null;
  if (list.length === 0) {
    return {
      mode: 'none',
      entityCount: 0,
      primaryType: '',
      readOnly: false,
      summaryText: 'No selection',
      rows: [],
      note: 'Select one entity to inspect provenance and style.',
    };
  }

  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0];
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  const summaryText = formatSelectionSummary(list);

  if (!primary) {
    return {
      mode: 'none',
      entityCount: 0,
      primaryType: '',
      readOnly: false,
      summaryText: 'No selection',
      rows: [],
      note: 'Select one entity to inspect provenance and style.',
    };
  }

  if (list.length > 1) {
    const rows = [];
    const typeSummary = [...new Set(list.map((entity) => entity?.type).filter(Boolean))].slice(0, 4).join(' | ');
    if (typeSummary) {
      rows.push({ key: 'types', label: 'Types', value: typeSummary });
    }
    if (readOnlyCount > 0) {
      rows.push({
        key: 'access',
        label: 'Access',
        value: readOnlyCount === list.length ? 'All selected entities are read-only' : `${readOnlyCount} read-only in selection`,
      });
    }
    if (releasedInsertArchiveSelection) {
      rows.push({ key: 'released-from', label: 'Released From', value: formatReleasedInsertArchiveOrigin(releasedInsertArchiveSelection.archive) });
      rows.push({ key: 'released-block-name', label: 'Released Block Name', value: releasedInsertArchiveSelection.archive.blockName });
      rows.push({ key: 'released-group-id', label: 'Released Group ID', value: String(releasedInsertArchiveSelection.archive.groupId) });
    }
    return {
      mode: 'multi',
      entityCount: list.length,
      primaryType: String(primary.type || ''),
      readOnly: readOnlyCount > 0 ? (readOnlyCount === list.length ? 'all' : 'mixed') : false,
      summaryText,
      rows,
      note: 'Single-select to inspect provenance and effective style.',
    };
  }

  const rows = [];
  const origin = describeSelectionOrigin(primary);
  if (origin) rows.push({ key: 'origin', label: 'Origin', value: origin });
  const layer = formatSelectionLayer(primary, getLayer);
  if (layer) rows.push({ key: 'layer', label: 'Layer', value: layer });
  const layerColor = formatSelectionLayerColor(primary, getLayer);
  if (layerColor) rows.push({ key: 'layer-color', label: 'Layer Color', value: layerColor });
  const layerState = formatSelectionLayerState(primary, getLayer);
  if (layerState) rows.push({ key: 'layer-state', label: 'Layer State', value: layerState });
  const color = formatSelectionColor(primary, getLayer);
  if (color) rows.push({ key: 'color', label: 'Color', value: color });
  const space = formatSelectionSpace(primary);
  if (space) rows.push({ key: 'space', label: 'Space', value: space });
  const style = formatSelectionStyle(primary, getLayer);
  if (style) rows.push({ key: 'style', label: 'Style', value: style });
  if (isReadOnlySelectionEntity(primary)) {
    rows.push({ key: 'access', label: 'Access', value: describeReadOnlySelectionEntity(primary) });
  }
  return {
    mode: 'single',
    entityCount: 1,
    primaryType: String(primary.type || ''),
    readOnly: isReadOnlySelectionEntity(primary),
    summaryText,
    rows,
    note: '',
  };
}
