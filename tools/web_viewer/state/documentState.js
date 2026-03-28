import { SpatialIndex } from './spatialIndex.js';
import {
  listPaperLayoutsFromEntities,
  matchesSpaceLayout,
  normalizeSpaceLayoutContext,
  resolveCurrentSpaceLayoutContext,
} from '../space_layout.js';

const DEFAULT_LAYER = {
  id: 0,
  name: '0',
  visible: true,
  locked: false,
  printable: true,
  frozen: false,
  construction: false,
  color: '#d0d7de',
  lineType: 'CONTINUOUS',
  lineWeight: 0,
};

function cloneJson(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function sanitizeColor(color, fallback = '#d0d7de') {
  if (typeof color !== 'string') return fallback;
  const value = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value.toLowerCase();
  return fallback;
}

function normalizePoint(point) {
  const x = Array.isArray(point) ? Number(point[0]) : Number(point?.x);
  const y = Array.isArray(point) ? Number(point[1]) : Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: 0, y: 0 };
  }
  return { x, y };
}

function hasFinitePoint(point) {
  const x = Array.isArray(point) ? Number(point[0]) : Number(point?.x);
  const y = Array.isArray(point) ? Number(point[1]) : Number(point?.y);
  return Number.isFinite(x) && Number.isFinite(y);
}

function normalizePoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  }
  return points.map((point) => normalizePoint(point));
}

function normalizeDisplayProxy(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = typeof raw.kind === 'string' ? raw.kind.toLowerCase() : '';

  if (kind === 'point') {
    return {
      kind: 'point',
      point: normalizePoint(raw.point),
    };
  }

  if (kind === 'polyline') {
    const points = Array.isArray(raw.points)
      ? raw.points
        .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        .map((point) => normalizePoint(point))
      : [];
    if (points.length < 2) return null;
    return {
      kind: 'polyline',
      points,
    };
  }

  if (kind === 'ellipse') {
    const center = normalizePoint(raw.center);
    const rx = Number(raw.rx);
    const ry = Number(raw.ry);
    const rotation = Number(raw.rotation);
    const startAngle = Number(raw.startAngle);
    const endAngle = Number(raw.endAngle);
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || !Number.isFinite(rotation)
      || !Number.isFinite(startAngle) || !Number.isFinite(endAngle)) {
      return null;
    }
    return {
      kind: 'ellipse',
      center,
      rx: Math.max(0.001, Math.abs(rx)),
      ry: Math.max(0.001, Math.abs(ry)),
      rotation,
      startAngle,
      endAngle,
    };
  }

  return null;
}

function normalizeColorSource(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return normalized === 'BYLAYER'
    || normalized === 'BYBLOCK'
    || normalized === 'INDEX'
    || normalized === 'TRUECOLOR'
    ? normalized
    : '';
}

function normalizeColorAci(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(255, Math.max(0, Math.trunc(value)));
}

function normalizeOptionalBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

