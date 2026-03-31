import { computeScalePayload } from '../commands/command_registry.js';

export function createScaleTool(ctx) {
  let centerPoint = null;
  let referencePoint = null;
  let previewPoint = null;

  function clearOverlay() {
    ctx.canvasView.setTransientOverlay('scalePreview', null);
  }

  function redrawOverlay() {
    if (!centerPoint || !referencePoint || !previewPoint) {
      clearOverlay();
      return;
    }
    ctx.canvasView.setTransientOverlay('scalePreview', {
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
    id: 'scale',
    label: 'Scale',
    toolState: 'idle',
    activate() {
      reset();
      ctx.setStatus('Scale: select entities, pick center, pick reference, pick target');
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
          ctx.setStatus('Scale: no selection');
          return;
        }
      }

      if (!centerPoint) {
        centerPoint = ctx.resolveSnappedPoint(event.world).point;
        ctx.setStatus('Scale: pick reference point');
        return;
      }

      if (!referencePoint) {
        referencePoint = ctx.resolveSnappedPoint(event.world, { orthoReference: centerPoint }).point;
        previewPoint = referencePoint;
        redrawOverlay();
        ctx.setStatus('Scale: pick target point');
        return;
      }

      const targetPoint = ctx.resolveSnappedPoint(event.world, { orthoReference: centerPoint }).point;
      const payload = computeScalePayload(centerPoint, referencePoint, targetPoint);
      if (!payload) {
        ctx.setStatus('Scale failed: base/reference distance too small');
        reset();
        return;
      }
      const result = ctx.commandBus.execute('selection.scale', payload);
      ctx.setStatus(result.ok ? `Scale applied x${payload.factor.toFixed(3)}` : (result.message || 'Scale failed'));
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
        ctx.setStatus('Scale canceled');
      }
    },
  };
}
