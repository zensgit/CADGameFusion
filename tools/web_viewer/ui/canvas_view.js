import { normalizeAngle } from '../tools/geometry.js';

function drawGrid(ctx, width, height, viewState, stepWorld) {
  const stepScreen = stepWorld * viewState.zoom;
  if (stepScreen < 12) {
    return;
  }

  const originWorld = viewState.screenToWorld({ x: 0, y: 0 });
  const endWorld = viewState.screenToWorld({ x: width, y: height });

  const minX = Math.floor(Math.min(originWorld.x, endWorld.x) / stepWorld) * stepWorld;
  const maxX = Math.ceil(Math.max(originWorld.x, endWorld.x) / stepWorld) * stepWorld;
  const minY = Math.floor(Math.min(originWorld.y, endWorld.y) / stepWorld) * stepWorld;
  const maxY = Math.ceil(Math.max(originWorld.y, endWorld.y) / stepWorld) * stepWorld;

  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(103, 126, 164, 0.18)';

  for (let x = minX; x <= maxX; x += stepWorld) {
    const sx = x * viewState.zoom + viewState.pan.x;
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, height);
    ctx.stroke();
  }

  for (let y = minY; y <= maxY; y += stepWorld) {
    const sy = y * viewState.zoom + viewState.pan.y;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(width, sy);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(52, 69, 105, 0.35)';
  const ox = viewState.pan.x;
  const oy = viewState.pan.y;
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(width, oy);
  ctx.stroke();

  ctx.restore();
}

function angleWithinSweep(start, end, candidate) {
  const s = normalizeAngle(start);
  const e = normalizeAngle(end);
  const c = normalizeAngle(candidate);
  if (s <= e) {
    return c >= s && c <= e;
  }
  return c >= s || c <= e;
}

function arcMidAngle(entity) {
  const start = normalizeAngle(Number.isFinite(entity.startAngle) ? entity.startAngle : 0);
  const end = normalizeAngle(Number.isFinite(entity.endAngle) ? entity.endAngle : 0);
  if (entity.cw === true) {
    let delta = end - start;
    if (delta < 0) delta += Math.PI * 2;
    return normalizeAngle(start + delta * 0.5);
  }
  let delta = start - end;
  if (delta < 0) delta += Math.PI * 2;
  return normalizeAngle(start - delta * 0.5);
}

