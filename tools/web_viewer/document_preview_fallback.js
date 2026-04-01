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

const TAU = Math.PI * 2;
const DEFAULT_CURVE_SEGMENTS = 64;
const MIN_CURVE_SEGMENTS = 8;
const DEFAULT_POINT_HALF_SIZE = 1;
const POINT_SIZE_RATIO = 0.004;
const FOCUS_TARGET_GRID_CELLS = 1536;
const FOCUS_MIN_GRID_SIZE = 24;
const FOCUS_MAX_GRID_SIZE = 64;
const FOCUS_WEIGHT_LENGTH_MULTIPLIER = 2.5;
const FOCUS_THRESHOLD_RATIOS = [0.9, 0.88, 0.85, 0.82];
const FOCUS_MIN_WEIGHT = 0.25;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parsePoint2(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function appendSegment(state, entity, ax, ay, bx, by) {
  if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
    return false;
  }
  if (ax === bx && ay === by) {
    return false;
  }
  const vertexBase = state.positions.length / 3;
  state.positions.push(ax, ay, 0, bx, by, 0);
  state.indices.push(vertexBase, vertexBase + 1);
  state.minX = Math.min(state.minX, ax, bx);
  state.minY = Math.min(state.minY, ay, by);
  state.maxX = Math.max(state.maxX, ax, bx);
  state.maxY = Math.max(state.maxY, ay, by);
  state.segmentCount += 1;
  return true;
}

function buildSlice(entity, indexOffset, indexCount) {
  return {
    id: Number.isFinite(entity?.id) ? entity.id : null,
    type: Number.isFinite(entity?.type) ? entity.type : null,
    layer_id: Number.isFinite(entity?.layer_id) ? entity.layer_id : null,
    line_type: typeof entity?.line_type === "string" ? entity.line_type : "",
    line_type_scale: Number.isFinite(entity?.line_type_scale) ? entity.line_type_scale : 1,
    line_weight: Number.isFinite(entity?.line_weight) ? entity.line_weight : 0.15,
    name: typeof entity?.name === "string" ? entity.name : "",
    space: Number.isFinite(entity?.space) ? entity.space : 0,
    index_offset: indexOffset,
    index_count: indexCount,
  };
}

function normalizeSweep(a0, a1, clockwise = false) {
  const start = Number.isFinite(a0) ? a0 : 0;
  let end = Number.isFinite(a1) ? a1 : start;
  if (clockwise) {
    while (end >= start) {
      end -= TAU;
    }
  } else {
    while (end <= start) {
      end += TAU;
    }
  }
  return { start, sweep: end - start };
}

function appendArcSegments(state, entity, center, radius, a0, a1, clockwise = false) {
  if (!center || !Number.isFinite(radius) || radius <= 0) {
    return 0;
  }
  const { start, sweep } = normalizeSweep(a0, a1, clockwise);
  const segmentTarget = Math.max(
    MIN_CURVE_SEGMENTS,
    Math.ceil((Math.abs(sweep) / TAU) * DEFAULT_CURVE_SEGMENTS)
  );
  let added = 0;
  let prevX = center.x + Math.cos(start) * radius;
  let prevY = center.y + Math.sin(start) * radius;
  for (let index = 1; index <= segmentTarget; index += 1) {
    const t = start + (sweep * index) / segmentTarget;
    const x = center.x + Math.cos(t) * radius;
    const y = center.y + Math.sin(t) * radius;
    if (appendSegment(state, entity, prevX, prevY, x, y)) {
      added += 1;
    }
    prevX = x;
    prevY = y;
  }
  return added;
}

function appendEllipseSegments(state, entity, ellipse) {
  const center = parsePoint2(ellipse?.c);
  const rx = Number(ellipse?.rx);
  const ry = Number(ellipse?.ry);
  const rotation = Number.isFinite(ellipse?.rot) ? ellipse.rot : 0;
  if (!center || !Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) {
    return 0;
  }
  const { start, sweep } = normalizeSweep(ellipse?.a0, ellipse?.a1, false);
  const cosRot = Math.cos(rotation);
  const sinRot = Math.sin(rotation);
  const segmentTarget = Math.max(
    MIN_CURVE_SEGMENTS,
    Math.ceil((Math.abs(sweep) / TAU) * DEFAULT_CURVE_SEGMENTS)
  );
  let added = 0;
  let prevX = center.x + cosRot * (Math.cos(start) * rx) - sinRot * (Math.sin(start) * ry);
  let prevY = center.y + sinRot * (Math.cos(start) * rx) + cosRot * (Math.sin(start) * ry);
  for (let index = 1; index <= segmentTarget; index += 1) {
    const t = start + (sweep * index) / segmentTarget;
    const px = Math.cos(t) * rx;
    const py = Math.sin(t) * ry;
    const x = center.x + cosRot * px - sinRot * py;
    const y = center.y + sinRot * px + cosRot * py;
    if (appendSegment(state, entity, prevX, prevY, x, y)) {
      added += 1;
    }
    prevX = x;
    prevY = y;
  }
  return added;
}