function normalizeTextKind(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function deriveLegacyAttdefDefault(raw, meta) {
  const textKind = normalizeTextKind(meta?.textKind ?? raw?.textKind ?? raw?.text_kind);
  if (textKind !== 'attdef') return null;
  if (typeof meta?.attributeDefault === 'string') return meta.attributeDefault;
  if (typeof raw?.attributeDefault === 'string') return raw.attributeDefault;
  if (typeof raw?.attribute_default === 'string') return raw.attribute_default;
  const prompt = typeof meta?.attributePrompt === 'string'
    ? meta.attributePrompt
    : (typeof raw?.attributePrompt === 'string'
        ? raw.attributePrompt
        : (typeof raw?.attribute_prompt === 'string' ? raw.attribute_prompt : ''));
  const rawValue = typeof raw?.value === 'string'
    ? raw.value
    : (typeof raw?.text?.value === 'string' ? raw.text.value : null);
  if (typeof rawValue !== 'string') return null;
  if (prompt) {
    const crlfSuffix = `\r\n${prompt}`;
    if (rawValue.endsWith(crlfSuffix)) {
      return rawValue.slice(0, -crlfSuffix.length);
    }
    const lfSuffix = `\n${prompt}`;
    if (rawValue.endsWith(lfSuffix)) {
      return rawValue.slice(0, -lfSuffix.length);
    }
  }
  return rawValue;
}

function resolveNormalizedTextValue(raw, meta) {
  const attdefDefault = deriveLegacyAttdefDefault(raw, meta);
  if (typeof attdefDefault === 'string') return attdefDefault;
  if (typeof raw?.value === 'string') return raw.value;
  if (typeof raw?.text?.value === 'string') return raw.text.value;
  return 'TEXT';
}

function isInsertTextProxyMetadata(meta) {
  return String(meta?.sourceType || '').trim().toUpperCase() === 'INSERT'
    && String(meta?.editMode || '').trim().toLowerCase() === 'proxy'
    && String(meta?.proxyKind || '').trim().toLowerCase() === 'text'
    && normalizeTextKind(meta?.textKind) !== '';
}

function resolveNormalizedEntityVisible(raw, meta, fallback = true) {
  if (Object.prototype.hasOwnProperty.call(raw || {}, 'visible')) {
    return raw?.visible !== false;
  }
  if (isInsertTextProxyMetadata(meta) && meta?.attributeInvisible === true) {
    return false;
  }
  return fallback;
}

function normalizeEntityMetadata(raw) {
  const meta = {};
  if (raw?.releasedInsertArchive && typeof raw.releasedInsertArchive === 'object') {
    meta.releasedInsertArchive = cloneJson(raw.releasedInsertArchive);
  } else if (raw?.released_insert_archive && typeof raw.released_insert_archive === 'object') {
    meta.releasedInsertArchive = cloneJson(raw.released_insert_archive);
  }
  if (Number.isFinite(raw?.groupId)) meta.groupId = Math.trunc(raw.groupId);
  if (Number.isFinite(raw?.space)) meta.space = Math.trunc(raw.space);
  if (typeof raw?.layout === 'string' && raw.layout.trim()) meta.layout = raw.layout.trim();
  const colorSource = normalizeColorSource(raw?.colorSource ?? raw?.color_source);
  if (colorSource) meta.colorSource = colorSource;
  const colorAci = normalizeColorAci(raw?.colorAci ?? raw?.color_aci);
  if (colorAci !== null) meta.colorAci = colorAci;
  if (typeof raw?.sourceType === 'string' && raw.sourceType.trim()) meta.sourceType = raw.sourceType.trim();
  if (typeof raw?.editMode === 'string' && raw.editMode.trim()) meta.editMode = raw.editMode.trim();
  if (typeof raw?.proxyKind === 'string' && raw.proxyKind.trim()) meta.proxyKind = raw.proxyKind.trim();
  if (typeof raw?.blockName === 'string' && raw.blockName.trim()) meta.blockName = raw.blockName.trim();
  if (typeof raw?.hatchPattern === 'string' && raw.hatchPattern.trim()) meta.hatchPattern = raw.hatchPattern.trim();
  if (Number.isFinite(raw?.hatchId)) meta.hatchId = Math.trunc(raw.hatchId);
  if (Number.isFinite(raw?.sourceBundleId)) meta.sourceBundleId = Math.trunc(raw.sourceBundleId);
  else if (Number.isFinite(raw?.source_bundle_id)) meta.sourceBundleId = Math.trunc(raw.source_bundle_id);
  if (typeof raw?.textKind === 'string' && raw.textKind.trim()) meta.textKind = raw.textKind.trim();
  else if (typeof raw?.text_kind === 'string' && raw.text_kind.trim()) meta.textKind = raw.text_kind.trim();
  if (typeof raw?.attributeTag === 'string' && raw.attributeTag.trim()) meta.attributeTag = raw.attributeTag.trim();
  else if (typeof raw?.attribute_tag === 'string' && raw.attribute_tag.trim()) meta.attributeTag = raw.attribute_tag.trim();
  if (typeof raw?.attributeDefault === 'string') meta.attributeDefault = raw.attributeDefault;
  else if (typeof raw?.attribute_default === 'string') meta.attributeDefault = raw.attribute_default;
  if (typeof raw?.attributePrompt === 'string') meta.attributePrompt = raw.attributePrompt;
  else if (typeof raw?.attribute_prompt === 'string') meta.attributePrompt = raw.attribute_prompt;
  const legacyAttdefDefault = deriveLegacyAttdefDefault(raw, meta);
  if (typeof meta.attributeDefault !== 'string' && typeof legacyAttdefDefault === 'string') {
    meta.attributeDefault = legacyAttdefDefault;
  }
  if (Number.isFinite(raw?.attributeFlags)) meta.attributeFlags = Math.trunc(raw.attributeFlags);
  else if (Number.isFinite(raw?.attribute_flags)) meta.attributeFlags = Math.trunc(raw.attribute_flags);
  const attributeInvisible = normalizeOptionalBool(raw?.attributeInvisible ?? raw?.attribute_invisible);
  const attributeConstant = normalizeOptionalBool(raw?.attributeConstant ?? raw?.attribute_constant);
  const attributeVerify = normalizeOptionalBool(raw?.attributeVerify ?? raw?.attribute_verify);
  const attributePreset = normalizeOptionalBool(raw?.attributePreset ?? raw?.attribute_preset);
  const attributeLockPosition = normalizeOptionalBool(raw?.attributeLockPosition ?? raw?.attribute_lock_position);
  if (attributeInvisible !== null) meta.attributeInvisible = attributeInvisible;
  if (attributeConstant !== null) meta.attributeConstant = attributeConstant;
  if (attributeVerify !== null) meta.attributeVerify = attributeVerify;
  if (attributePreset !== null) meta.attributePreset = attributePreset;
  if (attributeLockPosition !== null) meta.attributeLockPosition = attributeLockPosition;
  if (typeof raw?.dimStyle === 'string' && raw.dimStyle.trim()) meta.dimStyle = raw.dimStyle.trim();
  if (Number.isFinite(raw?.dimType)) meta.dimType = Math.trunc(raw.dimType);
  if (Number.isFinite(meta.attributeFlags)) {
    if (typeof meta.attributeInvisible !== 'boolean') meta.attributeInvisible = (meta.attributeFlags & 1) !== 0;
    if (typeof meta.attributeConstant !== 'boolean') meta.attributeConstant = (meta.attributeFlags & 2) !== 0;
    if (typeof meta.attributeVerify !== 'boolean') meta.attributeVerify = (meta.attributeFlags & 4) !== 0;
    if (typeof meta.attributePreset !== 'boolean') meta.attributePreset = (meta.attributeFlags & 8) !== 0;
    if (typeof meta.attributeLockPosition !== 'boolean') meta.attributeLockPosition = (meta.attributeFlags & 16) !== 0;
  }
  if (raw?.sourceTextPos && Number.isFinite(raw.sourceTextPos.x) && Number.isFinite(raw.sourceTextPos.y)) {
    meta.sourceTextPos = normalizePoint(raw.sourceTextPos);
  } else if (raw?.source_text_pos && Number.isFinite(raw.source_text_pos.x) && Number.isFinite(raw.source_text_pos.y)) {
    meta.sourceTextPos = normalizePoint(raw.source_text_pos);
  }
  if (Number.isFinite(raw?.sourceTextRotation)) meta.sourceTextRotation = Number(raw.sourceTextRotation);
  else if (Number.isFinite(raw?.source_text_rotation)) meta.sourceTextRotation = Number(raw.source_text_rotation);
  if (raw?.dimTextPos && Number.isFinite(raw.dimTextPos.x) && Number.isFinite(raw.dimTextPos.y)) {
    meta.dimTextPos = normalizePoint(raw.dimTextPos);
  }
  if (Number.isFinite(raw?.dimTextRotation)) meta.dimTextRotation = Number(raw.dimTextRotation);
  if (hasFinitePoint(raw?.sourceAnchor)) {
    meta.sourceAnchor = normalizePoint(raw.sourceAnchor);
  } else if (hasFinitePoint(raw?.source_anchor)) {
    meta.sourceAnchor = normalizePoint(raw.source_anchor);
  }
  if (hasFinitePoint(raw?.leaderLanding)) {
    meta.leaderLanding = normalizePoint(raw.leaderLanding);
  } else if (hasFinitePoint(raw?.leader_landing)) {
    meta.leaderLanding = normalizePoint(raw.leader_landing);
  }
  if (hasFinitePoint(raw?.leaderElbow)) {
    meta.leaderElbow = normalizePoint(raw.leaderElbow);
  } else if (hasFinitePoint(raw?.leader_elbow)) {
    meta.leaderElbow = normalizePoint(raw.leader_elbow);
  }
  if (Number.isFinite(raw?.sourceAnchorDriverId)) {
    meta.sourceAnchorDriverId = Math.trunc(raw.sourceAnchorDriverId);
  } else if (Number.isFinite(raw?.source_anchor_driver_id)) {
    meta.sourceAnchorDriverId = Math.trunc(raw.source_anchor_driver_id);
  }
  if (typeof raw?.sourceAnchorDriverType === 'string' && raw.sourceAnchorDriverType.trim()) {
    meta.sourceAnchorDriverType = raw.sourceAnchorDriverType.trim();
  } else if (typeof raw?.source_anchor_driver_type === 'string' && raw.source_anchor_driver_type.trim()) {
    meta.sourceAnchorDriverType = raw.source_anchor_driver_type.trim();
  }
  if (typeof raw?.sourceAnchorDriverKind === 'string' && raw.sourceAnchorDriverKind.trim()) {
    meta.sourceAnchorDriverKind = raw.sourceAnchorDriverKind.trim();
  } else if (typeof raw?.source_anchor_driver_kind === 'string' && raw.source_anchor_driver_kind.trim()) {
    meta.sourceAnchorDriverKind = raw.source_anchor_driver_kind.trim();
  }
  const sourceType = typeof meta.sourceType === 'string' ? meta.sourceType.trim().toUpperCase() : '';
  const editMode = typeof meta.editMode === 'string' ? meta.editMode.trim().toLowerCase() : '';
  if (sourceType && editMode === 'proxy' && raw?.type === 'text') {
    if (!meta.sourceTextPos && raw?.position && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y)) {
      meta.sourceTextPos = normalizePoint(raw.position);
    }
    if (!Number.isFinite(meta.sourceTextRotation) && Number.isFinite(raw?.rotation)) {
      meta.sourceTextRotation = Number(raw.rotation);
    }
    if (sourceType === 'DIMENSION') {
      if (!meta.sourceTextPos && raw?.dimTextPos && Number.isFinite(raw.dimTextPos.x) && Number.isFinite(raw.dimTextPos.y)) {
        meta.sourceTextPos = normalizePoint(raw.dimTextPos);
      }
      if (!Number.isFinite(meta.sourceTextRotation) && Number.isFinite(raw?.dimTextRotation)) {
        meta.sourceTextRotation = Number(raw.dimTextRotation);
      }
    }
  }
  return meta;
}

