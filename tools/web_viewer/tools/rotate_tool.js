import { computeRotatePayload } from '../commands/command_registry.js';

export function createRotateTool(ctx) {
  let centerPoint = null;
  let referencePoint = null;
  let previewPoint = null;

  function clearOverlay() {
    ctx.canvasView.setTransientOverlay('rotatePreview', null);
  }

  function redrawOverlay() {
    if (!centerPoint || !referencePoint || !previewPoint) {
      clearOverlay();
      return;
    }
    ctx.canvasView.setTransientOverlay('rotatePreview', {
      center: { ...centerPoint },
      from: { ...referencePoint },
      to: { ...previewPoint },
    });
  }

  function reset() {
    centerPoint = null;
    referencePoint = null;
    previewPoint = null;
    clearOverlay();
  }

  return {
    id: 'rotate',
    label: 'Rotate',
    toolState: 'idle',
    activate() {
      reset();
      ctx.setStatus('Rotate: select entities, pick center, pick reference, pick target');
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      if (ctx.selection.entityIds.length === 0) {
        const hit = ctx.pickEntityAt(event.world);
        if (hit) {
          ctx.selection.setSelection([hit.id], hit.id);
        } else {
          ctx.setStatus('Rotate: no selection');
          return;
        }
      }

      if (!centerPoint) {
        centerPoint = ctx.resolveSnappedPoint(event.world).point;
        ctx.setStatus('Rotate: pick reference point');
        return;
      }

      if (!referencePoint) {
        referencePoint = ctx.resolveSnappedPoint(event.world, { orthoReference: centerPoint }).point;
        previewPoint = referencePoint;
        redrawOverlay();
        ctx.setStatus('Rotate: pick target point');
        return;
      }

      const targetPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: centerPoint }).point;
      const payload = computeRotatePayload(centerPoint, referencePoint, targetPoint);
      const result = ctx.commandBus.execute('selection.rotate', payload);
      ctx.setStatus(result.ok ? `Rotate applied ${payload.angle.toFixed(3)}rad` : (result.message || 'Rotate failed'));
      reset();
    },
    onPointerMove(event) {
      if (!centerPoint || !referencePoint) return;
      previewPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: centerPoint }).point;
      redrawOverlay();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Rotate canceled');
      }
    },
  };
}