function appendPolylineSegments(state, entity, points, closed = false) {
  if (!Array.isArray(points) || points.length < 2) {
    return 0;
  }
  let added = 0;
  let first = null;
  let prev = null;
  for (const rawPoint of points) {
    const point = parsePoint2(rawPoint);
    if (!point) continue;
    if (!first) {
      first = point;
    }
    if (prev && appendSegment(state, entity, prev.x, prev.y, point.x, point.y)) {
      added += 1;
    }
    prev = point;
  }
  if (closed && first && prev && appendSegment(state, entity, prev.x, prev.y, first.x, first.y)) {
    added += 1;
  }
  return added;
}

function appendPointMarkers(state, pendingPoints) {
  if (!pendingPoints.length) return 0;
  const width = Number.isFinite(state.minX) && Number.isFinite(state.maxX) ? Math.abs(state.maxX - state.minX) : 0;
  const height = Number.isFinite(state.minY) && Number.isFinite(state.maxY) ? Math.abs(state.maxY - state.minY) : 0;
  const derivedHalfSize = Math.max(width, height) * POINT_SIZE_RATIO;
  const halfSize = derivedHalfSize > 0 ? derivedHalfSize : DEFAULT_POINT_HALF_SIZE;
  let added = 0;
  for (const entity of pendingPoints) {
    const point = parsePoint2(entity?.point);
    if (!point) continue;
    if (appendSegment(state, entity, point.x - halfSize, point.y - halfSize, point.x + halfSize, point.y + halfSize)) {
      added += 1;
    }
    if (appendSegment(state, entity, point.x - halfSize, point.y + halfSize, point.x + halfSize, point.y - halfSize)) {
      added += 1;
    }
  }
  return added;
}

function hasFiniteBounds(bounds) {
  return bounds
    && Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.maxY)
    && bounds.maxX > bounds.minX
    && bounds.maxY > bounds.minY;
}

function createFocusGrid(bounds) {
  if (!hasFiniteBounds(bounds)) {
    return null;
  }
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const cols = clamp(
    Math.round(Math.sqrt(FOCUS_TARGET_GRID_CELLS * (width / height))),
    FOCUS_MIN_GRID_SIZE,
    FOCUS_MAX_GRID_SIZE,
  );
  const rows = clamp(
    Math.round(FOCUS_TARGET_GRID_CELLS / cols),
    FOCUS_MIN_GRID_SIZE,
    FOCUS_MAX_GRID_SIZE,
  );
  return {
    cols,
    rows,
    width,
    height,
    cellWidth: width / cols,
    cellHeight: height / rows,
    maxCellSpan: Math.max(width / cols, height / rows, 1),
  };
}

function clampCellIndex(index, size) {
  return clamp(index, 0, size - 1);
}

function cellIndexForPoint(x, y, bounds, grid) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !grid) {
    return -1;
  }
  const col = clampCellIndex(Math.floor(((x - bounds.minX) / grid.width) * grid.cols), grid.cols);
  const row = clampCellIndex(Math.floor(((y - bounds.minY) / grid.height) * grid.rows), grid.rows);
  return row * grid.cols + col;
}

function quantile(sortedValues, ratio) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }
  const clamped = clamp(ratio, 0, 1);
  const index = clamp(Math.floor((sortedValues.length - 1) * clamped), 0, sortedValues.length - 1);
  const value = sortedValues[index];
  return Number.isFinite(value) ? value : null;
}

function scoreFocusComponent(component, totalCells) {
  if (!component || component.weight <= 0 || component.cellCount <= 0) {
    return -1;
  }
  const widthCells = component.maxCol - component.minCol + 1;
  const heightCells = component.maxRow - component.minRow + 1;
  const bboxArea = Math.max(widthCells * heightCells, 1);
  const occupancy = component.cellCount / bboxArea;
  const aspectPenalty = Math.min(widthCells, heightCells) / Math.max(widthCells, heightCells);
  const footprintFactor = Math.log(2 + bboxArea);
  const sizeFactor = Math.min(1, bboxArea / Math.max(totalCells * 0.12, 1));
  return component.weight
    * (0.2 + 0.8 * occupancy)
    * (0.25 + 0.75 * aspectPenalty)
    * footprintFactor
    * (0.35 + 0.65 * sizeFactor);
}

