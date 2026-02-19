export function createLineTool(ctx) {
  let startPoint = null;
  let previewPoint = null;

  function clearOverlay() {
    ctx.canvasView.setTransientOverlay('linePreview', null);
  }

  return {
    id: 'line',
    label: 'Line',
    toolState: 'idle',
    activate() {
      ctx.setStatus('Line: pick start point and end point');
      startPoint = null;
      previewPoint = null;
      clearOverlay();
    },
    deactivate() {
      startPoint = null;
      previewPoint = null;
      clearOverlay();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: startPoint, tangentFrom: startPoint });
      if (!startPoint) {
        startPoint = snapped.point;
        previewPoint = snapped.point;
        return;
      }

      const endPoint = snapped.point;
      if (Math.abs(endPoint.x - startPoint.x) < 1e-6 && Math.abs(endPoint.y - startPoint.y) < 1e-6) {
        ctx.setStatus('Line: end point is identical to start point');
        return;
      }

      const result = ctx.commandBus.execute('entity.create', {
        entity: {
          type: 'line',
          start: { ...startPoint },
          end: { ...endPoint },
          layerId: 0,
          visible: true,
          color: '#1f2937',
        },
      });

      if (!result.ok) {
        ctx.setStatus(result.message || 'Line create failed');
      } else {
        ctx.setStatus('Line created');
      }

      startPoint = null;
      previewPoint = null;
      clearOverlay();
    },
    onPointerMove(event) {
      if (!startPoint) return;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: startPoint, tangentFrom: startPoint });
      previewPoint = snapped.point;
      ctx.canvasView.setTransientOverlay('linePreview', {
        start: { ...startPoint },
        end: { ...previewPoint },
      });
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        startPoint = null;
        previewPoint = null;
        clearOverlay();
        ctx.setStatus('Line canceled');
      }
    },
  };
}
