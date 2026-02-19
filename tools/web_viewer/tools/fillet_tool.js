export function createFilletTool(ctx) {
  let stage = 'pickFirst'; // pickFirst | pickSecond
  let firstId = null;
  let firstPick = null;
  let radius = 1.0;

  function syncRadiusFromCommandInput() {
    const input = ctx.readCommandInput?.();
    const args = Array.isArray(input?.args) ? input.args : [];
    const parsed = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
    if (Number.isFinite(parsed) && parsed > 1e-9) {
      radius = parsed;
    }
  }

  function setStage(nextStage) {
    stage = nextStage;
    if (stage === 'pickFirst') {
      ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click first line/polyline (Esc to cancel)`);
      return;
    }
    ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click second line/polyline (Esc to cancel)`);
  }

  function reset() {
    stage = 'pickFirst';
    firstId = null;
    firstPick = null;
    syncRadiusFromCommandInput();
    setStage(stage);
  }

  function getTargetEntity(id) {
    const entity = ctx.document?.getEntity?.(id);
    if (!entity) return null;
    if (entity.type === 'line') return entity;
    if (entity.type === 'polyline') return entity;
    return null;
  }

  return {
    id: 'fillet',
    label: 'Fillet',
    toolState: 'idle',
    activate() {
      reset();
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      syncRadiusFromCommandInput();

      if (stage === 'pickFirst') {
        const hit = ctx.pickEntityAt(event.world);
        if (!hit) {
          ctx.setStatus('Fillet: pick a line/polyline');
          return;
        }
        const target = getTargetEntity(hit.id);
        if (!target) {
          ctx.setStatus('Fillet: only line/polyline is supported');
          return;
        }
        firstId = hit.id;
        firstPick = { x: event.world.x, y: event.world.y };
        ctx.selection?.setSelection?.([firstId], firstId);
        setStage('pickSecond');
        return;
      }

      const hit = ctx.pickEntityAt(event.world);
      if (!hit || !Number.isFinite(firstId) || !firstPick) {
        ctx.setStatus('Fillet: missing state, restarting');
        reset();
        return;
      }
      const firstEntity = getTargetEntity(firstId);
      if (!firstEntity) {
        ctx.setStatus('Fillet: missing first entity, restarting');
        reset();
        return;
      }
      const secondEntity = getTargetEntity(hit.id);
      if (!secondEntity) {
        ctx.setStatus('Fillet: only line/polyline is supported');
        return;
      }
      if (hit.id === firstId && firstEntity.type !== 'polyline') {
        ctx.setStatus('Fillet: pick a different second entity');
        return;
      }
      const sel = hit.id === firstId ? [firstId] : [firstId, hit.id];
      ctx.selection?.setSelection?.(sel, firstId);
      const result = ctx.commandBus.execute('selection.filletByPick', {
        firstId,
        secondId: hit.id,
        pick1: firstPick,
        pick2: { x: event.world.x, y: event.world.y },
        radius,
      });
      if (result.ok) {
        ctx.setStatus(result.message || 'Fillet applied');
      } else {
        ctx.setStatus(result.message || 'Fillet failed');
      }
      // Continuous mode.
      reset();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Fillet canceled');
      }
    },
  };
}