function buildFocusComponentFromThreshold(cellWeights, grid, threshold) {
  const active = new Set();
  for (let index = 0; index < cellWeights.length; index += 1) {
    if (cellWeights[index] >= threshold) {
      active.add(index);
    }
  }
  if (active.size === 0) {
    return null;
  }

  const seen = new Set();
  let best = null;
  for (const startIndex of active) {
    if (seen.has(startIndex)) {
      continue;
    }
    const queue = [startIndex];
    seen.add(startIndex);
    const component = {
      cells: [],
      weight: 0,
      cellCount: 0,
      minCol: Number.POSITIVE_INFINITY,
      minRow: Number.POSITIVE_INFINITY,
      maxCol: Number.NEGATIVE_INFINITY,
      maxRow: Number.NEGATIVE_INFINITY,
    };
    while (queue.length > 0) {
      const index = queue.pop();
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      component.cells.push(index);
      component.weight += cellWeights[index];
      component.cellCount += 1;
      component.minCol = Math.min(component.minCol, col);
      component.minRow = Math.min(component.minRow, row);
      component.maxCol = Math.max(component.maxCol, col);
      component.maxRow = Math.max(component.maxRow, row);
      for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) {
        for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
          if (rowDelta === 0 && colDelta === 0) {
            continue;
          }
          const nextCol = col + colDelta;
          const nextRow = row + rowDelta;
          if (nextCol < 0 || nextCol >= grid.cols || nextRow < 0 || nextRow >= grid.rows) {
            continue;
          }
          const nextIndex = nextRow * grid.cols + nextCol;
          if (!active.has(nextIndex) || seen.has(nextIndex)) {
            continue;
          }
          seen.add(nextIndex);
          queue.push(nextIndex);
        }
      }
    }
    component.score = scoreFocusComponent(component, grid.cols * grid.rows);
    if (!best || component.score > best.score) {
      best = component;
    }
  }
  return best;
}

function expandFocusCellBounds(component, grid) {
  if (!component || !grid) {
    return null;
  }
  const colPadding = Math.max(1, Math.round((component.maxCol - component.minCol + 1) * 0.1));
  const rowPadding = Math.max(1, Math.round((component.maxRow - component.minRow + 1) * 0.12));
  return {
    minCol: clampCellIndex(component.minCol - colPadding, grid.cols),
    maxCol: clampCellIndex(component.maxCol + colPadding, grid.cols),
    minRow: clampCellIndex(component.minRow - rowPadding, grid.rows),
    maxRow: clampCellIndex(component.maxRow + rowPadding, grid.rows),
  };
}

function buildFocusBoundsFromSegments(preview, bounds, grid, cellBounds, sliceFilter) {
  if (!preview || !Array.isArray(preview.slices) || !Array.isArray(preview.positions) || !Array.isArray(preview.indices)) {
    return null;
  }
  let focusBounds = null;
  for (const slice of preview.slices) {
    if (typeof sliceFilter === "function" && !sliceFilter(slice)) {
      continue;
    }
    const start = slice.index_offset;
    const end = slice.index_offset + slice.index_count;
    for (let offset = start; offset + 1 < end; offset += 2) {
      const ia = preview.indices[offset];
      const ib = preview.indices[offset + 1];
      if (!Number.isFinite(ia) || !Number.isFinite(ib)) {
        continue;
      }
      const ax = preview.positions[ia * 3];
      const ay = preview.positions[ia * 3 + 1];
      const bx = preview.positions[ib * 3];
      const by = preview.positions[ib * 3 + 1];
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
        continue;
      }
      const midIndex = cellIndexForPoint((ax + bx) * 0.5, (ay + by) * 0.5, bounds, grid);
      if (midIndex < 0) {
        continue;
      }
      const col = midIndex % grid.cols;
      const row = Math.floor(midIndex / grid.cols);
      if (
        col < cellBounds.minCol || col > cellBounds.maxCol
        || row < cellBounds.minRow || row > cellBounds.maxRow
      ) {
        continue;
      }
      if (!focusBounds) {
        focusBounds = {
          minX: Math.min(ax, bx),
          minY: Math.min(ay, by),
          maxX: Math.max(ax, bx),
          maxY: Math.max(ay, by),
        };
      } else {
        focusBounds.minX = Math.min(focusBounds.minX, ax, bx);
        focusBounds.minY = Math.min(focusBounds.minY, ay, by);
        focusBounds.maxX = Math.max(focusBounds.maxX, ax, bx);
        focusBounds.maxY = Math.max(focusBounds.maxY, ay, by);
      }
    }
  }
  return hasFiniteBounds(focusBounds) ? focusBounds : null;
}

