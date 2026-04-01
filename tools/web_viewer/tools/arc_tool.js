import { angleFrom, distance } from './geometry.js';

export function createArcTool(ctx) {
  let center = null;
  let startPoint = null;
  let previewPoint = null;

  function redrawOverlay() {
    if (!center) {
      ctx.canvasView.setTransientOverlay('arcPreview', null);
      return;
    }
    if (!startPoint) {
      return;
    }
    const target = previewPoint || startPoint;
    const radius = distance(center, startPoint);
    ctx.canvasView.setTransientOverlay('arcPreview', {
      center: { ...center },
      radius,
      startAngle: angleFrom(center, startPoint),
      endAngle: angleFrom(center, target),
      cw: true,
    });
  }

  function reset() {
    center = null;
    startPoint = null;
    previewPoint = null;
    redrawOverlay();
  }

  return {
    id: 'arc',
    label: 'Arc',
    toolState: 'idle',
    activate() {
      reset();
      ctx.setStatus('Arc: center -> start -> end');
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      if (!center) {
        center = ctx.resolveSnappedPoint(event.world).point;
        ctx.setStatus('Arc: pick start point');
        return;
      }
      if (!startPoint) {
        startPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: center }).point;
        previewPoint = startPoint;
        redrawOverlay();
        ctx.setStatus('Arc: pick end point');
        return;
      }
      const endPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: center }).point;
      const radius = distance(center, startPoint);
      if (radius <= 0.001) {
        ctx.setStatus('Arc radius is too small');
        reset();
        return;
      }
      const entity = typeof ctx.buildDraftEntity === 'function'
        ? ctx.buildDraftEntity({
          type: 'arc',
          center: { ...center },
          radius,
          startAngle: angleFrom(center, startPoint),
          endAngle: angleFrom(center, endPoint),
          cw: true,
        })
        : {
          type: 'arc',
          center: { ...center },
          radius,
          startAngle: angleFrom(center, startPoint),
          endAngle: angleFrom(center, endPoint),
          cw: true,
          layerId: typeof ctx.getCurrentLayerId === 'function' ? ctx.getCurrentLayerId() : 0,
          visible: true,
          color: '#7c3aed',
        };
      const result = ctx.commandBus.execute('entity.create', { entity });
      ctx.setStatus(result.ok ? 'Arc created' : (result.message || 'Arc create failed'));
      reset();
    },
    onPointerMove(event) {
      if (!center || !startPoint) return;
      previewPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: center }).point;
      redrawOverlay();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Arc canceled');
      }
    },
  };
}