function normalizeEntityStyle(raw) {
  const style = {
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineWeightSource: 'BYLAYER',
    lineTypeScale: 1,
    lineTypeScaleSource: 'DEFAULT',
  };
  if (typeof raw?.lineType === 'string' && raw.lineType.trim()) {
    style.lineType = raw.lineType.trim().toUpperCase();
  } else if (typeof raw?.line_type === 'string' && raw.line_type.trim()) {
    style.lineType = raw.line_type.trim().toUpperCase();
  }
  if (Number.isFinite(raw?.lineWeight)) {
    style.lineWeight = Math.max(0, Number(raw.lineWeight));
  } else if (Number.isFinite(raw?.line_weight)) {
    style.lineWeight = Math.max(0, Number(raw.line_weight));
  }
  const rawLineWeightSource = typeof raw?.lineWeightSource === 'string'
    ? raw.lineWeightSource
    : raw?.line_weight_source;
  if (typeof rawLineWeightSource === 'string' && rawLineWeightSource.trim()) {
    const normalizedSource = rawLineWeightSource.trim().toUpperCase();
    style.lineWeightSource = normalizedSource === 'EXPLICIT' ? 'EXPLICIT' : 'BYLAYER';
  } else if (
    Object.prototype.hasOwnProperty.call(raw || {}, 'lineWeight')
    || Object.prototype.hasOwnProperty.call(raw || {}, 'line_weight')
  ) {
    style.lineWeightSource = 'EXPLICIT';
  }
  if (Number.isFinite(raw?.lineTypeScale)) {
    style.lineTypeScale = Math.max(0, Number(raw.lineTypeScale));
  } else if (Number.isFinite(raw?.line_type_scale)) {
    style.lineTypeScale = Math.max(0, Number(raw.line_type_scale));
  }
  const rawSource = typeof raw?.lineTypeScaleSource === 'string'
    ? raw.lineTypeScaleSource
    : raw?.line_type_scale_source;
  if (typeof rawSource === 'string' && rawSource.trim()) {
    const normalizedSource = rawSource.trim().toUpperCase();
    style.lineTypeScaleSource = normalizedSource === 'EXPLICIT' ? 'EXPLICIT' : 'DEFAULT';
  } else if (
    Object.prototype.hasOwnProperty.call(raw || {}, 'lineTypeScale')
    || Object.prototype.hasOwnProperty.call(raw || {}, 'line_type_scale')
  ) {
    style.lineTypeScaleSource = 'EXPLICIT';
  }
  return style;
}

