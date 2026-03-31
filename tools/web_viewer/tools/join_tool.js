const DEFAULT_JOIN_TOLERANCE = 0.25;

export function getDefaultJoinTolerance() {
  return DEFAULT_JOIN_TOLERANCE;
}

function normalizeTolerance(ctx) {
  const input = ctx.readCommandInput ? ctx.readCommandInput() : null;
  if (!input || typeof input !== 'object') return DEFAULT_JOIN_TOLERANCE;

  if (Number.isFinite(input.tolerance) && Number(input.tolerance) > 0) {
    return Number(input.tolerance);
  }

  const verb = typeof input.verb === 'string' ? input.verb.toLowerCase() : '';
  const args = Array.isArray(input.args) ? input.args : [];
  if ((verb === 'join' || verb === 'j' || verb === 'jo') && args.length > 0) {
    const value = Number.parseFloat(args[0]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return DEFAULT_JOIN_TOLERANCE;
}

function formatExecuteMessage(result, tolerance) {
  if (result?.ok) {
    return result.message || 'Join applied';
  }
  if (result?.error_code === 'NO_MATCH') {
    const fuzz = Number.isFinite(tolerance) ? tolerance.toFixed(2) : '?';
    return `${result.message || 'Join failed'} [NO_MATCH]. Increase join fuzz from ${fuzz} if the gap is intentional.`;
  }
  return result?.message || 'Join failed';
}

function selectionCount(ctx) {
  return Array.isArray(ctx.selection?.entityIds) ? ctx.selection.entityIds.length : 0;
}

function updateStatus(ctx, fallback = '') {
  const count = selectionCount(ctx);
  if (count < 2) {
    ctx.setStatus(fallback || `Join: select ${2 - count} more entity (Shift/Ctrl-click toggles, Enter/right-click applies)`);
    return;
  }
  ctx.setStatus(fallback || 'Join: ready, press Enter or right-click to merge selection');
}

export function createJoinTool(ctx) {
  function executeJoin() {
    const count = selectionCount(ctx);
    if (count < 2) {
      updateStatus(ctx);
      return;
    }
    const tolerance = normalizeTolerance(ctx);
    const payload = Number.isFinite(tolerance) ? { tolerance } : undefined;
    const result = ctx.commandBus.execute('selection.join', payload);
    updateStatus(ctx, formatExecuteMessage(result, tolerance));
  }

  function selectEntity(hit, event) {
    const current = Array.isArray(ctx.selection.entityIds) ? [...ctx.selection.entityIds] : [];
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
      ctx.selection.toggle(hit.id);
      updateStatus(ctx);
      return;
    }

    if (current.includes(hit.id)) {
      ctx.selection.setSelection(current, hit.id);
      updateStatus(ctx, `Join: primary set to entity ${hit.id}`);
      return;
    }

    ctx.selection.add(hit.id);
    updateStatus(ctx, `Join: entity ${hit.id} added (${selectionCount(ctx)} selected)`);
  }

  return {
    id: 'join',
    label: 'Join',
    toolState: 'modifying',
    activate() {
      updateStatus(ctx, 'Join: click entities to build selection, Enter/right-click applies');
    },
    onPointerDown(event) {
      if (event.button === 2) {
        executeJoin();
        return;
      }
      if (event.button !== 0) return;
      const hit = ctx.pickEntityAt(event.world);
      if (!hit) {
        updateStatus(ctx, 'Join: click entity to include, Enter/right-click applies');
        return;
      }
      selectEntity(hit, event);
    },
    onKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeJoin();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        ctx.selection.clear();
        ctx.setStatus('Join canceled');
      }
    },
  };
}
