export function createExtendTool(ctx) {
  let boundaryIds = [];

  function reset() {
    boundaryIds = [];
    ctx.canvasView.setTransientOverlay('constraintHint', null);
  }

  return {
    id: 'extend',
    label: 'Extend',
    toolState: 'idle',
    activate() {
      reset();
      ctx.setStatus('Extend: click boundary, Shift+click to add, then click targets (Esc to exit)');
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      const hit = ctx.pickEntityAt(event.world);
      if (!hit) {
        ctx.setStatus('Extend: click a line/polyline as boundary or target');
        return;
      }

      if (boundaryIds.length === 0 || event.shiftKey) {
        if (!boundaryIds.includes(hit.id)) {
          boundaryIds.push(hit.id);
        }
        ctx.canvasView.setTransientOverlay('constraintHint', {
          mode: 'extend',
          boundaryIds: [...boundaryIds],
        });
        ctx.setStatus(`Extend: ${boundaryIds.length} boundary selected, now pick target`);
        return;
      }

      const result = ctx.commandBus.execute('selection.extend', {
        boundaryIds,
        targetId: hit.id,
        pick: { ...event.world },
      });
      if (result.ok) {
        ctx.setStatus(`Extend applied to #${hit.id} (boundaries=${boundaryIds.length}); pick next target or Shift+click to add boundary`);
      } else {
        ctx.setStatus(result.message || 'Extend failed');
      }
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Extend canceled');
      }
    },
  };
}