function normalizeEntity(raw, id) {
  const type = typeof raw?.type === 'string' ? raw.type : 'line';
  const layerId = Number.isFinite(raw?.layerId) ? Number(raw.layerId) : 0;
  const color = sanitizeColor(raw?.color || '', '#2c3e50');
  const name = typeof raw?.name === 'string' ? raw.name : '';
  const metadata = normalizeEntityMetadata(raw);
  const visible = resolveNormalizedEntityVisible(raw, metadata, true);
  const style = normalizeEntityStyle(raw);

  if (type === 'unsupported') {
    const displayProxy = normalizeDisplayProxy(raw?.display_proxy);
    const explicitVisible = raw?.visible;
    return {
      id,
      type,
      layerId,
      // Unsupported placeholders are visible by default when a proxy exists unless caller overrides.
      visible: typeof explicitVisible === 'boolean' ? explicitVisible : !!displayProxy,
      color,
      name,
      readOnly: raw?.readOnly === true,
      display_proxy: displayProxy,
      cadgf: raw?.cadgf ? cloneJson(raw.cadgf) : null,
      ...style,
      ...metadata,
    };
  }

  if (type === 'line') {
    return {
      id,
      type,
      layerId,
      visible,
      color,
      name,
      start: normalizePoint(raw?.start),
      end: normalizePoint(raw?.end),
      ...style,
      ...metadata,
    };
  }

  if (type === 'polyline') {
    return {
      id,
      type,
      layerId,
      visible,
      color,
      name,
      closed: raw?.closed === true,
      points: normalizePoints(raw?.points),
      ...style,
      ...metadata,
    };
  }

  if (type === 'circle') {
    const radius = Number.isFinite(raw?.radius) ? Math.max(0.001, Number(raw.radius)) : 1;
    return {
      id,
      type,
      layerId,
      visible,
      color,
      name,
      center: normalizePoint(raw?.center),
      radius,
      ...style,
      ...metadata,
    };
  }

  if (type === 'arc') {
    const radius = Number.isFinite(raw?.radius) ? Math.max(0.001, Number(raw.radius)) : 1;
    const startAngle = Number.isFinite(raw?.startAngle) ? Number(raw.startAngle) : 0;
    const endAngle = Number.isFinite(raw?.endAngle) ? Number(raw.endAngle) : Math.PI / 2;
    return {
      id,
      type,
      layerId,
      visible,
      color,
      name,
      center: normalizePoint(raw?.center),
      radius,
      startAngle,
      endAngle,
      cw: raw?.cw === true,
      ...style,
      ...metadata,
    };
  }

  if (type === 'text') {
    const height = Number.isFinite(raw?.height) ? Math.max(0.1, Number(raw.height)) : 2.5;
    const rotation = Number.isFinite(raw?.rotation) ? Number(raw.rotation) : 0;
    return {
      id,
      type,
      layerId,
      visible,
      color,
      name,
      position: normalizePoint(raw?.position),
      value: resolveNormalizedTextValue(raw, metadata),
      height,
      rotation,
      ...style,
      ...metadata,
    };
  }

  return {
    id,
    type: 'line',
    layerId,
    visible,
    color,
    name,
    start: { x: 0, y: 0 },
    end: { x: 10, y: 0 },
    ...style,
    ...metadata,
  };
}