function expandBounds(bounds, {
  padXRatio = 0.35,
  padYRatio = 0.45,
  minPadding = 1,
} = {}) {
  if (!hasFiniteBounds(bounds)) {
    return null;
  }
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padX = Math.max(width * padXRatio, minPadding);
  const padY = Math.max(height * padYRatio, minPadding);
  return {
    minX: bounds.minX - padX,
    minY: bounds.minY - padY,
    maxX: bounds.maxX + padX,
    maxY: bounds.maxY + padY,
  };
}

function segmentBoundsIntersectBounds(segmentBounds, bounds) {
  if (!hasFiniteBounds(segmentBounds) || !hasFiniteBounds(bounds)) {
    return false;
  }
  return !(
    segmentBounds.maxX < bounds.minX
    || segmentBounds.minX > bounds.maxX
    || segmentBounds.maxY < bounds.minY
    || segmentBounds.minY > bounds.maxY
  );
}

function collectNearbySegmentBounds(preview, inclusionBounds, sliceFilter) {
  if (!hasFiniteBounds(inclusionBounds)) {
    return null;
  }
  let collected = null;
  for (const slice of preview.slices) {
    if (typeof sliceFilter === "function" && !sliceFilter(slice)) {
      continue;
    }
    const start = slice.index_offset;
    const end = slice.index_offset + slice.index_count;
    for (let offset = start; offset + 1 < end; offset += 2) {
      const ia = preview.indices[offset];
      const ib = preview.indices[offset + 1];
      if (!Number.isFinite(ia) || !Number.isFinite(ib)) {
        continue;
      }
      const ax = preview.positions[ia * 3];
      const ay = preview.positions[ia * 3 + 1];
      const bx = preview.positions[ib * 3];
      const by = preview.positions[ib * 3 + 1];
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
        continue;
      }
      const segmentBounds = {
        minX: Math.min(ax, bx),
        minY: Math.min(ay, by),
        maxX: Math.max(ax, bx),
        maxY: Math.max(ay, by),
      };
      if (!segmentBoundsIntersectBounds(segmentBounds, inclusionBounds)) {
        continue;
      }
      if (!collected) {
        collected = { ...segmentBounds };
      } else {
        collected.minX = Math.min(collected.minX, segmentBounds.minX);
        collected.minY = Math.min(collected.minY, segmentBounds.minY);
        collected.maxX = Math.max(collected.maxX, segmentBounds.maxX);
        collected.maxY = Math.max(collected.maxY, segmentBounds.maxY);
      }
    }
  }
  return hasFiniteBounds(collected) ? collected : null;
}

export function buildCadgfDocumentFocusRegion(preview, {
  sliceFilter = null,
} = {}) {
  const bounds = preview?.bounds;
  const grid = createFocusGrid(bounds);
  if (!grid || !Array.isArray(preview?.slices) || !Array.isArray(preview?.positions) || !Array.isArray(preview?.indices)) {
    return null;
  }

  const cellWeights = new Float64Array(grid.cols * grid.rows);
  for (const slice of preview.slices) {
    if (typeof sliceFilter === "function" && !sliceFilter(slice)) {
      continue;
    }
    const start = slice.index_offset;
    const end = slice.index_offset + slice.index_count;
    for (let offset = start; offset + 1 < end; offset += 2) {
      const ia = preview.indices[offset];
      const ib = preview.indices[offset + 1];
      if (!Number.isFinite(ia) || !Number.isFinite(ib)) {
        continue;
      }
      const ax = preview.positions[ia * 3];
      const ay = preview.positions[ia * 3 + 1];
      const bx = preview.positions[ib * 3];
      const by = preview.positions[ib * 3 + 1];
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) {
        continue;
      }
      const cellIndex = cellIndexForPoint((ax + bx) * 0.5, (ay + by) * 0.5, bounds, grid);
      if (cellIndex < 0) {
        continue;
      }
      const length = Math.hypot(bx - ax, by - ay);
      const weight = Math.max(
        FOCUS_MIN_WEIGHT,
        Math.min(length, grid.maxCellSpan * FOCUS_WEIGHT_LENGTH_MULTIPLIER),
      );
      cellWeights[cellIndex] += weight;
    }
  }

  const nonZeroWeights = Array.from(cellWeights).filter((value) => value > 0).sort((a, b) => a - b);
  if (nonZeroWeights.length === 0) {
    return null;
  }

  let bestRegion = null;
  for (const ratio of FOCUS_THRESHOLD_RATIOS) {
    const threshold = quantile(nonZeroWeights, ratio);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      continue;
    }
    const component = buildFocusComponentFromThreshold(cellWeights, grid, threshold);
    if (!component) {
      continue;
    }
    const expandedCells = expandFocusCellBounds(component, grid);
    const focusSeedBounds = buildFocusBoundsFromSegments(preview, bounds, grid, expandedCells, sliceFilter);
    const focusBounds = collectNearbySegmentBounds(
      preview,
      expandBounds(focusSeedBounds, {
        padXRatio: 0.45,
        padYRatio: 0.55,
        minPadding: grid.maxCellSpan,
      }),
      sliceFilter,
    ) || focusSeedBounds;
    if (!hasFiniteBounds(focusBounds)) {
      continue;
    }
    const fullArea = Math.max((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY), 1);
    const focusArea = Math.max((focusBounds.maxX - focusBounds.minX) * (focusBounds.maxY - focusBounds.minY), 1);
    const region = {
      strategy: "density-cluster",
      thresholdRatio: ratio,
      threshold,
      score: component.score,
      coverageRatio: focusArea / fullArea,
      componentCellCount: component.cellCount,
      componentWeight: component.weight,
      grid: {
        cols: grid.cols,
        rows: grid.rows,
      },
      cellBounds: expandedCells,
      bounds: focusBounds,
    };
    if (!bestRegion || region.score > bestRegion.score) {
      bestRegion = region;
    }
  }

  return bestRegion;
}

