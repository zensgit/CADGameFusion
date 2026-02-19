const CADGF_ENTITY_TYPES = {
  POLYLINE: 0,
  POINT: 1,
  LINE: 2,
  ARC: 3,
  CIRCLE: 4,
  ELLIPSE: 5,
  SPLINE: 6,
  TEXT: 7,
};

function cloneJson(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isCadgfDocument(payload) {
  if (!isObject(payload)) return false;
  if (typeof payload.cadgf_version !== 'string') return false;
  if (!Number.isFinite(payload.schema_version)) return false;
  if (!Array.isArray(payload.layers)) return false;
  if (!Array.isArray(payload.entities)) return false;
  if (!isObject(payload.metadata)) return false;
  if (!isObject(payload.settings)) return false;
  if (!isObject(payload.feature_flags)) return false;
  return true;
}

function normalizeBoolInt(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return fallback;
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function intToHexColor(colorInt, fallback = '#9ca3af') {
  if (!Number.isFinite(colorInt)) return fallback;
  const value = clampInt(colorInt, 0, 0xffffff);
  return `#${value.toString(16).padStart(6, '0')}`.toLowerCase();
}

function hexToIntColor(hex, fallback = 0x9ca3af) {
  if (typeof hex !== 'string') return fallback;
  const match = hex.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return fallback;
  const value = Number.parseInt(match[1], 16);
  return clampInt(value, 0, 0xffffff);
}

function vec2ToPoint(vec) {
  if (!Array.isArray(vec) || vec.length < 2) return null;
  const x = Number(vec[0]);
  const y = Number(vec[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function pointToVec2(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  return [Number.isFinite(x) ? x : 0, Number.isFinite(y) ? y : 0];
}

function approxEqual(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function approxEqualPoint(a, b, eps = 1e-9) {
  if (!a || !b) return false;
  return approxEqual(a.x, b.x, eps) && approxEqual(a.y, b.y, eps);
}

function coerceId(raw, fallback = 0) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.trunc(value);
}

function makeUnsupportedEntity(rawEntity, { id, layerId, name, color }) {
  return {
    id,
    type: 'unsupported',
    layerId,
    visible: false,
    color,
    name,
    readOnly: true,
    cadgf: cloneJson(rawEntity),
  };
}

export function importCadgfDocument(cadgfJson) {
  if (!isCadgfDocument(cadgfJson)) {
    throw new Error('Not a CADGF Document JSON payload.');
  }

  const warnings = [];
  const baseCadgfJson = cloneJson(cadgfJson);

  const layers = [];
  const layerIndex = new Map();
  let maxLayerId = 0;

  for (const raw of cadgfJson.layers || []) {
    const id = coerceId(raw?.id, 0);
    maxLayerId = Math.max(maxLayerId, id);
    const layer = {
      id,
      name: typeof raw?.name === 'string' ? raw.name : `L${id}`,
      visible: normalizeBoolInt(raw?.visible, true),
      locked: normalizeBoolInt(raw?.locked, false),
      color: intToHexColor(raw?.color, '#9ca3af'),
    };
    layers.push(layer);
    layerIndex.set(id, layer);
  }

  if (!layerIndex.has(0)) {
    const layer0 = {
      id: 0,
      name: '0',
      visible: true,
      locked: false,
      color: '#d0d7de',
    };
    layers.unshift(layer0);
    layerIndex.set(0, layer0);
    maxLayerId = Math.max(maxLayerId, 0);
  }

  const entities = [];
  let maxEntityId = 0;

  for (const raw of cadgfJson.entities || []) {
    const id = coerceId(raw?.id, maxEntityId + 1);
    maxEntityId = Math.max(maxEntityId, id);

    const layerId = coerceId(raw?.layer_id, 0);
    const layer = layerIndex.get(layerId) || layerIndex.get(0) || null;
    const name = typeof raw?.name === 'string' ? raw.name : '';

    const colorSource = typeof raw?.color_source === 'string' ? raw.color_source : '';
    const byLayer = colorSource.toUpperCase() === 'BYLAYER';
    const fallbackColor = layer ? layer.color : '#1f2937';
    const color = byLayer
      ? fallbackColor
      : intToHexColor(raw?.color, fallbackColor);

    if (raw?.type === CADGF_ENTITY_TYPES.LINE) {
      const p0 = vec2ToPoint(raw?.line?.[0]);
      const p1 = vec2ToPoint(raw?.line?.[1]);
      if (!p0 || !p1) {
        warnings.push(`entity:${id} invalid line geometry`);
        entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
        continue;
      }
      entities.push({
        id,
        type: 'line',
        layerId,
        visible: true,
        color,
        name,
        start: p0,
        end: p1,
      });
      continue;
    }

    if (raw?.type === CADGF_ENTITY_TYPES.POLYLINE) {
      const rawPoints = Array.isArray(raw?.polyline) ? raw.polyline : [];
      const points = rawPoints.map(vec2ToPoint).filter(Boolean);
      if (points.length < 2) {
        warnings.push(`entity:${id} invalid polyline geometry`);
        entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
        continue;
      }
      const closed = points.length >= 3 && approxEqualPoint(points[0], points[points.length - 1]);
      const normalizedPoints = closed ? points.slice(0, -1) : points;
      entities.push({
        id,
        type: 'polyline',
        layerId,
        visible: true,
        color,
        name,
        closed,
        points: normalizedPoints,
      });
      continue;
    }

    if (raw?.type === CADGF_ENTITY_TYPES.CIRCLE) {
      const center = vec2ToPoint(raw?.circle?.c);
      const radius = Number(raw?.circle?.r);
      if (!center || !Number.isFinite(radius)) {
        warnings.push(`entity:${id} invalid circle geometry`);
        entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
        continue;
      }
      entities.push({
        id,
        type: 'circle',
        layerId,
        visible: true,
        color,
        name,
        center,
        radius: Math.max(0.001, radius),
      });
      continue;
    }

    if (raw?.type === CADGF_ENTITY_TYPES.ARC) {
      const center = vec2ToPoint(raw?.arc?.c);
      const radius = Number(raw?.arc?.r);
      const a0 = Number(raw?.arc?.a0);
      const a1 = Number(raw?.arc?.a1);
      const cw = normalizeBoolInt(raw?.arc?.cw, false);
      if (!center || !Number.isFinite(radius) || !Number.isFinite(a0) || !Number.isFinite(a1)) {
        warnings.push(`entity:${id} invalid arc geometry`);
        entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
        continue;
      }
      entities.push({
        id,
        type: 'arc',
        layerId,
        visible: true,
        color,
        name,
        center,
        radius: Math.max(0.001, radius),
        startAngle: a0,
        endAngle: a1,
        cw,
      });
      continue;
    }

    if (raw?.type === CADGF_ENTITY_TYPES.TEXT) {
      const pos = vec2ToPoint(raw?.text?.pos);
      const height = Number(raw?.text?.h);
      const rotation = Number(raw?.text?.rot);
      const value = typeof raw?.text?.value === 'string' ? raw.text.value : '';
      if (!pos || !Number.isFinite(height) || !Number.isFinite(rotation)) {
        warnings.push(`entity:${id} invalid text geometry`);
        entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
        continue;
      }
      entities.push({
        id,
        type: 'text',
        layerId,
        visible: true,
        color,
        name,
        position: pos,
        value: value || 'TEXT',
        height: Math.max(0.1, height),
        rotation,
      });
      continue;
    }

    warnings.push(`entity:${id} unsupported cadgf type=${raw?.type}`);
    entities.push(makeUnsupportedEntity(raw, { id, layerId, name, color }));
  }

  const meta = {
    label: typeof cadgfJson.metadata?.label === 'string' ? cadgfJson.metadata.label : '',
    author: typeof cadgfJson.metadata?.author === 'string' ? cadgfJson.metadata.author : '',
    comment: typeof cadgfJson.metadata?.comment === 'string' ? cadgfJson.metadata.comment : '',
    unit: typeof cadgfJson.metadata?.unit_name === 'string' ? cadgfJson.metadata.unit_name : 'mm',
    schema: 'vemcad-web-2d-v1',
  };

  return {
    warnings,
    baseCadgfJson,
    docSnapshot: {
      nextEntityId: maxEntityId + 1,
      nextLayerId: maxLayerId + 1,
      layers,
      entities,
      meta,
    },
  };
}

function ensureCadgfLayer(layer) {
  if (!layer || typeof layer !== 'object') {
    return {
      id: 0,
      name: '0',
      color: 0xffffff,
      visible: 1,
      locked: 0,
      printable: 1,
      frozen: 0,
      construction: 0,
    };
  }
  const cloned = cloneJson(layer);
  return {
    ...cloned,
    id: coerceId(cloned.id, 0),
    name: typeof cloned.name === 'string' ? cloned.name : '0',
    color: clampInt(cloned.color, 0, 0xffffff),
    visible: normalizeBoolInt(cloned.visible, true) ? 1 : 0,
    locked: normalizeBoolInt(cloned.locked, false) ? 1 : 0,
    printable: normalizeBoolInt(cloned.printable, true) ? 1 : 0,
    frozen: normalizeBoolInt(cloned.frozen, false) ? 1 : 0,
    construction: normalizeBoolInt(cloned.construction, false) ? 1 : 0,
  };
}

function ensureCadgfEntityBase(entity, id) {
  const cloned = cloneJson(entity || {});
  const layerId = coerceId(cloned.layer_id, 0);
  const out = {
    ...cloned,
    id,
    type: coerceId(cloned.type, CADGF_ENTITY_TYPES.LINE),
    layer_id: layerId,
    name: typeof cloned.name === 'string' ? cloned.name : '',
    line_type: typeof cloned.line_type === 'string' ? cloned.line_type : 'CONTINUOUS',
    line_type_scale: Number.isFinite(cloned.line_type_scale) ? Number(cloned.line_type_scale) : 1.0,
    color: Number.isFinite(cloned.color) ? clampInt(cloned.color, 0, 0xffffff) : 0,
    color_source: typeof cloned.color_source === 'string' ? cloned.color_source : 'BYLAYER',
    color_aci: Number.isFinite(cloned.color_aci) ? clampInt(cloned.color_aci, 0, 255) : 7,
    space: Object.prototype.hasOwnProperty.call(cloned, 'space') ? cloned.space : 0,
  };

  // Keep optional numeric fields only when valid; avoid emitting `null` which breaks schema validation.
  if (Object.prototype.hasOwnProperty.call(cloned, 'line_weight')) {
    if (Number.isFinite(cloned.line_weight)) {
      out.line_weight = Number(cloned.line_weight);
    } else {
      delete out.line_weight;
    }
  }

  return out;
}

export function exportCadgfDocument(documentState, { baseCadgfJson = null } = {}) {
  const now = new Date().toISOString();
  const base = isCadgfDocument(baseCadgfJson)
    ? cloneJson(baseCadgfJson)
    : {
      document_id: `web-${Date.now()}`,
      cadgf_version: '1.0',
      schema_version: 1,
      feature_flags: { earcut: true, clipper2: true },
      metadata: {
        label: documentState?.meta?.label || '',
        author: documentState?.meta?.author || '',
        company: '',
        comment: documentState?.meta?.comment || '',
        created_at: now,
        modified_at: now,
        unit_name: documentState?.meta?.unit || 'mm',
        meta: {},
      },
      settings: { unit_scale: 1 },
      layers: [],
      entities: [],
    };

  if (base.metadata && typeof base.metadata === 'object') {
    base.metadata.modified_at = now;
    if (!base.metadata.created_at) base.metadata.created_at = now;
    base.metadata.label = documentState?.meta?.label || base.metadata.label || '';
    base.metadata.author = documentState?.meta?.author || base.metadata.author || '';
    base.metadata.comment = documentState?.meta?.comment || base.metadata.comment || '';
    base.metadata.unit_name = documentState?.meta?.unit || base.metadata.unit_name || 'mm';
  }

  const layers = Array.isArray(base.layers) ? base.layers : [];
  const layerById = new Map(layers.map((layer) => [coerceId(layer?.id, 0), layer]));

  const exportedLayers = [];
  for (const layer of documentState.listLayers()) {
    const existing = layerById.get(layer.id);
    const colorInt = hexToIntColor(layer.color, existing?.color ?? 0x9ca3af);
    const patch = {
      id: layer.id,
      name: layer.name,
      color: colorInt,
      visible: layer.visible ? 1 : 0,
      locked: layer.locked ? 1 : 0,
    };
    exportedLayers.push(ensureCadgfLayer({ ...(existing || {}), ...patch }));
    layerById.delete(layer.id);
  }
  for (const layer of layerById.values()) {
    exportedLayers.push(ensureCadgfLayer(layer));
  }
  exportedLayers.sort((a, b) => a.id - b.id);
  base.layers = exportedLayers;

  const baseEntities = Array.isArray(base.entities) ? base.entities : [];
  const baseEntityById = new Map(baseEntities.map((entity) => [coerceId(entity?.id, -1), entity]));

  const outEntities = [];
  for (const entity of documentState.listEntities().slice().sort((a, b) => a.id - b.id)) {
    const id = coerceId(entity?.id, 0);
    const prior = baseEntityById.get(id) || null;

    if (entity.type === 'unsupported' && entity.cadgf) {
      const raw = ensureCadgfEntityBase(entity.cadgf, id);
      outEntities.push(raw);
      continue;
    }

    if (entity.type === 'line') {
      const baseEntity = ensureCadgfEntityBase(prior, id);
      const line = [pointToVec2(entity.start), pointToVec2(entity.end)];
      const patch = {
        type: CADGF_ENTITY_TYPES.LINE,
        layer_id: coerceId(entity.layerId, baseEntity.layer_id),
        name: typeof entity.name === 'string' ? entity.name : baseEntity.name,
        line,
      };
      outEntities.push(ensureCadgfEntityBase({ ...baseEntity, ...patch }, id));
      continue;
    }

    if (entity.type === 'polyline') {
      const baseEntity = ensureCadgfEntityBase(prior, id);
      const points = Array.isArray(entity.points) ? entity.points : [];
      const polyline = points.map(pointToVec2);
      if (entity.closed && points.length >= 2) {
        polyline.push(pointToVec2(points[0]));
      }
      const patch = {
        type: CADGF_ENTITY_TYPES.POLYLINE,
        layer_id: coerceId(entity.layerId, baseEntity.layer_id),
        name: typeof entity.name === 'string' ? entity.name : baseEntity.name,
        polyline,
      };
      outEntities.push(ensureCadgfEntityBase({ ...baseEntity, ...patch }, id));
      continue;
    }

    if (entity.type === 'circle') {
      const baseEntity = ensureCadgfEntityBase(prior, id);
      const patch = {
        type: CADGF_ENTITY_TYPES.CIRCLE,
        layer_id: coerceId(entity.layerId, baseEntity.layer_id),
        name: typeof entity.name === 'string' ? entity.name : baseEntity.name,
        circle: { c: pointToVec2(entity.center), r: Number(entity.radius || 0) },
      };
      outEntities.push(ensureCadgfEntityBase({ ...baseEntity, ...patch }, id));
      continue;
    }

    if (entity.type === 'arc') {
      const baseEntity = ensureCadgfEntityBase(prior, id);
      const patch = {
        type: CADGF_ENTITY_TYPES.ARC,
        layer_id: coerceId(entity.layerId, baseEntity.layer_id),
        name: typeof entity.name === 'string' ? entity.name : baseEntity.name,
        arc: {
          c: pointToVec2(entity.center),
          r: Number(entity.radius || 0),
          a0: Number(entity.startAngle || 0),
          a1: Number(entity.endAngle || 0),
          cw: entity.cw ? 1 : 0,
        },
      };
      outEntities.push(ensureCadgfEntityBase({ ...baseEntity, ...patch }, id));
      continue;
    }

    if (entity.type === 'text') {
      const baseEntity = ensureCadgfEntityBase(prior, id);
      const patch = {
        type: CADGF_ENTITY_TYPES.TEXT,
        layer_id: coerceId(entity.layerId, baseEntity.layer_id),
        name: typeof entity.name === 'string' ? entity.name : baseEntity.name,
        text: {
          pos: pointToVec2(entity.position),
          h: Number(entity.height || 0),
          rot: Number(entity.rotation || 0),
          value: typeof entity.value === 'string' ? entity.value : '',
        },
      };
      outEntities.push(ensureCadgfEntityBase({ ...baseEntity, ...patch }, id));
      continue;
    }

    // Unknown internal types: try passthrough if base exists.
    if (prior) {
      outEntities.push(ensureCadgfEntityBase(prior, id));
    }
  }

  // Ensure stable ordering.
  outEntities.sort((a, b) => a.id - b.id);
  base.entities = outEntities;

  return base;
}
