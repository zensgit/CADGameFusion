import {
  collectSnapCandidates,
  findNearestPoint,
  hitTestEntity,
  resolveOrtho,
  angleFrom,
  distanceSq,
  dot,
  normalizeAngle,
  subtract,
} from './geometry.js';
import { normalizeSpaceLayoutContext } from '../space_layout.js';

function hasFinitePoint(point) {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function resolveDraftLayerColor(layer, fallback = '#1f2937') {
  const value = typeof layer?.color === 'string' ? layer.color.trim() : '';
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : fallback;
}

function closestPointOnSegment(point, start, end) {
  const a = start;
  const b = end;
  if (!hasFinitePoint(point) || !hasFinitePoint(a) || !hasFinitePoint(b)) return null;
  const ab = subtract(b, a);
  const ap = subtract(point, a);
  const lenSq = dot(ab, ab);
  if (!Number.isFinite(lenSq) || lenSq <= 1e-12) return { x: a.x, y: a.y };
  const t = Math.max(0, Math.min(1, dot(ap, ab) / lenSq));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t };
}

function arcContainsAngle(entity, angleRad) {
  const start = normalizeAngle(Number.isFinite(entity?.startAngle) ? entity.startAngle : 0);
  const end = normalizeAngle(Number.isFinite(entity?.endAngle) ? entity.endAngle : 0);
  const angle = normalizeAngle(angleRad);
  const clockwise = entity?.cw === true;
  // With our y-down coordinate system, increasing angle is clockwise.
  const sweepStart = clockwise ? start : end;
  const sweepEnd = clockwise ? end : start;
  if (sweepStart <= sweepEnd) {
    return angle >= sweepStart - 1e-6 && angle <= sweepEnd + 1e-6;
  }
  return angle >= sweepStart - 1e-6 || angle <= sweepEnd + 1e-6;
}

function closestPointOnEntity(entity, point) {
  if (!entity || entity.visible === false) return null;
  if (!hasFinitePoint(point)) return null;

  if (entity.type === 'line') {
    return closestPointOnSegment(point, entity.start, entity.end);
  }

  if (entity.type === 'polyline' && Array.isArray(entity.points) && entity.points.length >= 2) {
    const pts = entity.points;
    let best = null;
    let bestDistSq = Infinity;
    const segCount = entity.closed === true ? pts.length : (pts.length - 1);
    for (let i = 0; i < segCount; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const proj = closestPointOnSegment(point, a, b);
      if (!proj) continue;
      const dSq = distanceSq(point, proj);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = proj;
      }
    }
    return best;
  }

  if (entity.type === 'circle') {
    const center = entity.center;
    const radius = Math.max(0.001, Number(entity.radius || 0));
    if (!hasFinitePoint(center) || !Number.isFinite(radius)) return null;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-9) {
      return { x: center.x + radius, y: center.y };
    }
    return { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius };
  }

  if (entity.type === 'arc') {
    const center = entity.center;
    const radius = Math.max(0.001, Number(entity.radius || 0));
    if (!hasFinitePoint(center) || !Number.isFinite(radius)) return null;
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const len = Math.hypot(dx, dy);
    const onCircle = len <= 1e-9
      ? { x: center.x + radius, y: center.y }
      : { x: center.x + (dx / len) * radius, y: center.y + (dy / len) * radius };
    const angle = angleFrom(center, onCircle);
    if (arcContainsAngle(entity, angle)) {
      return onCircle;
    }
    const startAngle = Number.isFinite(entity.startAngle) ? entity.startAngle : 0;
    const endAngle = Number.isFinite(entity.endAngle) ? entity.endAngle : 0;
    const start = { x: center.x + radius * Math.cos(startAngle), y: center.y + radius * Math.sin(startAngle) };
    const end = { x: center.x + radius * Math.cos(endAngle), y: center.y + radius * Math.sin(endAngle) };
    return distanceSq(point, start) <= distanceSq(point, end) ? start : end;
  }

  if (entity.type === 'text') {
    return hasFinitePoint(entity.position) ? entity.position : null;
  }

  return null;
}

