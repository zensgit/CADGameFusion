import { computeOffsetEntity } from './geometry.js';

export function createOffsetTool(ctx) {
  let stage = 'pickTargets'; // pickTargets | pickSide
  let targetIds = [];
  let distance = 5;

  function clearPreview() {
    ctx.canvasView.setTransientOverlay('linePreview', null);
    ctx.canvasView.setTransientOverlay('polylinePreview', null);
    ctx.canvasView.setTransientOverlay('circlePreview', null);
    ctx.canvasView.setTransientOverlay('arcPreview', null);
  }

  function syncDistanceFromCommandInput() {
    const input = ctx.readCommandInput?.();
    const args = Array.isArray(input?.args) ? input.args : [];
    const parsed = args.length > 0 ? Number.parseFloat(args[0]) : NaN;
    if (Number.isFinite(parsed) && Math.abs(parsed) > 1e-9) {
      distance = Math.abs(parsed);
    }
  }

  function setTargetsFromSelectionOrHit(worldPoint) {
    if (ctx.selection.entityIds.length > 0) {
      targetIds = [...ctx.selection.entityIds];
      return true;
    }
    const hit = ctx.pickEntityAt(worldPoint);
    if (!hit) return false;
    ctx.selection.setSelection([hit.id], hit.id);
    targetIds = [hit.id];
    return true;
  }

  function previewOffset(sidePoint) {
    if (targetIds.length === 0) {
      clearPreview();
      return;
    }
    const primaryId = targetIds[0];
    const entity = ctx.document.getEntity(primaryId);
    if (!entity) {
      clearPreview();
      return;
    }
    const preview = computeOffsetEntity(entity, sidePoint, distance);
    clearPreview();
    if (!preview) return;
    if (preview.type === 'line') {
      ctx.canvasView.setTransientOverlay('linePreview', { start: preview.start, end: preview.end });
    } else if (preview.type === 'polyline') {
      ctx.canvasView.setTransientOverlay('polylinePreview', { points: preview.points });
    } else if (preview.type === 'circle') {
      ctx.canvasView.setTransientOverlay('circlePreview', { center: preview.center, radius: preview.radius });
    } else if (preview.type === 'arc') {
      ctx.canvasView.setTransientOverlay('arcPreview', {
        center: preview.center,
        radius: preview.radius,
        startAngle: preview.startAngle,
        endAngle: preview.endAngle,
        cw: preview.cw === true,
      });
    }
  }

  return {
    id: 'offset',
    label: 'Offset',
    toolState: 'idle',
    activate() {
      stage = 'pickTargets';
      targetIds = [];
      syncDistanceFromCommandInput();
      clearPreview();
      ctx.setStatus(`Offset: distance=${distance.toFixed(2)}. Click target(s) or preselect, then click side.`);
    },
    deactivate() {
      stage = 'pickTargets';
      targetIds = [];
      clearPreview();
    },
    onPointerDown(event) {
      if (event.button !== 0) return;
      if (stage === 'pickTargets') {
        syncDistanceFromCommandInput();
        const ok = setTargetsFromSelectionOrHit(event.world);
        if (!ok) {
          ctx.setStatus('Offset: pick a target entity (line/polyline/circle/arc)');
          return;
        }
        stage = 'pickSide';
        ctx.setStatus(`Offset: pick side point (distance=${distance.toFixed(2)})`);
        return;
      }

      const snapped = ctx.resolveSnappedPoint(event.world);
      const result = ctx.commandBus.execute('selection.offset', {
        distance,
        sidePoint: snapped.point,
      });
      clearPreview();
      if (result.ok) {
        ctx.setStatus(result.message || 'Offset applied');
      } else {
        ctx.setStatus(result.message || 'Offset failed');
      }
      stage = 'pickTargets';
      targetIds = [];
    },
    onPointerMove(event) {
      if (stage !== 'pickSide') return;
      const snapped = ctx.resolveSnappedPoint(event.world);
      previewOffset(snapped.point);
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        stage = 'pickTargets';
        targetIds = [];
        clearPreview();
        ctx.setStatus('Offset canceled');
      }
    },
  };
}
