import { distance } from './geometry.js';

export function createCircleTool(ctx) {
  let center = null;
  let previewRadius = 0;

  function clearOverlay() {
    ctx.canvasView.setTransientOverlay('circlePreview', null);
  }

  return {
    id: 'circle',
    label: 'Circle',
    toolState: 'idle',
    activate() {
      center = null;
      previewRadius = 0;
      clearOverlay();
      ctx.setStatus('Circle: pick center then radius point');
    },
    deactivate() {
      center = null;
      previewRadius = 0;
      clearOverlay();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: center });
      if (!center) {
        center = snapped.point;
        previewRadius = 0;
        return;
      }

      const radius = distance(center, snapped.point);
      if (radius <= 0.001) {
        ctx.setStatus('Circle radius is too small');
        return;
      }

      const entity = typeof ctx.buildDraftEntity === 'function'
        ? ctx.buildDraftEntity({
          type: 'circle',
          center: { ...center },
          radius,
        })
        : {
          type: 'circle',
          center: { ...center },
          radius,
          layerId: typeof ctx.getCurrentLayerId === 'function' ? ctx.getCurrentLayerId() : 0,
          visible: true,
          color: '#0f766e',
        };
      const result = ctx.commandBus.execute('entity.create', { entity });

      ctx.setStatus(result.ok ? 'Circle created' : (result.message || 'Circle failed'));
      center = null;
      previewRadius = 0;
      clearOverlay();
    },
    onPointerMove(event) {
      if (!center) return;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: center });
      previewRadius = distance(center, snapped.point);
      ctx.canvasView.setTransientOverlay('circlePreview', {
        center: { ...center },
        radius: previewRadius,
      });
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        center = null;
        previewRadius = 0;
        clearOverlay();
        ctx.setStatus('Circle canceled');
      }
    },
  };
}