function normalizeConstraint(raw, id) {
  const type = typeof raw?.type === 'string' ? raw.type : '';
  const refs = Array.isArray(raw?.refs) ? raw.refs.filter((r) => typeof r === 'string') : [];
  const constraint = { id, type, refs };
  if (raw?.value !== undefined && raw?.value !== null && Number.isFinite(Number(raw.value))) {
    constraint.value = Number(raw.value);
  }
  return constraint;
}

export class DocumentState extends EventTarget {
  constructor(initial = null) {
    super();
    this.nextEntityId = 1;
    this.nextLayerId = 1;
    this.nextConstraintId = 1;
    this.layers = new Map([[DEFAULT_LAYER.id, cloneJson(DEFAULT_LAYER)]]);
    this.entities = new Map();
    this.constraints = new Map();
    this.spatialIndex = new SpatialIndex({ cellSize: 50 });
    this.meta = {
      label: '',
      author: '',
      comment: '',
      unit: 'mm',
      schema: 'vemcad-web-2d-v1',
      currentSpace: 0,
      currentLayout: 'Model',
    };

    if (initial) {
      this.importJSON(initial, { silent: true });
    }
  }

  emitChange(reason, payload = {}) {
    this.dispatchEvent(
      new CustomEvent('change', {
        detail: {
          reason,
          payload,
          entityCount: this.entities.size,
          layerCount: this.layers.size,
          constraintCount: this.constraints.size,
        },
      }),
    );
  }

  listLayers() {
    return [...this.layers.values()].sort((a, b) => a.id - b.id);
  }

  isLayerRenderable(layerOrId) {
    const layer = typeof layerOrId === 'object' && layerOrId
      ? layerOrId
      : this.layers.get(Number(layerOrId));
    if (!layer) return true;
    return layer.visible !== false && layer.frozen !== true;
  }

  isEntityRenderable(entityOrId) {
    const entity = typeof entityOrId === 'object' && entityOrId
      ? entityOrId
      : this.entities.get(Number(entityOrId));
    if (!entity || entity.visible === false) return false;
    if (!this.isLayerRenderable(entity.layerId)) return false;
    return matchesSpaceLayout(entity, this.getCurrentSpaceContext());
  }

  getLayer(layerId) {
    return this.layers.get(layerId) || null;
  }

  getCurrentSpaceContext() {
    return normalizeSpaceLayoutContext({
      space: this.meta?.currentSpace,
      layout: this.meta?.currentLayout,
    }, resolveCurrentSpaceLayoutContext(this.listEntities()));
  }

  setCurrentSpaceContext(context, { silent = false } = {}) {
    const next = resolveCurrentSpaceLayoutContext(this.listEntities(), context);
    const current = this.getCurrentSpaceContext();
    if (current.space === next.space && current.layout === next.layout) {
      return false;
    }
    this.meta.currentSpace = next.space;
    this.meta.currentLayout = next.layout;
    if (!silent) {
      this.emitChange('space-layout-context', { context: next });
    }
    return true;
  }

