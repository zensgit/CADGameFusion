export function createBreakTool(ctx) {
  let stage = 'pickTarget'; // pickTarget | pickPoint | pickPoint2
  let targetId = null;
  let firstPoint = null;

  function setStage(nextStage) {
    stage = nextStage;
    if (stage === 'pickTarget') {
      ctx.setStatus('Break: click entity (line/polyline), then click break point (Shift+click for two-point)');
      return;
    }
    if (stage === 'pickPoint') {
      ctx.setStatus('Break: click break point (Shift+click for two-point break)');
      return;
    }
    if (stage === 'pickPoint2') {
      ctx.setStatus('Break(two-point): click second point (Break Keep toggle, Ctrl/Cmd=short, Alt=long for closed polylines)');
    }
  }

  function reset() {
    setStage('pickTarget');
    targetId = null;
    firstPoint = null;
  }

  function preselectPrimary() {
    if (Array.isArray(ctx.selection.entityIds) && ctx.selection.entityIds.length > 0) {
      const primary = Number.isFinite(ctx.selection.primaryId) ? ctx.selection.primaryId : ctx.selection.entityIds[0];
      if (Number.isFinite(primary)) {
        targetId = Number(primary);
        setStage('pickPoint');
        return true;
      }
    }
    return false;
  }

  return {
    id: 'break',
    label: 'Break',
    toolState: 'idle',
    activate() {
      reset();
      if (preselectPrimary()) {
        // status set by setStage()
      } else {
        // status set by setStage()
      }
    },
    deactivate() {
      reset();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;

      if (stage === 'pickTarget') {
        const hit = ctx.pickEntityAt(event.world);
        if (!hit) {
          ctx.setStatus('Break: pick a target entity (line/polyline)');
          return;
        }
        ctx.selection.setSelection([hit.id], hit.id);
        targetId = hit.id;
        setStage('pickPoint');
        return;
      }

      if (stage === 'pickPoint') {
        const snapped = ctx.resolveSnappedPoint(event.world);
        if (!Number.isFinite(targetId)) {
          ctx.setStatus('Break: missing target');
          reset();
          return;
        }
        // Ensure selection exists for canExecute().
        ctx.selection.setSelection([targetId], targetId);

        if (event.shiftKey) {
          firstPoint = snapped.point;
          setStage('pickPoint2');
          return;
        }

        const result = ctx.commandBus.execute('selection.break', {
          targetId,
          pick: snapped.point,
        });
        if (result.ok) {
          ctx.setStatus(result.message || 'Break applied');
        } else {
          ctx.setStatus(result.message || 'Break failed');
        }
        // Continuous mode: stay in tool and accept next target.
        reset();
        return;
      }

      if (stage === 'pickPoint2') {
        const snapped = ctx.resolveSnappedPoint(event.world);
        if (!Number.isFinite(targetId) || !firstPoint) {
          ctx.setStatus('Break: missing state');
          reset();
          return;
        }
        ctx.selection.setSelection([targetId], targetId);
        let keep = undefined;
        try {
          const entity = ctx.document?.getEntity?.(targetId);
          if (entity?.type === 'polyline' && entity.closed === true) {
            const override = ctx.toolOptions?.breakKeep;
            if (override === 'short' || override === 'long') {
              keep = override;
            } else if (event.altKey) {
              keep = 'long';
            } else if (event.metaKey || event.ctrlKey) {
              keep = 'short';
            }
          }
        } catch {
          keep = undefined;
        }
        const result = ctx.commandBus.execute('selection.break', {
          targetId,
          pick: firstPoint,
          pick2: snapped.point,
          ...(keep ? { keep } : {}),
        });
        if (result.ok) {
          ctx.setStatus(result.message || 'Break(two-point) applied');
        } else {
          ctx.setStatus(result.message || 'Break(two-point) failed');
        }
        reset();
      }
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        if (stage === 'pickPoint2' && Number.isFinite(targetId)) {
          // Allow backing out of two-point mode without losing the target.
          firstPoint = null;
          setStage('pickPoint');
          return;
        }
        reset();
        ctx.setStatus('Break canceled');
      }
    },
  };
}
