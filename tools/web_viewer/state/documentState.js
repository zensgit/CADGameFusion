import { SpatialIndex } from './spatialIndex.js';

const DEFAULT_LAYER = {
  id: 0,
  name: '0',
  visible: true,
  locked: false,
  color: '#d0d7de',
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
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { x: 0, y: 0 };
  }
  return { x: Number(point.x), y: Number(point.y) };
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

function normalizeEntityMetadata(raw) {
  const meta = {};
  if (Number.isFinite(raw?.groupId)) meta.groupId = Math.trunc(raw.groupId);
  if (Number.isFinite(raw?.space)) meta.space = Math.trunc(raw.space);
  if (typeof raw?.layout === 'string' && raw.layout.trim()) meta.layout = raw.layout.trim();
  if (typeof raw?.sourceType === 'string' && raw.sourceType.trim()) meta.sourceType = raw.sourceType.trim();
  if (typeof raw?.editMode === 'string' && raw.editMode.trim()) meta.editMode = raw.editMode.trim();
  if (typeof raw?.proxyKind === 'string' && raw.proxyKind.trim()) meta.proxyKind = raw.proxyKind.trim();
  if (typeof raw?.blockName === 'string' && raw.blockName.trim()) meta.blockName = raw.blockName.trim();
  if (typeof raw?.hatchPattern === 'string' && raw.hatchPattern.trim()) meta.hatchPattern = raw.hatchPattern.trim();
  if (Number.isFinite(raw?.hatchId)) meta.hatchId = Math.trunc(raw.hatchId);
  if (typeof raw?.textKind === 'string' && raw.textKind.trim()) meta.textKind = raw.textKind.trim();
  if (typeof raw?.dimStyle === 'string' && raw.dimStyle.trim()) meta.dimStyle = raw.dimStyle.trim();
  if (Number.isFinite(raw?.dimType)) meta.dimType = Math.trunc(raw.dimType);
  if (raw?.dimTextPos && Number.isFinite(raw.dimTextPos.x) && Number.isFinite(raw.dimTextPos.y)) {
    meta.dimTextPos = normalizePoint(raw.dimTextPos);
  }
  if (Number.isFinite(raw?.dimTextRotation)) meta.dimTextRotation = Number(raw.dimTextRotation);
  return meta;
}

function normalizeEntity(raw, id) {
  const type = typeof raw?.type === 'string' ? raw.type : 'line';
  const layerId = Number.isFinite(raw?.layerId) ? Number(raw.layerId) : 0;
  const visible = raw?.visible !== false;
  const color = sanitizeColor(raw?.color || '', '#2c3e50');
  const name = typeof raw?.name === 'string' ? raw.name : '';
  const metadata = normalizeEntityMetadata(raw);

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
      value: typeof raw?.value === 'string' ? raw.value : 'TEXT',
      height,
      rotation,
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
    ...metadata,
  };
}

export class DocumentState extends EventTarget {
  constructor(initial = null) {
    super();
    this.nextEntityId = 1;
    this.nextLayerId = 1;
    this.layers = new Map([[DEFAULT_LAYER.id, cloneJson(DEFAULT_LAYER)]]);
    this.entities = new Map();
    this.spatialIndex = new SpatialIndex({ cellSize: 50 });
    this.meta = {
      label: '',
      author: '',
      comment: '',
      unit: 'mm',
      schema: 'vemcad-web-2d-v1',
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
        },
      }),
    );
  }

  listLayers() {
    return [...this.layers.values()].sort((a, b) => a.id - b.id);
  }

  getLayer(layerId) {
    return this.layers.get(layerId) || null;
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
      color: '#9ca3af',
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
      color: sanitizeColor(color, '#9ca3af'),
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
    if (Object.prototype.hasOwnProperty.call(patch, 'color')) {
      layer.color = sanitizeColor(patch.color, layer.color);
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
      const layer = this.layers.get(entity.layerId);
      if (layer && layer.visible === false) continue;
      out.push(entity);
    }
    out.sort((a, b) => a.id - b.id);
    return out;
  }

  listVisibleEntities() {
    return this.listEntities().filter((entity) => {
      if (entity.visible === false) return false;
      const layer = this.layers.get(entity.layerId);
      if (!layer) return true;
      return layer.visible !== false;
    });
  }

  hasHiddenLayers() {
    for (const layer of this.layers.values()) {
      if (layer?.visible === false) return true;
    }
    return false;
  }

  queryVisibleEntityIdsNearPoint(point, radiusWorld = 1, options = null) {
    const r = Number.isFinite(radiusWorld) ? Math.max(0.001, Number(radiusWorld)) : 1;
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const sortById = options?.sortById !== false;
    const hasHiddenLayers = this.hasHiddenLayers();

    const candidates = this.spatialIndex.queryAabb({ minX: x - r, minY: y - r, maxX: x + r, maxY: y + r });
    if (!hasHiddenLayers) {
      if (sortById && candidates.length > 1) {
        candidates.sort((a, b) => a - b);
      }
      return candidates;
    }
    const out = [];
    for (const id of candidates) {
      const entity = this.entities.get(id);
      if (!entity || entity.visible === false) continue;
      const layer = this.layers.get(entity.layerId);
      if (layer && layer.visible === false) continue;
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
    const hasHiddenLayers = this.hasHiddenLayers();

    const candidates = this.spatialIndex.queryAabb({ minX, minY, maxX, maxY });
    if (!hasHiddenLayers) {
      if (sortById && candidates.length > 1) {
        candidates.sort((a, b) => a - b);
      }
      return candidates;
    }
    const out = [];
    for (const id of candidates) {
      const entity = this.entities.get(id);
      if (!entity || entity.visible === false) continue;
      const layer = this.layers.get(entity.layerId);
      if (layer && layer.visible === false) continue;
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
    const layerId = Number.isFinite(patch?.layerId) ? Number(patch.layerId) : existing.layerId;
    this.ensureLayer(layerId);
    const layer = this.layers.get(layerId);
    if (layer?.locked) {
      return false;
    }
    const merged = { ...existing, ...cloneJson(patch || {}), id, layerId };
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

  snapshot() {
    return {
      nextEntityId: this.nextEntityId,
      nextLayerId: this.nextLayerId,
      layers: cloneJson(this.listLayers()),
      entities: cloneJson(this.listEntities()),
      meta: cloneJson(this.meta),
    };
  }

  restore(snapshot, { silent = false } = {}) {
    const input = snapshot || {};
    this.nextEntityId = Number.isFinite(input.nextEntityId) ? Number(input.nextEntityId) : 1;
    this.nextLayerId = Number.isFinite(input.nextLayerId) ? Number(input.nextLayerId) : 1;

    this.layers.clear();
    this.entities.clear();

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
          color: sanitizeColor(raw?.color, '#9ca3af'),
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