function tangentPointsOnCircleOrArc(entity, fromPoint) {
  if (!entity || (entity.type !== 'circle' && entity.type !== 'arc')) return [];
  const center = entity.center;
  const radius = Math.max(0.001, Number(entity.radius || 0));
  if (!hasFinitePoint(center) || !hasFinitePoint(fromPoint) || !Number.isFinite(radius)) return [];
  const dx = fromPoint.x - center.x;
  const dy = fromPoint.y - center.y;
  const d = Math.hypot(dx, dy);
  if (!Number.isFinite(d) || d <= radius + 1e-6) return [];

  const theta = Math.atan2(dy, dx);
  const cosArg = Math.max(-1, Math.min(1, radius / d));
  const alpha = Math.acos(cosArg);
  const angles = [theta + alpha, theta - alpha];
  const out = [];
  for (const angleRaw of angles) {
    const angle = normalizeAngle(angleRaw);
    if (entity.type === 'arc' && !arcContainsAngle(entity, angle)) continue;
    out.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      kind: 'TAN',
    });
  }
  return out;
}

export function createToolContext({
  document,
  selection,
  snap,
  viewport,
  toolOptions = null,
  commandBus,
  canvasView,
  setStatus,
  readCommandInput,
  getCurrentLayerId = null,
  getCurrentLayer = null,
  getCurrentSpaceContext = null,
}) {
  return {
    document,
    selection,
    snap,
    viewport,
    toolOptions,
    commandBus,
    canvasView,
    setStatus,
    readCommandInput,
    getCurrentLayerId() {
      const layerId = typeof getCurrentLayerId === 'function' ? getCurrentLayerId() : null;
      return Number.isFinite(layerId) ? Math.trunc(Number(layerId)) : 0;
    },
    getCurrentLayer() {
      if (typeof getCurrentLayer === 'function') {
        return getCurrentLayer() || null;
      }
      const layerId = typeof getCurrentLayerId === 'function' ? getCurrentLayerId() : null;
      return Number.isFinite(layerId) && typeof document?.getLayer === 'function'
        ? document.getLayer(Math.trunc(Number(layerId)))
        : null;
    },
    getCurrentSpaceContext() {
      if (typeof getCurrentSpaceContext === 'function') {
        return normalizeSpaceLayoutContext(getCurrentSpaceContext());
      }
      if (document && typeof document.getCurrentSpaceContext === 'function') {
        return normalizeSpaceLayoutContext(document.getCurrentSpaceContext());
      }
      return normalizeSpaceLayoutContext({ space: 0, layout: 'Model' });
    },
    buildDraftEntity(entity = {}) {
      const preferredLayerId = Number.isFinite(entity?.layerId)
        ? Math.trunc(Number(entity.layerId))
        : this.getCurrentLayerId();
      const layer = Number.isFinite(preferredLayerId) && typeof document?.getLayer === 'function'
        ? document.getLayer(preferredLayerId)
        : this.getCurrentLayer();
      const currentSpaceContext = this.getCurrentSpaceContext();
      const draft = {
        layerId: Number.isFinite(preferredLayerId) ? preferredLayerId : 0,
        visible: entity?.visible !== false,
        color: resolveDraftLayerColor(layer),
        colorSource: 'BYLAYER',
        lineType: 'BYLAYER',
        lineWeight: 0,
        space: currentSpaceContext.space,
        layout: currentSpaceContext.layout,
        ...entity,
      };
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'color')) {
        draft.color = resolveDraftLayerColor(layer);
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'colorSource')) {
        draft.colorSource = 'BYLAYER';
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'lineType')) {
        draft.lineType = 'BYLAYER';
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'lineWeight')) {
        draft.lineWeight = 0;
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'lineWeightSource')) {
        draft.lineWeightSource = 'BYLAYER';
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'lineTypeScaleSource')) {
        draft.lineTypeScaleSource = 'DEFAULT';
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'space')) {
        draft.space = currentSpaceContext.space;
      }
      if (!Object.prototype.hasOwnProperty.call(entity || {}, 'layout')) {
        draft.layout = currentSpaceContext.layout;
      }
      return draft;
    },
    resolveSnappedPoint(worldPoint, opts = {}) {
      const options = snap.toJSON();
      let point = { x: worldPoint.x, y: worldPoint.y };

      const reference = opts.orthoReference || null;
      if (options.ortho && reference) {
        point = resolveOrtho(reference, point);
      }

      const enabled = options.endpoint
        || options.midpoint
        || options.quadrant
        || options.center
        || options.intersection
        || options.nearest
        || options.tangent
        || options.grid;
      if (!enabled) {
        canvasView?.setTransientOverlay?.('snapHint', null);
        return { point, snapped: false, kind: 'NONE' };
      }

      // Reduce per-frame work on large drawings by scanning only nearby entities when spatial queries are available.
      const maxDistanceWorld = (Number(options.snapRadiusPx || 12) / Math.max(0.1, viewport.zoom));
      let candidateEntities = [];
      if (typeof document.queryVisibleEntityIdsNearPoint === 'function') {
        const ids = document.queryVisibleEntityIdsNearPoint(point, maxDistanceWorld * 4);
        for (const id of ids) {
          const entity = document.getEntity(id);
          if (entity) candidateEntities.push(entity);
        }
      } else {
        candidateEntities = document.listVisibleEntities();
      }

      const snapCandidates = collectSnapCandidates(candidateEntities, {
        ...options,
        queryPoint: point,
        queryRadiusWorld: maxDistanceWorld * 1.2,
      });
      if (options.grid) {
        const size = Number(options.gridSize || 10);
        const gx = Math.round(point.x / size) * size;
        const gy = Math.round(point.y / size) * size;
        snapCandidates.push({ x: gx, y: gy, kind: 'GRID' });
      }

      if (options.nearest) {
        for (const entity of candidateEntities) {
          const nearest = closestPointOnEntity(entity, point);
          if (!nearest) continue;
          snapCandidates.push({ x: nearest.x, y: nearest.y, kind: 'NEA' });
        }
      }

      const tangentFrom = opts.tangentFrom;
      if (options.tangent && hasFinitePoint(tangentFrom)) {
        for (const entity of candidateEntities) {
          const tangents = tangentPointsOnCircleOrArc(entity, tangentFrom);
          for (const t of tangents) {
            snapCandidates.push(t);
          }
        }
      }

      const candidate = findNearestPoint(point, snapCandidates, maxDistanceWorld);
      if (candidate) {
        canvasView?.setTransientOverlay?.('snapHint', {
          point: { x: candidate.x, y: candidate.y },
          kind: candidate.kind || 'NONE',
        });
        return {
          point: { x: candidate.x, y: candidate.y },
          snapped: true,
          kind: candidate.kind || 'NONE',
        };
      }

      canvasView?.setTransientOverlay?.('snapHint', null);
      return {
        point,
        snapped: false,
        kind: 'NONE',
      };
    },
    pickEntityAt(worldPoint, tolerancePx = 10) {
      const toleranceWorld = tolerancePx / Math.max(0.1, viewport.zoom);
      const candidateIds = typeof document.queryVisibleEntityIdsNearPoint === 'function'
        ? document.queryVisibleEntityIdsNearPoint(worldPoint, toleranceWorld)
        : document.listVisibleEntities().map((entity) => entity.id);
      for (let i = candidateIds.length - 1; i >= 0; i -= 1) {
        const entity = document.getEntity(candidateIds[i]);
        if (!entity) continue;
        if (hitTestEntity(entity, worldPoint, toleranceWorld)) {
          return entity;
        }
      }
      return null;
    },
  };
}