function drawEntity(ctx, viewState, entity, selected = false, layer = null) {
  if (!entity || entity.visible === false) return;
  if (layer && layer.visible === false) return;

  const color = entity.color || layer?.color || '#1f2937';
  ctx.save();
  ctx.strokeStyle = selected ? '#fb923c' : color;
  ctx.fillStyle = selected ? '#ea580c' : color;
  ctx.lineWidth = selected ? 2.2 : 1.5;

  if (entity.type === 'line') {
    const p0 = viewState.worldToScreen(entity.start);
    const p1 = viewState.worldToScreen(entity.end);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  } else if (entity.type === 'polyline') {
    const points = Array.isArray(entity.points) ? entity.points : [];
    if (points.length >= 2) {
      const p0 = viewState.worldToScreen(points[0]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < points.length; i += 1) {
        const pi = viewState.worldToScreen(points[i]);
        ctx.lineTo(pi.x, pi.y);
      }
      if (entity.closed) {
        ctx.closePath();
      }
      ctx.stroke();
    }
  } else if (entity.type === 'circle') {
    const center = viewState.worldToScreen(entity.center);
    const radius = Math.max(0.001, entity.radius) * viewState.zoom;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  } else if (entity.type === 'arc') {
    const center = viewState.worldToScreen(entity.center);
    const radius = Math.max(0.001, entity.radius) * viewState.zoom;
    const start = entity.startAngle || 0;
    const end = entity.endAngle || 0;
    const anticlockwise = entity.cw === true ? false : true;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, start, end, anticlockwise);
    ctx.stroke();
  } else if (entity.type === 'text') {
    const pos = viewState.worldToScreen(entity.position);
    const size = Math.max(8, (entity.height || 2.5) * viewState.zoom);
    ctx.font = `${size}px "IBM Plex Mono", monospace`;
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(entity.rotation || 0);
    ctx.fillText(entity.value || 'TEXT', 0, 0);
    ctx.restore();
  }

  if (selected) {
    ctx.globalAlpha = 0.9;
    if (entity.type === 'line') {
      const p0 = viewState.worldToScreen(entity.start);
      const p1 = viewState.worldToScreen(entity.end);
      ctx.fillRect(p0.x - 3, p0.y - 3, 6, 6);
      ctx.fillRect(p1.x - 3, p1.y - 3, 6, 6);
    }
    if (entity.type === 'polyline' && Array.isArray(entity.points)) {
      for (const point of entity.points) {
        const p = viewState.worldToScreen(point);
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
      }
      if (entity.points.length >= 2) {
        const drawMid = (a, b) => {
          const mid = viewState.worldToScreen({ x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });
          ctx.beginPath();
          ctx.moveTo(mid.x, mid.y - 3.2);
          ctx.lineTo(mid.x + 3.2, mid.y);
          ctx.lineTo(mid.x, mid.y + 3.2);
          ctx.lineTo(mid.x - 3.2, mid.y);
          ctx.closePath();
          ctx.fill();
        };
        for (let i = 0; i < entity.points.length - 1; i += 1) {
          drawMid(entity.points[i], entity.points[i + 1]);
        }
        if (entity.closed === true) {
          drawMid(entity.points[entity.points.length - 1], entity.points[0]);
        }
      }
    }
    if (entity.type === 'circle') {
      const center = viewState.worldToScreen(entity.center);
      ctx.fillRect(center.x - 3, center.y - 3, 6, 6);
      const radiusHandle = viewState.worldToScreen({
        x: entity.center.x + Math.max(0.001, entity.radius),
        y: entity.center.y,
      });
      ctx.fillRect(radiusHandle.x - 2.5, radiusHandle.y - 2.5, 5, 5);
    }
    if (entity.type === 'arc') {
      const center = viewState.worldToScreen(entity.center);
      ctx.fillRect(center.x - 3, center.y - 3, 6, 6);
      const startAngle = Number.isFinite(entity.startAngle) ? entity.startAngle : 0;
      const endAngle = Number.isFinite(entity.endAngle) ? entity.endAngle : 0;
      const radius = Math.max(0.001, Number(entity.radius || 0));
      const startPoint = viewState.worldToScreen({
        x: entity.center.x + radius * Math.cos(startAngle),
        y: entity.center.y + radius * Math.sin(startAngle),
      });
      const endPoint = viewState.worldToScreen({
        x: entity.center.x + radius * Math.cos(endAngle),
        y: entity.center.y + radius * Math.sin(endAngle),
      });
      ctx.fillRect(startPoint.x - 2.8, startPoint.y - 2.8, 5.6, 5.6);
      ctx.fillRect(endPoint.x - 2.8, endPoint.y - 2.8, 5.6, 5.6);

      // Radius grip: at the arc mid-angle to avoid colliding with start/end grips.
      const midAngle = arcMidAngle(entity);
      const midPoint = viewState.worldToScreen({
        x: entity.center.x + radius * Math.cos(midAngle),
        y: entity.center.y + radius * Math.sin(midAngle),
      });
      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath();
      ctx.arc(midPoint.x, midPoint.y, 4.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (entity.type === 'text') {
      const pos = viewState.worldToScreen(entity.position);
      ctx.fillRect(pos.x - 3, pos.y - 3, 6, 6);
    }
  }

  ctx.restore();
}

function drawOverlay(ctx, viewState, overlays, documentState) {
  const selectionBox = overlays.selectionBox;
  if (selectionBox) {
    const p0 = viewState.worldToScreen({ x: selectionBox.x0, y: selectionBox.y0 });
    const p1 = viewState.worldToScreen({ x: selectionBox.x1, y: selectionBox.y1 });
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    ctx.save();
    ctx.fillStyle = 'rgba(37, 99, 235, 0.12)';
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
    ctx.setLineDash([6, 4]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  const linePreview = overlays.linePreview;
  if (linePreview) {
    const p0 = viewState.worldToScreen(linePreview.start);
    const p1 = viewState.worldToScreen(linePreview.end);
    ctx.save();
    ctx.strokeStyle = 'rgba(234, 88, 12, 0.85)';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

  const polylinePreview = overlays.polylinePreview;
  if (polylinePreview && Array.isArray(polylinePreview.points) && polylinePreview.points.length >= 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(234, 88, 12, 0.85)';
    ctx.setLineDash([8, 4]);
    const p0 = viewState.worldToScreen(polylinePreview.points[0]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < polylinePreview.points.length; i += 1) {
      const pi = viewState.worldToScreen(polylinePreview.points[i]);
      ctx.lineTo(pi.x, pi.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  const circlePreview = overlays.circlePreview;
  if (circlePreview) {
    const center = viewState.worldToScreen(circlePreview.center);
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.85)';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(center.x, center.y, Math.max(0.001, circlePreview.radius) * viewState.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const arcPreview = overlays.arcPreview;
  if (arcPreview) {
    const center = viewState.worldToScreen(arcPreview.center);
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.85)';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    const anticlockwise = arcPreview.cw === true ? false : arcPreview.cw === false ? true : false;
    ctx.arc(
      center.x,
      center.y,
      Math.max(0.001, arcPreview.radius) * viewState.zoom,
      arcPreview.startAngle,
      arcPreview.endAngle,
      anticlockwise,
    );
    ctx.stroke();
    ctx.restore();
  }

  const movePreview = overlays.movePreview;
  if (movePreview) {
    const p0 = viewState.worldToScreen(movePreview.from);
    const p1 = viewState.worldToScreen(movePreview.to);
    ctx.save();
    ctx.strokeStyle = movePreview.mode === 'copy' ? 'rgba(5, 150, 105, 0.85)' : 'rgba(30, 64, 175, 0.85)';
    ctx.setLineDash([10, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
  }

  const rotatePreview = overlays.rotatePreview;
  if (rotatePreview) {
    const center = viewState.worldToScreen(rotatePreview.center);
    const from = viewState.worldToScreen(rotatePreview.from);
    const to = viewState.worldToScreen(rotatePreview.to);
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 70, 239, 0.85)';
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(from.x, from.y);
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  const hint = overlays.constraintHint;
  if (hint) {
    const ids = Array.isArray(hint.boundaryIds)
      ? hint.boundaryIds.filter((value) => Number.isFinite(value))
      : (Number.isFinite(hint.boundaryId) ? [hint.boundaryId] : []);
    if (ids.length > 0) {
      for (const boundaryId of ids) {
        const entity = documentState.getEntity(boundaryId);
        if (!entity) continue;
        ctx.save();
        ctx.strokeStyle = hint.mode === 'extend' ? 'rgba(5, 150, 105, 0.9)' : 'rgba(245, 158, 11, 0.9)';
        ctx.lineWidth = 2.4;
        drawEntity(ctx, viewState, entity, false, { visible: true, color: ctx.strokeStyle });
        ctx.restore();
      }
    }
  }

  const snapHint = overlays.snapHint;
  if (snapHint && snapHint.point && snapHint.kind && snapHint.kind !== 'NONE') {
    const p = viewState.worldToScreen(snapHint.point);
    const label = String(snapHint.kind || '').toUpperCase();
    const color = label === 'END'
      ? 'rgba(34, 197, 94, 0.95)'
      : label === 'MID'
        ? 'rgba(56, 189, 248, 0.95)'
        : label === 'TAN'
          ? 'rgba(168, 85, 247, 0.95)'
        : label === 'QUA'
          ? 'rgba(99, 102, 241, 0.95)'
        : label === 'CEN'
          ? 'rgba(245, 158, 11, 0.95)'
          : label === 'INT'
            ? 'rgba(236, 72, 153, 0.95)'
            : label === 'NEA'
              ? 'rgba(100, 116, 139, 0.95)'
            : 'rgba(59, 130, 246, 0.95)';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.6;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p.x - 8, p.y);
    ctx.lineTo(p.x + 8, p.y);
    ctx.moveTo(p.x, p.y - 8);
    ctx.lineTo(p.x, p.y + 8);
    ctx.stroke();

    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x + 12, p.y - 10);
    ctx.restore();
  }

  const gripHover = overlays.gripHover;
  if (gripHover && gripHover.point) {
    const p = viewState.worldToScreen(gripHover.point);
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export class CanvasView {
  constructor({ canvas, document, selection, snap, viewport }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.document = document;
    this.selection = selection;
    this.snap = snap;
    this.viewport = viewport;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.dragPan = null;
    this.pointerDown = false;
    this.activeTool = null;
    this.overlays = {};
    this.cursorWorld = { x: 0, y: 0 };
    this.cursorListeners = [];
    this.renderPending = false;

    this.bindEvents();
    this.resize();
    this.requestRender();
  }

  bindEvents() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.focus({ preventScroll: true });
      const payload = this.buildPointerPayload(event);
      this.pointerDown = true;

      if (event.button === 1 || event.altKey) {
        this.dragPan = {
          x: event.clientX,
          y: event.clientY,
        };
        return;
      }

      if (this.activeTool?.onPointerDown) {
        this.activeTool.onPointerDown(payload);
      }
      this.requestRender();
    });

    this.canvas.addEventListener('pointermove', (event) => {
      const payload = this.buildPointerPayload(event);
      this.cursorWorld = payload.world;
      this.emitCursor(payload.world);

      if (this.dragPan) {
        const dx = event.clientX - this.dragPan.x;
        const dy = event.clientY - this.dragPan.y;
        this.dragPan = { x: event.clientX, y: event.clientY };
        this.viewport.panBy(dx, dy);
        return;
      }

      if (this.activeTool?.onPointerMove) {
        this.activeTool.onPointerMove(payload);
      }
      this.requestRender();
    });

    this.canvas.addEventListener('pointerup', (event) => {
      const payload = this.buildPointerPayload(event);
      this.pointerDown = false;
      if (this.dragPan && (event.button === 1 || event.altKey)) {
        this.dragPan = null;
        return;
      }
      if (this.activeTool?.onPointerUp) {
        this.activeTool.onPointerUp(payload);
      }
      this.requestRender();
    });

    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      const rect = this.canvas.getBoundingClientRect();
      this.viewport.zoomBy(factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }, { passive: false });

    window.addEventListener('resize', () => this.resize());

    this.document.addEventListener('change', () => this.requestRender());
    this.selection.addEventListener('change', () => this.requestRender());
    this.snap.addEventListener('change', () => this.requestRender());
    this.viewport.addEventListener('change', () => this.requestRender());
  }

  buildPointerPayload(event) {
    const rect = this.canvas.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const world = this.viewport.screenToWorld(screen);
    return {
      button: event.button,
      buttons: event.buttons,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      altKey: event.altKey,
      detail: event.detail,
      screen,
      world,
      rawEvent: event,
    };
  }

  onCursorMove(listener) {
    this.cursorListeners.push(listener);
  }

  emitCursor(world) {
    for (const listener of this.cursorListeners) {
      listener(world);
    }
  }

  setTool(tool) {
    if (this.activeTool?.deactivate) {
      this.activeTool.deactivate();
    }
    this.activeTool = tool;
    if (this.activeTool?.activate) {
      this.activeTool.activate();
    }
    this.requestRender();
  }

  dispatchKeyDown(event) {
    if (this.activeTool?.onKeyDown) {
      this.activeTool.onKeyDown(event);
      this.requestRender();
    }
  }

  setTransientOverlay(name, data) {
    if (data == null) {
      delete this.overlays[name];
    } else {
      this.overlays[name] = data;
    }
    this.requestRender();
  }

  worldToScreen(worldPoint) {
    return this.viewport.worldToScreen(worldPoint);
  }

  screenToWorld(screenPoint) {
    return this.viewport.screenToWorld(screenPoint);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * this.pixelRatio));
    const height = Math.max(1, Math.floor(rect.height * this.pixelRatio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }
    this.requestRender();
  }

  requestRender() {
    if (this.renderPending) return;
    this.renderPending = true;
    requestAnimationFrame(() => {
      this.renderPending = false;
      this.render();
    });
  }

  render() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    this.ctx.clearRect(0, 0, width, height);

    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#f7faff');
    gradient.addColorStop(1, '#edf2fb');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    const snapOptions = this.snap.toJSON();
    if (snapOptions.grid || this.viewport.showGrid) {
      drawGrid(this.ctx, width, height, this.viewport, snapOptions.gridSize || 10);
    }

    const selectedIds = new Set(this.selection.entityIds || []);
    const layers = new Map(this.document.listLayers().map((layer) => [layer.id, layer]));

    for (const entity of this.document.listEntities()) {
      drawEntity(this.ctx, this.viewport, entity, selectedIds.has(entity.id), layers.get(entity.layerId));
    }

    drawOverlay(this.ctx, this.viewport, this.overlays, this.document);
  }
}
