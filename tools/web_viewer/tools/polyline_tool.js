export function createPolylineTool(ctx) {
  let points = [];
  let previewPoint = null;

  function redrawOverlay() {
    if (points.length === 0) {
      ctx.canvasView.setTransientOverlay('polylinePreview', null);
      return;
    }
    const next = [...points];
    if (previewPoint) {
      next.push(previewPoint);
    }
    ctx.canvasView.setTransientOverlay('polylinePreview', {
      points: next,
    });
  }

  function reset() {
    points = [];
    previewPoint = null;
    redrawOverlay();
  }

  function finishPolyline() {
    if (points.length < 2) {
      reset();
      return;
    }
    const entity = typeof ctx.buildDraftEntity === 'function'
      ? ctx.buildDraftEntity({
        type: 'polyline',
        points: points.map((point) => ({ ...point })),
        closed: false,
      })
      : {
        type: 'polyline',
        points: points.map((point) => ({ ...point })),
        closed: false,
        layerId: typeof ctx.getCurrentLayerId === 'function' ? ctx.getCurrentLayerId() : 0,
        visible: true,
        color: '#334155',
      };
    const result = ctx.commandBus.execute('entity.create', { entity });
    if (!result.ok) {
      ctx.setStatus(result.message || 'Polyline create failed');
    } else {
      ctx.setStatus(`Polyline created (${points.length} pts)`);
    }
    reset();
  }

  return {
    id: 'polyline',
    label: 'Polyline',
    toolState: 'idle',
    activate() {
      ctx.setStatus('Polyline: click to add vertices, Enter/double-click to finish');
      reset();
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button === 2) {
        finishPolyline();
        return;
      }
      if (event.button !== 0) return;
      const reference = points.length > 0 ? points[points.length - 1] : null;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: reference, tangentFrom: reference });
      points.push(snapped.point);
      previewPoint = snapped.point;
      redrawOverlay();
      if (event.detail >= 2 && points.length >= 2) {
        finishPolyline();
      }
    },
    onPointerMove(event) {
      if (points.length === 0) return;
      const reference = points[points.length - 1];
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: reference, tangentFrom: reference });
      previewPoint = snapped.point;
      redrawOverlay();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Polyline canceled');
      }
      if (event.key === 'Enter') {
        finishPolyline();
      }
    },
  };
}
