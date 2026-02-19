export function createChamferTool(ctx) {
  let stage = 'pickFirst'; // pickFirst | pickSecond
  let firstId = null;
  let firstPick = null;
  let d1 = 1.0;
  let d2 = 1.0;

  function syncDistancesFromCommandInput() {
    const input = ctx.readCommandInput?.();
    const args = Array.isArray(input?.args) ? input.args : [];
    const parsed1 = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
    const parsed2 = args.length > 1 ? Number.parseFloat(args[1]) : NaN;
    if (Number.isFinite(parsed1) && parsed1 > 1e-9) {
      d1 = parsed1;
      d2 = Number.isFinite(parsed2) && parsed2 > 1e-9 ? parsed2 : d1;
    }
  }

  function setStage(nextStage) {
    stage = nextStage;
    const msg = `Chamfer: d1=${d1.toFixed(2)} d2=${d2.toFixed(2)}.`;
    if (stage === 'pickFirst') {
      ctx.setStatus(`${msg} Click first line/polyline (Esc to cancel)`);
      return;
    }
    ctx.setStatus(`${msg} Click second line/polyline (Esc to cancel)`);
  }

  function reset() {
    stage = 'pickFirst';
    firstId = null;
    firstPick = null;
    syncDistancesFromCommandInput();
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
    id: 'chamfer',
    label: 'Chamfer',
    toolState: 'idle',
    activate() {
      reset();
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      syncDistancesFromCommandInput();

      if (stage === 'pickFirst') {
        const hit = ctx.pickEntityAt(event.world);
        if (!hit) {
          ctx.setStatus('Chamfer: pick a line/polyline');
          return;
        }
        const target = getTargetEntity(hit.id);
        if (!target) {
          ctx.setStatus('Chamfer: only line/polyline is supported');
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
        ctx.setStatus('Chamfer: missing state, restarting');
        reset();
        return;
      }
      const firstEntity = getTargetEntity(firstId);
      if (!firstEntity) {
        ctx.setStatus('Chamfer: missing first entity, restarting');
        reset();
        return;
      }
      const secondEntity = getTargetEntity(hit.id);
      if (!secondEntity) {
        ctx.setStatus('Chamfer: only line/polyline is supported');
        return;
      }
      if (hit.id === firstId && firstEntity.type !== 'polyline') {
        ctx.setStatus('Chamfer: pick a different second entity');
        return;
      }
      const sel = hit.id === firstId ? [firstId] : [firstId, hit.id];
      ctx.selection?.setSelection?.(sel, firstId);
      const result = ctx.commandBus.execute('selection.chamferByPick', {
        firstId,
        secondId: hit.id,
        pick1: firstPick,
        pick2: { x: event.world.x, y: event.world.y },
        d1,
        d2,
      });
      if (result.ok) {
        ctx.setStatus(result.message || 'Chamfer applied');
      } else {
        ctx.setStatus(result.message || 'Chamfer failed');
      }
      reset();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        reset();
        ctx.setStatus('Chamfer canceled');
      }
    },
  };
}