  listPaperLayouts() {
    return listPaperLayoutsFromEntities(this.listEntities());
  }

  ensureLayer(layerId) {
    if (this.layers.has(layerId)) {
      return this.layers.get(layerId);
    }
    const fallback = {
      id: layerId,
      name: `L${layerId}`,
      visible: true,
      locked: false,
      printable: true,
      frozen: false,
      construction: false,
      color: '#9ca3af',
      lineType: 'CONTINUOUS',
      lineWeight: 0,
    };
    this.layers.set(layerId, fallback);
    if (layerId >= this.nextLayerId) {
      this.nextLayerId = layerId + 1;
    }
    this.emitChange('layer-upsert', { layerId });
    return fallback;
  }

  addLayer(name, color = '#9ca3af') {
    const id = this.nextLayerId;
    this.nextLayerId += 1;
    const layer = {
      id,
      name: (name || `Layer-${id}`).trim() || `Layer-${id}`,
      visible: true,
      locked: false,
      printable: true,
      frozen: false,
      construction: false,
      color: sanitizeColor(color, '#9ca3af'),
      lineType: 'CONTINUOUS',
      lineWeight: 0,
    };
    this.layers.set(id, layer);
    this.emitChange('layer-add', { layerId: id });
    return layer;
  }

  updateLayer(layerId, patch) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      return false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
      layer.name = String(patch.name || '').trim() || layer.name;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'visible')) {
      layer.visible = patch.visible !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'locked')) {
      layer.locked = patch.locked === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'printable')) {
      layer.printable = patch.printable !== false;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'frozen')) {
      layer.frozen = patch.frozen === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'construction')) {
      layer.construction = patch.construction === true;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'color')) {
      layer.color = sanitizeColor(patch.color, layer.color);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lineType')) {
      const value = typeof patch.lineType === 'string' ? patch.lineType.trim().toUpperCase() : '';
      layer.lineType = value || 'CONTINUOUS';
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'lineWeight')) {
      layer.lineWeight = Number.isFinite(patch.lineWeight) ? Math.max(0, Number(patch.lineWeight)) : layer.lineWeight;
    }
    this.emitChange('layer-update', { layerId });
    return true;
  }

  getEntity(id) {
    return this.entities.get(id) || null;
  }

  listEntities() {
    return [...this.entities.values()];
  }

  listDisplayProxyEntities() {
    const out = [];
    for (const entity of this.entities.values()) {
      if (!entity || entity.type !== 'unsupported' || !entity.display_proxy) continue;
      if (!this.isEntityRenderable(entity)) continue;
      out.push(entity);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  listVisibleEntities() {
    return this.listEntities().filter((entity) => this.isEntityRenderable(entity));
  }

  hasHiddenLayers() {
    for (const layer of this.layers.values()) {
      if (layer?.visible === false || layer?.frozen === true) return true;
    }
    return false;
  }

  queryVisibleEntityIdsNearPoint(point, radiusWorld = 1, options = null) {
    const r = Number.isFinite(radiusWorld) ? Math.max(0.001, Number(radiusWorld)) : 1;
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const sortById = options?.sortById !== false;
    const candidates = this.spatialIndex.queryAabb({ minX: x - r, minY: y - r, maxX: x + r, maxY: y + r });
    const out = [];
    for (const id of candidates) {
      const entity = this.entities.get(id);
      if (!this.isEntityRenderable(entity)) continue;
      out.push(id);
    }
    if (sortById && out.length > 1) {
      out.sort((a, b) => a - b);
    }
    return out;
  }

  queryVisibleEntityIdsInRect(rect, options = null) {
    if (!rect) return [];
    const minX = Math.min(Number(rect.x0), Number(rect.x1));
    const maxX = Math.max(Number(rect.x0), Number(rect.x1));
    const minY = Math.min(Number(rect.y0), Number(rect.y1));
    const maxY = Math.max(Number(rect.y0), Number(rect.y1));
    if (![minX, maxX, minY, maxY].every(Number.isFinite)) return [];
    const sortById = options?.sortById !== false;
    const candidates = this.spatialIndex.queryAabb({ minX, minY, maxX, maxY });
    const out = [];
    for (const id of candidates) {
      const entity = this.entities.get(id);
      if (!this.isEntityRenderable(entity)) continue;
      out.push(id);
    }
    if (sortById && out.length > 1) {
      out.sort((a, b) => a - b);
    }
    return out;
  }

  addEntity(raw) {
    const id = Number.isFinite(raw?.id) ? Number(raw.id) : this.nextEntityId;
    const entity = normalizeEntity(raw, id);
    this.ensureLayer(entity.layerId);
    const layer = this.layers.get(entity.layerId);
    if (layer?.locked) {
      return null;
    }
    this.entities.set(id, entity);
    this.spatialIndex.upsert(entity);
    if (id >= this.nextEntityId) {
      this.nextEntityId = id + 1;
    }
    this.emitChange('entity-add', { entityId: id, entity });
    return entity;
  }

  addEntities(entities) {
    const created = [];
    for (const raw of entities || []) {
      const entity = this.addEntity(raw);
      if (entity) {
        created.push(entity);
      }
    }
    return created;
  }

  updateEntity(id, patch) {
    const existing = this.entities.get(id);
    if (!existing) {
      return false;
    }
    const currentLayer = this.layers.get(existing.layerId);
    const layerId = Number.isFinite(patch?.layerId) ? Number(patch.layerId) : existing.layerId;
    this.ensureLayer(layerId);
    const layer = this.layers.get(layerId);
    if (currentLayer?.locked || layer?.locked) {
      return false;
    }
    const normalizedPatch = cloneJson(patch || {});
    if (
      Object.prototype.hasOwnProperty.call(normalizedPatch, 'lineWeight')
      && !Object.prototype.hasOwnProperty.call(normalizedPatch, 'lineWeightSource')
    ) {
      normalizedPatch.lineWeightSource = 'EXPLICIT';
    }
    if (
      Object.prototype.hasOwnProperty.call(normalizedPatch, 'lineTypeScale')
      && !Object.prototype.hasOwnProperty.call(normalizedPatch, 'lineTypeScaleSource')
    ) {
      normalizedPatch.lineTypeScaleSource = 'EXPLICIT';
    }
    const merged = { ...existing, ...normalizedPatch, id, layerId };
    const normalized = normalizeEntity(merged, id);
    this.entities.set(id, normalized);
    this.spatialIndex.upsert(normalized);
    this.emitChange('entity-update', { entityId: id, entity: normalized });
    return true;
  }

  updateEntities(ids, updater) {
    let changed = false;
    for (const id of ids || []) {
      const entity = this.entities.get(id);
      if (!entity) continue;
      const patch = updater(cloneJson(entity));
      if (!patch) continue;
      if (this.updateEntity(id, patch)) {
        changed = true;
      }
    }
    return changed;
  }

  removeEntity(id) {
    if (!this.entities.has(id)) {
      return null;
    }
    const entity = this.entities.get(id);
    this.entities.delete(id);
    this.spatialIndex.remove(id);
    this.emitChange('entity-remove', { entityId: id });
    return entity;
  }

  removeEntities(ids) {
    const removed = [];
    for (const id of ids || []) {
      const entity = this.removeEntity(id);
      if (entity) {
        removed.push(entity);
      }
    }
    return removed;
  }

  clearEntities() {
    if (this.entities.size === 0) {
      return;
    }
    this.entities.clear();
    this.spatialIndex.clear();
    this.emitChange('entity-clear');
  }

  // --- Constraint CRUD ---

  getConstraint(id) {
    return this.constraints.get(id) || null;
  }

  listConstraints() {
    return [...this.constraints.values()];
  }

  addConstraint(raw) {
    const id = typeof raw?.id === 'string' ? raw.id : `c${this.nextConstraintId}`;
    const constraint = normalizeConstraint(raw, id);
    this.constraints.set(id, constraint);
    const numericId = parseInt(id.replace(/\D/g, ''), 10);
    if (Number.isFinite(numericId) && numericId >= this.nextConstraintId) {
      this.nextConstraintId = numericId + 1;
    }
    this.emitChange('constraint-add', { constraintId: id, constraint });
    return constraint;
  }

  removeConstraint(id) {
    if (!this.constraints.has(id)) {
      return null;
    }
    const constraint = this.constraints.get(id);
    this.constraints.delete(id);
    this.emitChange('constraint-remove', { constraintId: id });
    return constraint;
  }

  clearConstraints() {
    if (this.constraints.size === 0) {
      return;
    }
    this.constraints.clear();
    this.emitChange('constraint-clear');
  }

  // P3.3: Constraint visualization hints
  getConstraintVisualHints() {
    const hints = [];
    for (const c of this.listConstraints()) {
      if (!c || !Array.isArray(c.refs) || c.refs.length < 2) continue;
      const hint = { id: c.id, type: c.type, refs: c.refs, points: [] };
      // Resolve ref pairs to screen-space points for rendering
      for (let i = 0; i + 1 < c.refs.length; i += 2) {
        const refX = c.refs[i];
        const refY = c.refs[i + 1];
        if (typeof refX !== 'string' || typeof refY !== 'string') continue;
        const matchX = refX.match(/^(\d+)\.(.*)/);
        const matchY = refY.match(/^(\d+)\.(.*)/);
        if (!matchX || !matchY) continue;
        const entityId = Number(matchX[1]);
        const entity = this.getEntity(entityId);
        if (!entity) continue;
        // Extract coordinate value from entity based on param name
        const paramX = matchX[2];
        const paramY = matchY[2];
        let x = null, y = null;
        if (entity.type === 'line') {
          if (paramX === 'start_x' || paramX === 'x') x = entity.start?.x;
          if (paramX === 'end_x') x = entity.end?.x;
          if (paramY === 'start_y' || paramY === 'y') y = entity.start?.y;
          if (paramY === 'end_y') y = entity.end?.y;
        } else if (entity.type === 'arc' || entity.type === 'circle') {
          if (paramX === 'cx') x = entity.center?.x;
          if (paramY === 'cy') y = entity.center?.y;
        }
        if (Number.isFinite(x) && Number.isFinite(y)) {
          hint.points.push({ x, y, entityId });
        }
      }
      if (hint.points.length > 0) hints.push(hint);
    }
    return hints;
  }

  snapshot() {
    return {
      nextEntityId: this.nextEntityId,
      nextLayerId: this.nextLayerId,
      nextConstraintId: this.nextConstraintId,
      layers: cloneJson(this.listLayers()),
      entities: cloneJson(this.listEntities()),
      constraints: cloneJson(this.listConstraints()),
      meta: cloneJson(this.meta),
    };
  }

  restore(snapshot, { silent = false } = {}) {
    const input = snapshot || {};
    this.nextEntityId = Number.isFinite(input.nextEntityId) ? Number(input.nextEntityId) : 1;
    this.nextLayerId = Number.isFinite(input.nextLayerId) ? Number(input.nextLayerId) : 1;
    this.nextConstraintId = Number.isFinite(input.nextConstraintId) ? Number(input.nextConstraintId) : 1;

    this.layers.clear();
    this.entities.clear();
    this.constraints.clear();

    const incomingLayers = Array.isArray(input.layers) ? input.layers : [];
    if (incomingLayers.length === 0) {
      this.layers.set(DEFAULT_LAYER.id, cloneJson(DEFAULT_LAYER));
    } else {
      for (const raw of incomingLayers) {
        const id = Number.isFinite(raw?.id) ? Number(raw.id) : this.nextLayerId;
        const layer = {
          id,
          name: String(raw?.name || `L${id}`),
          visible: raw?.visible !== false,
          locked: raw?.locked === true,
          printable: raw?.printable !== false,
          frozen: raw?.frozen === true,
          construction: raw?.construction === true,
          color: sanitizeColor(raw?.color, '#9ca3af'),
          lineType: typeof raw?.lineType === 'string' && raw.lineType.trim()
            ? raw.lineType.trim().toUpperCase()
            : (typeof raw?.line_type === 'string' && raw.line_type.trim() ? raw.line_type.trim().toUpperCase() : 'CONTINUOUS'),
          lineWeight: Number.isFinite(raw?.lineWeight)
            ? Math.max(0, Number(raw.lineWeight))
            : (Number.isFinite(raw?.line_weight) ? Math.max(0, Number(raw.line_weight)) : 0),
        };
        this.layers.set(id, layer);
        if (id >= this.nextLayerId) {
          this.nextLayerId = id + 1;
        }
      }
    }

    const incomingEntities = Array.isArray(input.entities) ? input.entities : [];
    for (const raw of incomingEntities) {
      const id = Number.isFinite(raw?.id) ? Number(raw.id) : this.nextEntityId;
      const entity = normalizeEntity(raw, id);
      this.entities.set(id, entity);
      if (id >= this.nextEntityId) {
        this.nextEntityId = id + 1;
      }
      this.ensureLayer(entity.layerId);
    }
    this.spatialIndex.rebuild(this.listEntities());

    const incomingConstraints = Array.isArray(input.constraints) ? input.constraints : [];
    for (const raw of incomingConstraints) {
      const id = typeof raw?.id === 'string' ? raw.id : `c${this.nextConstraintId}`;
      const constraint = normalizeConstraint(raw, id);
      this.constraints.set(id, constraint);
      const numericId = parseInt(id.replace(/\D/g, ''), 10);
      if (Number.isFinite(numericId) && numericId >= this.nextConstraintId) {
        this.nextConstraintId = numericId + 1;
      }
    }

    this.meta = {
      ...this.meta,
      ...(input.meta && typeof input.meta === 'object' ? input.meta : {}),
    };

    if (!silent) {
      this.emitChange('restore');
    }
  }

  exportJSON() {
    return {
      schema: 'vemcad-web-2d-v1',
      generated_at: new Date().toISOString(),
      ...this.snapshot(),
    };
  }

  importJSON(data, { silent = false } = {}) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid document JSON payload.');
    }
    this.restore(data, { silent });
  }
}

export function cloneEntity(entity) {
  return cloneJson(entity);
}

export function cloneSnapshot(snapshot) {
  return cloneJson(snapshot);
}
