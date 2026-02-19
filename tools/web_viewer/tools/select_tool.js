export function createSelectTool(ctx) {
  let dragStart = null;
  let draggingBox = false;
  let gripDrag = null;
  let gripHover = null; // { kind, entityId, index?, point }

  function normalizeAngle(angleRad) {
    let value = angleRad;
    while (value < 0) value += Math.PI * 2;
    while (value >= Math.PI * 2) value -= Math.PI * 2;
    return value;
  }

  function angleFrom(center, point) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return Math.atan2(dy, dx);
  }

  function arcMidAngle(entity) {
    const start = normalizeAngle(Number.isFinite(entity.startAngle) ? entity.startAngle : 0);
    const end = normalizeAngle(Number.isFinite(entity.endAngle) ? entity.endAngle : 0);
    if (entity.cw === true) {
      let delta = end - start;
      if (delta < 0) delta += Math.PI * 2;
      return normalizeAngle(start + delta * 0.5);
    }
    let delta = start - end;
    if (delta < 0) delta += Math.PI * 2;
    return normalizeAngle(start - delta * 0.5);
  }

  function cloneJson(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function clearBox() {
    ctx.canvasView.setTransientOverlay('selectionBox', null);
  }

  function clearGrip() {
    gripDrag = null;
  }

  function clearGripHover() {
    gripHover = null;
    ctx.canvasView.setTransientOverlay('gripHover', null);
  }

  function gripKey(grip) {
    if (!grip) return '';
    const index = Number.isFinite(grip.index) ? String(grip.index) : '';
    return `${grip.entityId}:${grip.kind}:${index}`;
  }

  function updateGripHover(next) {
    const nextKey = gripKey(next);
    const prevKey = gripKey(gripHover);
    if (nextKey === '' && prevKey === '') return;
    if (nextKey !== '' && nextKey === prevKey) return;
    gripHover = next || null;
    if (!gripHover) {
      ctx.canvasView.setTransientOverlay('gripHover', null);
      return;
    }
    ctx.canvasView.setTransientOverlay('gripHover', {
      entityId: gripHover.entityId,
      kind: gripHover.kind,
      point: gripHover.point,
    });
  }

  function withinGripHoverExit(event, entity, exitTolerancePx = 14) {
    if (!gripHover || !event?.screen) return false;
    let point = gripHover.point;
    if (entity) {
      const key = gripKey(gripHover);
      const grips = collectGrips(entity);
      const resolved = grips.find((g) => gripKey(g) === key);
      if (resolved?.point) {
        point = resolved.point;
      }
    }
    const screen = ctx.viewport.worldToScreen(point);
    const dx = screen.x - event.screen.x;
    const dy = screen.y - event.screen.y;
    return dx * dx + dy * dy <= exitTolerancePx * exitTolerancePx;
  }

  function primarySelectionId() {
    if (Number.isFinite(ctx.selection.primaryId)) return ctx.selection.primaryId;
    return Array.isArray(ctx.selection.entityIds) && ctx.selection.entityIds.length > 0 ? ctx.selection.entityIds[0] : null;
  }

  function collectGrips(entity) {
    if (!entity) return [];
    if (entity.type === 'line') {
      return [
        { kind: 'LINE_START', entityId: entity.id, point: entity.start },
        { kind: 'LINE_END', entityId: entity.id, point: entity.end },
      ];
    }
    if (entity.type === 'polyline' && Array.isArray(entity.points)) {
      const grips = entity.points.map((point, index) => ({
        kind: 'POLY_VERTEX',
        entityId: entity.id,
        index,
        point,
      }));
      if (entity.points.length >= 2) {
        for (let i = 0; i < entity.points.length - 1; i += 1) {
          const a = entity.points[i];
          const b = entity.points[i + 1];
          grips.push({
            kind: 'POLY_MID',
            entityId: entity.id,
            index: i,
            point: { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 },
          });
        }
        if (entity.closed === true) {
          const a = entity.points[entity.points.length - 1];
          const b = entity.points[0];
          grips.push({
            kind: 'POLY_MID',
            entityId: entity.id,
            index: entity.points.length - 1,
            point: { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 },
          });
        }
      }
      return grips;
    }
    if (entity.type === 'circle') {
      return [
        { kind: 'CIRCLE_CENTER', entityId: entity.id, point: entity.center },
        { kind: 'CIRCLE_RADIUS', entityId: entity.id, point: { x: entity.center.x + entity.radius, y: entity.center.y } },
      ];
    }
    if (entity.type === 'arc') {
      const startAngle = Number.isFinite(entity.startAngle) ? entity.startAngle : 0;
      const endAngle = Number.isFinite(entity.endAngle) ? entity.endAngle : 0;
      const radius = Math.max(0.001, Number(entity.radius || 0));
      const midAngle = arcMidAngle(entity);
      const start = {
        x: entity.center.x + radius * Math.cos(startAngle),
        y: entity.center.y + radius * Math.sin(startAngle),
      };
      const end = {
        x: entity.center.x + radius * Math.cos(endAngle),
        y: entity.center.y + radius * Math.sin(endAngle),
      };
      const mid = {
        x: entity.center.x + radius * Math.cos(midAngle),
        y: entity.center.y + radius * Math.sin(midAngle),
      };
      return [
        { kind: 'ARC_CENTER', entityId: entity.id, point: entity.center },
        { kind: 'ARC_START', entityId: entity.id, point: start },
        { kind: 'ARC_END', entityId: entity.id, point: end },
        { kind: 'ARC_RADIUS', entityId: entity.id, point: mid },
      ];
    }
    if (entity.type === 'text') {
      return [{ kind: 'TEXT_POS', entityId: entity.id, point: entity.position }];
    }
    return [];
  }

  function hitTestGrip(event, grips, tolerancePx = 9) {
    if (!event?.screen) return null;
    const tolSq = tolerancePx * tolerancePx;
    let best = null;
    let bestDistSq = tolSq;
    for (const grip of grips) {
      const screen = ctx.viewport.worldToScreen(grip.point);
      const dx = screen.x - event.screen.x;
      const dy = screen.y - event.screen.y;
      const dSq = dx * dx + dy * dy;
      if (dSq <= bestDistSq) {
        bestDistSq = dSq;
        best = grip;
      }
    }
    return best;
  }

  function applyGripPatch(entity, grip, targetPoint) {
    if (!entity || !grip) return null;
    if (grip.kind === 'LINE_START') {
      return { start: { ...targetPoint } };
    }
    if (grip.kind === 'LINE_END') {
      return { end: { ...targetPoint } };
    }
    if (grip.kind === 'POLY_VERTEX') {
      const points = Array.isArray(entity.points) ? entity.points.map((point) => ({ ...point })) : [];
      if (!Number.isFinite(grip.index) || grip.index < 0 || grip.index >= points.length) return null;
      points[grip.index] = { ...targetPoint };
      return { points };
    }
    if (grip.kind === 'POLY_MID') {
      const points = Array.isArray(entity.points) ? entity.points.map((point) => ({ ...point })) : [];
      if (!Number.isFinite(grip.index) || grip.index < 0 || grip.index >= points.length) return null;
      if (points.length < 2) return null;
      const insertIndex = grip.index === points.length - 1 && entity.closed === true ? points.length : grip.index + 1;
      points.splice(insertIndex, 0, { ...targetPoint });
      return { points };
    }
    if (grip.kind === 'CIRCLE_CENTER') {
      return { center: { ...targetPoint } };
    }
    if (grip.kind === 'CIRCLE_RADIUS') {
      const dx = targetPoint.x - entity.center.x;
      const dy = targetPoint.y - entity.center.y;
      const radius = Math.max(0.001, Math.hypot(dx, dy));
      return { radius };
    }
    if (grip.kind === 'ARC_CENTER') {
      return { center: { ...targetPoint } };
    }
    if (grip.kind === 'ARC_START') {
      return { startAngle: angleFrom(entity.center, targetPoint) };
    }
    if (grip.kind === 'ARC_END') {
      return { endAngle: angleFrom(entity.center, targetPoint) };
    }
    if (grip.kind === 'ARC_RADIUS') {
      const dx = targetPoint.x - entity.center.x;
      const dy = targetPoint.y - entity.center.y;
      const radius = Math.max(0.001, Math.hypot(dx, dy));
      return { radius };
    }
    if (grip.kind === 'TEXT_POS') {
      return { position: { ...targetPoint } };
    }
    return null;
  }

  function deletePolylineVertex(entity, index) {
    if (!entity || entity.type !== 'polyline' || !Array.isArray(entity.points)) return false;
    const points = entity.points.map((point) => ({ ...point }));
    const minVertices = entity.closed === true ? 3 : 2;
    if (!Number.isFinite(index) || index < 0 || index >= points.length) return false;
    if (points.length <= minVertices) return false;
    points.splice(index, 1);
    const result = ctx.commandBus.execute('selection.propertyPatch', {
      entityIds: [entity.id],
      patch: { points },
    });
    return result.ok && result.changed;
  }

  return {
    id: 'select',
    label: 'Select',
    toolState: 'idle',
    activate() {
      ctx.setStatus('Select: click entity, drag box, Delete to remove. Double-click a polyline vertex grip to delete.');
      clearBox();
      clearGrip();
      clearGripHover();
    },
    deactivate() {
      dragStart = null;
      draggingBox = false;
      clearGrip();
      clearBox();
      clearGripHover();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;

      if (gripDrag) {
        return;
      }

      // Prefer grips when a primary entity is selected.
      const primaryId = primarySelectionId();
      if (Number.isFinite(primaryId)) {
        const entity = ctx.document.getEntity(primaryId);
        const grip = hitTestGrip(event, collectGrips(entity));
        if (grip) {
          const layer = entity ? ctx.document.getLayer(entity.layerId) : null;
          if (layer?.locked) {
            ctx.setStatus(`Layer ${layer.name} is locked`);
            return;
          }

          if (grip.kind === 'POLY_VERTEX' && event.detail >= 2) {
            const ok = deletePolylineVertex(entity, grip.index);
            ctx.setStatus(ok ? 'Vertex deleted' : 'Vertex delete blocked');
            return;
          }

          clearGripHover();
          const before = entity ? cloneJson(entity) : null;
          // Midpoint grip inserts a new vertex and then behaves like a vertex grip drag.
          if (grip.kind === 'POLY_MID' && entity?.type === 'polyline') {
            const snapped = ctx.resolveSnappedPoint(event.world);
            const insertPatch = applyGripPatch(entity, grip, snapped.point);
            if (!insertPatch) return;
            ctx.document.updateEntity(entity.id, { ...entity, ...insertPatch });
            // Convert to a vertex grip on the inserted index.
            const insertIndex = grip.index === entity.points.length - 1 && entity.closed === true
              ? entity.points.length
              : grip.index + 1;
            gripDrag = {
              entityId: grip.entityId,
              grip: {
                kind: 'POLY_VERTEX',
                entityId: grip.entityId,
                index: insertIndex,
                point: snapped.point,
              },
              before,
              lastPatch: insertPatch, // commit even if user does not move after click
            };
            ctx.setStatus('Grip: drag new vertex, Esc to cancel');
            return;
          }

          gripDrag = {
            entityId: grip.entityId,
            grip,
            before,
            lastPatch: null,
          };
          ctx.setStatus('Grip: drag to edit, Esc to cancel');
          return;
        }
      }

      const hit = ctx.pickEntityAt(event.world);
      if (hit) {
        clearGripHover();
        if (event.shiftKey) {
          ctx.selection.toggle(hit.id);
        } else {
          ctx.selection.setSelection([hit.id], hit.id);
        }
        return;
      }
      dragStart = { ...event.world };
      draggingBox = true;
      clearGripHover();
      if (!event.shiftKey) {
        ctx.selection.clear();
      }
    },
    onPointerMove(event) {
      // Keep snap hint responsive even when not drawing.
      const snapped = ctx.resolveSnappedPoint(event.world);

      if (gripDrag) {
        const entity = ctx.document.getEntity(gripDrag.entityId);
        if (!entity) return;
        const patch = applyGripPatch(entity, gripDrag.grip, snapped.point);
        if (!patch) return;
        gripDrag.lastPatch = patch;
        ctx.document.updateEntity(gripDrag.entityId, { ...entity, ...patch });
        return;
      }

      // Grip hover highlight (primary entity only).
      const primaryId = primarySelectionId();
      if (!draggingBox && Number.isFinite(primaryId)) {
        const entity = ctx.document.getEntity(primaryId);
        const enterTolerancePx = 10;
        const grip = hitTestGrip(event, collectGrips(entity), enterTolerancePx);
        if (grip) {
          updateGripHover(grip);
        } else if (withinGripHoverExit(event, entity, 14)) {
          // Hysteresis: avoid hover flicker when cursor jitter is near the handle.
        } else {
          updateGripHover(null);
        }
      } else if (!draggingBox) {
        updateGripHover(null);
      }

      if (!draggingBox || !dragStart) return;
      ctx.canvasView.setTransientOverlay('selectionBox', {
        x0: dragStart.x,
        y0: dragStart.y,
        x1: event.world.x,
        y1: event.world.y,
      });
    },
    onPointerUp(event) {
      if (gripDrag) {
        const entity = ctx.document.getEntity(gripDrag.entityId);
        const before = gripDrag.before;
        const patch = gripDrag.lastPatch;
        clearGrip();
        if (!entity || !before || !patch) {
          return;
        }

        // Rewind to pre-drag so the final commit is recorded in history as one operation.
        ctx.document.updateEntity(before.id, before);
        const result = ctx.commandBus.execute('selection.propertyPatch', {
          entityIds: [before.id],
          patch,
        });
        if (!result.ok) {
          ctx.setStatus(result.message || 'Grip edit failed');
        } else {
          ctx.setStatus('Grip edit applied');
        }
        return;
      }

      if (!draggingBox || !dragStart) return;
      const rect = {
        x0: dragStart.x,
        y0: dragStart.y,
        x1: event.world.x,
        y1: event.world.y,
      };
      const area = Math.abs((rect.x1 - rect.x0) * (rect.y1 - rect.y0));
      if (area > 1e-6) {
        const crossing = rect.x1 < rect.x0;
        const result = ctx.commandBus.execute('selection.box', { rect, crossing });
        if (!result.ok) {
          ctx.setStatus(result.message || 'Box select failed');
        }
      }
      dragStart = null;
      draggingBox = false;
      clearBox();
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        if (gripDrag?.before) {
          ctx.document.updateEntity(gripDrag.before.id, gripDrag.before);
          clearGrip();
          ctx.setStatus('Grip canceled');
          return;
        }
        if (draggingBox) {
          dragStart = null;
          draggingBox = false;
          clearBox();
          ctx.setStatus('Selection box canceled');
          return;
        }
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        const result = ctx.commandBus.execute('selection.delete');
        ctx.setStatus(result.message || 'Delete');
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const ids = ctx.document.listVisibleEntities().map((entity) => entity.id);
        ctx.selection.setSelection(ids, ids[0] ?? null);
      }
    },
  };
}
