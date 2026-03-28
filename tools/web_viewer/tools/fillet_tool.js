export function createFilletTool(ctx) {
  const pickTolerancePx = 18;
  let stage = 'pickFirst'; // pickFirst | pickSecond
  let firstId = null;
  let firstPick = null;
  let radius = 1.0;
  let activationSelectedId = null;
  let activationSelectedPair = null;
  let activationSelectedType = null;
  let pickFirstSelectionKey = '';

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
    if (activationSelectedPair) {
      ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click near corner on either selected target (Esc to cancel)`);
      return;
    }
    if (Number.isFinite(activationSelectedId) && activationSelectedType === 'polyline') {
      if (!firstPick) {
        ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click near first side on selected polyline (Esc to cancel)`);
        return;
      }
      ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click near second side on selected polyline (Esc to cancel)`);
      return;
    }
    ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click second line/polyline (Esc to cancel)`);
  }

  function reset() {
    stage = 'pickFirst';
    firstId = null;
    firstPick = null;
    activationSelectedPair = null;
    activationSelectedType = null;
    syncRadiusFromCommandInput();
    pickFirstSelectionKey = currentSelectionKey();
    setStage(stage);
  }

  function getTargetEntity(id) {
    const entity = ctx.document?.getEntity?.(id);
    if (!entity) return null;
    if (entity.type === 'line') return entity;
    if (entity.type === 'polyline') return entity;
    return null;
  }

  function getSelectedTargetIds() {
    const ids = Array.isArray(ctx.selection?.entityIds)
      ? ctx.selection.entityIds.filter((id) => Number.isFinite(id)).map((id) => Number(id))
      : [];
    return ids.filter((id) => !!getTargetEntity(id));
  }

  function getSingleSelectedTargetId() {
    const ids = getSelectedTargetIds();
    if (ids.length !== 1) return null;
    return ids[0];
  }

  function getSelectedTargetPair() {
    const ids = getSelectedTargetIds();
    if (ids.length !== 2) return null;
    const primary = Number.isFinite(ctx.selection?.primaryId) ? Number(ctx.selection.primaryId) : null;
    let first = ids[0];
    if (Number.isFinite(primary) && ids.includes(primary)) {
      first = primary;
    }
    const second = ids.find((id) => id !== first);
    if (!Number.isFinite(second)) return null;
    return { firstId: first, secondId: second };
  }

  function currentSelectionKey() {
    const ids = Array.isArray(ctx.selection?.entityIds)
      ? ctx.selection.entityIds.filter((id) => Number.isFinite(id)).map((id) => Number(id))
      : [];
    if (ids.length === 0) return '';
    return ids.join(',');
  }

  function projectPointToSegment(point, a, b) {
    if (!a || !b) return null;
    const ax = Number(a.x);
    const ay = Number(a.y);
    const bx = Number(b.x);
    const by = Number(b.y);
    if (![ax, ay, bx, by].every(Number.isFinite)) return null;
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 <= 1e-12) return { x: ax, y: ay };
    const px = Number(point?.x);
    const py = Number(point?.y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) {
      return { x: (ax + bx) * 0.5, y: (ay + by) * 0.5 };
    }
    let t = ((px - ax) * vx + (py - ay) * vy) / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    return { x: ax + vx * t, y: ay + vy * t };
  }

  function resolveEntityPickPoint(entity, referencePoint) {
    if (!entity) return null;
    if (entity.type === 'line') {
      return projectPointToSegment(referencePoint, entity.start, entity.end)
        || projectPointToSegment(null, entity.start, entity.end)
        || { x: 0, y: 0 };
    }
    if (entity.type === 'polyline' && Array.isArray(entity.points) && entity.points.length >= 2) {
      let best = null;
      let bestDist2 = Number.POSITIVE_INFINITY;
      for (let i = 0; i < entity.points.length - 1; i += 1) {
        const projected = projectPointToSegment(referencePoint, entity.points[i], entity.points[i + 1]);
        if (!projected) continue;
        const dx = projected.x - Number(referencePoint?.x ?? projected.x);
        const dy = projected.y - Number(referencePoint?.y ?? projected.y);
        const dist2 = dx * dx + dy * dy;
        if (dist2 < bestDist2) {
          bestDist2 = dist2;
          best = projected;
        }
      }
      if (best) return best;
      return projectPointToSegment(null, entity.points[0], entity.points[1]) || { x: 0, y: 0 };
    }
    return { x: Number(referencePoint?.x) || 0, y: Number(referencePoint?.y) || 0 };
  }

  function resolvePickTarget(worldPoint, allowSelectionFallback) {
    const hit = ctx.pickEntityAt?.(worldPoint, pickTolerancePx) || ctx.pickEntityAt?.(worldPoint);
    if (hit && Number.isFinite(hit.id)) {
      return { id: Number(hit.id), fromSelection: false };
    }
    if (!allowSelectionFallback) return null;
    const selectedId = getSingleSelectedTargetId();
    if (!Number.isFinite(selectedId)) return null;
    return { id: selectedId, fromSelection: true };
  }

  function formatCommandStatus(result, okFallback, failFallback) {
    const base = result?.message || (result?.ok ? okFallback : failFallback);
    if (result?.ok || !result?.error_code) {
      return base;
    }
    return `${base} [${String(result.error_code)}]`;
  }

  return {
    id: 'fillet',
    label: 'Fillet',
    toolState: 'idle',
    activate() {
      activationSelectedPair = getSelectedTargetPair();
      activationSelectedId = getSingleSelectedTargetId();
      const selectedEntity = Number.isFinite(activationSelectedId) ? getTargetEntity(activationSelectedId) : null;
      activationSelectedType = selectedEntity?.type || null;
      syncRadiusFromCommandInput();
      if (activationSelectedPair) {
        stage = 'pickSecond';
        firstId = activationSelectedPair.firstId;
        firstPick = null;
        setStage(stage);
        return;
      }
      if (Number.isFinite(activationSelectedId)) {
        stage = 'pickSecond';
        firstId = activationSelectedId;
        firstPick = null;
        setStage(stage);
        return;
      }
      reset();
    },
    deactivate() {
      activationSelectedId = null;
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      syncRadiusFromCommandInput();

      const executeSecondPick = (secondId, secondPick) => {
        if (!Number.isFinite(firstId) || !firstPick) {
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
        const secondEntity = getTargetEntity(secondId);
        if (!secondEntity) {
          ctx.setStatus('Fillet: only line/polyline is supported');
          return;
        }
        if (secondId === firstId && firstEntity.type !== 'polyline') {
          ctx.setStatus('Fillet: pick a different second entity');
          return;
        }
        const sel = secondId === firstId ? [firstId] : [firstId, secondId];
        ctx.selection?.setSelection?.(sel, firstId);
        const result = ctx.commandBus.execute('selection.filletByPick', {
          firstId,
          secondId,
          pick1: firstPick,
          pick2: secondPick,
          radius,
        });
        if (result.ok) {
          ctx.setStatus(formatCommandStatus(result, 'Fillet applied', 'Fillet failed'));
          // Continuous mode: successful operation resets to first-pick.
          reset();
        } else {
          // Keep second-pick stage on failure so the user can retry without rebuilding first pick.
          ctx.setStatus(formatCommandStatus(result, 'Fillet applied', 'Fillet failed'));
        }
      };

      if (stage === 'pickFirst') {
        const hit = resolvePickTarget(event.world, true);
        if (!hit) {
          ctx.setStatus('Fillet: pick a line/polyline');
          return;
        }
        const target = getTargetEntity(hit.id);
        if (!target) {
          ctx.setStatus('Fillet: only line/polyline is supported');
          return;
        }
        const preselectedId = getSingleSelectedTargetId();
        const selectionChangedSinceReset = currentSelectionKey() !== pickFirstSelectionKey;
        const allowPreselectFastPath =
          Number.isFinite(preselectedId)
          && preselectedId !== hit.id
          && (preselectedId === activationSelectedId || selectionChangedSinceReset);
        if (allowPreselectFastPath) {
          const preselectedEntity = getTargetEntity(preselectedId);
          if (preselectedEntity) {
            activationSelectedId = preselectedId;
            activationSelectedType = preselectedEntity.type;
            firstId = preselectedId;
            firstPick = resolveEntityPickPoint(preselectedEntity, event.world);
            stage = 'pickSecond';
            executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
            return;
          }
        }
        firstId = hit.id;
        firstPick = { x: event.world.x, y: event.world.y };
        ctx.selection?.setSelection?.([firstId], firstId);
        setStage('pickSecond');
        return;
      }
      if (activationSelectedPair) {
        const hit = resolvePickTarget(event.world, false);
        if (!hit
            || (hit.id !== activationSelectedPair.firstId && hit.id !== activationSelectedPair.secondId)) {
          setStage('pickSecond');
          return;
        }
        const pairFirstId = hit.id;
        const pairSecondId = pairFirstId === activationSelectedPair.firstId
          ? activationSelectedPair.secondId
          : activationSelectedPair.firstId;
        const pairFirstEntity = getTargetEntity(pairFirstId);
        const pairSecondEntity = getTargetEntity(pairSecondId);
        if (!pairFirstEntity || !pairSecondEntity) {
          ctx.setStatus('Fillet: selected pair no longer available, restarting');
          reset();
          return;
        }
        firstId = pairFirstId;
        firstPick = resolveEntityPickPoint(pairFirstEntity, event.world) || { x: event.world.x, y: event.world.y };
        const secondPick = resolveEntityPickPoint(pairSecondEntity, event.world) || { x: event.world.x, y: event.world.y };
        executeSecondPick(pairSecondId, secondPick);
        return;
      }
      const firstEntity = getTargetEntity(firstId);
      if (!firstEntity) {
        ctx.setStatus('Fillet: missing first entity, restarting');
        reset();
        return;
      }
      const hit = resolvePickTarget(event.world, true);
      if (!hit) {
        ctx.setStatus(`Fillet: radius=${radius.toFixed(2)}. Click second line/polyline (Esc to cancel)`);
        return;
      }
      if (hit.id === firstId
          && hit.fromSelection
          && firstEntity.type === 'polyline'
          && firstPick) {
        // For same-entity polyline fillet, fallback selection hit can still be valid:
        // use the current pointer as second-side pick and let command-level segment resolve decide.
        executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
        return;
      }
      if (hit.id === firstId && (hit.fromSelection || firstEntity.type === 'line' || !firstPick)) {
        // Keep second-pick stage active; only update first-side pick on real hit, never on selection fallback.
        if (!hit.fromSelection) {
          firstPick = { x: event.world.x, y: event.world.y };
        }
        setStage('pickSecond');
        return;
      }
      if (!firstPick) {
        firstPick = resolveEntityPickPoint(firstEntity, event.world) || { x: event.world.x, y: event.world.y };
      }
      executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        activationSelectedId = null;
        reset();
        ctx.setStatus('Fillet canceled');
      }
    },
  };
}
