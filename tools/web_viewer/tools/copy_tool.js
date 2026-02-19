export function createCopyTool(ctx) {
  let basePoint = null;
  let previewPoint = null;

  function clearOverlay() {
    ctx.canvasView.setTransientOverlay('movePreview', null);
  }

  return {
    id: 'copy',
    label: 'Copy',
    toolState: 'idle',
    activate() {
      basePoint = null;
      previewPoint = null;
      clearOverlay();
      ctx.setStatus('Copy: select entities, pick base point, pick target point');
    },
    deactivate() {
      basePoint = null;
      previewPoint = null;
      clearOverlay();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      if (ctx.selection.entityIds.length === 0) {
        const hit = ctx.pickEntityAt(event.world);
        if (hit) {
          ctx.selection.setSelection([hit.id], hit.id);
        } else {
          ctx.setStatus('Copy: no selection');
          return;
        }
      }

      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: basePoint });
      if (!basePoint) {
        basePoint = snapped.point;
        previewPoint = snapped.point;
        ctx.setStatus('Copy: pick target point');
        return;
      }
      const targetPoint = snapped.point;
      const delta = {
        x: targetPoint.x - basePoint.x,
        y: targetPoint.y - basePoint.y,
      };
      const result = ctx.commandBus.execute('selection.copy', { delta });
      ctx.setStatus(result.ok ? `Copy applied dx=${delta.x.toFixed(2)} dy=${delta.y.toFixed(2)}` : (result.message || 'Copy failed'));
      basePoint = null;
      previewPoint = null;
      clearOverlay();
    },
    onPointerMove(event) {
      if (!basePoint) return;
      const snapped = ctx.resolveSnappedPoint(event.world, { orthoReference: basePoint });
      previewPoint = snapped.point;
      ctx.canvasView.setTransientOverlay('movePreview', {
        from: { ...basePoint },
        to: { ...previewPoint },
        mode: 'copy',
      });
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        basePoint = null;
        previewPoint = null;
        clearOverlay();
        ctx.setStatus('Copy canceled');
      }
    },
  };
}