export function buildCadgfDocumentLinePreview(doc = {}) {
  const entities = Array.isArray(doc?.entities) ? doc.entities : [];
  const state = {
    positions: [],
    indices: [],
    slices: [],
    segmentCount: 0,
    renderableEntityCount: 0,
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  const pendingPoints = [];

  for (const entity of entities) {
    if (!entity || !Number.isFinite(entity.type)) continue;
    const indexOffset = state.indices.length;
    let addedSegments = 0;
    if (entity.type === CADGF_ENTITY_TYPES.LINE) {
      const points = Array.isArray(entity.line) ? entity.line : [];
      const start = parsePoint2(points[0]);
      const end = parsePoint2(points[1]);
      if (start && end && appendSegment(state, entity, start.x, start.y, end.x, end.y)) {
        addedSegments = 1;
      }
    } else if (entity.type === CADGF_ENTITY_TYPES.POLYLINE) {
      const closed = entity.closed === true || entity.closed === 1 || entity.polyline_closed === true || entity.polyline_closed === 1;
      addedSegments = appendPolylineSegments(state, entity, entity.polyline, closed);
    } else if (entity.type === CADGF_ENTITY_TYPES.ARC) {
      const arc = entity.arc || {};
      addedSegments = appendArcSegments(
        state,
        entity,
        parsePoint2(arc.c),
        Number(arc.r),
        arc.a0,
        arc.a1,
        Boolean(arc.cw)
      );
    } else if (entity.type === CADGF_ENTITY_TYPES.CIRCLE) {
      const circle = entity.circle || {};
      addedSegments = appendArcSegments(
        state,
        entity,
        parsePoint2(circle.c),
        Number(circle.r),
        0,
        TAU,
        false
      );
    } else if (entity.type === CADGF_ENTITY_TYPES.ELLIPSE) {
      addedSegments = appendEllipseSegments(state, entity, entity.ellipse || {});
    } else if (entity.type === CADGF_ENTITY_TYPES.POINT) {
      pendingPoints.push(entity);
    }
    if (addedSegments > 0) {
      state.renderableEntityCount += 1;
      state.slices.push(buildSlice(entity, indexOffset, state.indices.length - indexOffset));
    }
  }

  for (const entity of pendingPoints) {
    const indexOffset = state.indices.length;
    const addedSegments = appendPointMarkers(state, [entity]);
    if (addedSegments > 0) {
      state.renderableEntityCount += 1;
      state.slices.push(buildSlice(entity, indexOffset, state.indices.length - indexOffset));
    }
  }

  const bounds = Number.isFinite(state.minX) && Number.isFinite(state.minY) && Number.isFinite(state.maxX) && Number.isFinite(state.maxY)
    ? {
        minX: state.minX,
        minY: state.minY,
        maxX: state.maxX,
        maxY: state.maxY,
      }
    : null;

  return {
    positions: state.positions,
    indices: state.indices,
    slices: state.slices,
    segmentCount: state.segmentCount,
    renderableEntityCount: state.renderableEntityCount,
    bounds,
  };
}

export { CADGF_ENTITY_TYPES };
