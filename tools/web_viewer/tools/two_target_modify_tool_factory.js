import {
  currentSelectionKey as currentSelectionKeyHelper,
  findEntitiesMeetingAtPoint,
  formatCommandStatus,
  getSelectedTargetPair as getSelectedTargetPairHelper,
  getSingleSelectedTargetId as getSingleSelectedTargetIdHelper,
  getTargetEntityById,
  resolveEntityPickPoint,
  resolvePickTarget,
  suggestFilletRadius,
} from './two_target_pick_tool_helpers.js';

export function createTwoTargetModifyTool(ctx, config) {
  const pickTolerancePx = Number.isFinite(config?.pickTolerancePx) ? Number(config.pickTolerancePx) : 18;
  const supportedTargetText = `${config.label}: only line/polyline/arc/circle is supported`;
  const pickFirstHint = `${config.label}: pick a line/polyline/arc/circle`;
  let stage = 'pickFirst';
  let firstId = null;
  let firstPick = null;
  let firstPickFromFallback = false;
  let activationSelectedId = null;
  let activationSelectedPair = null;
  let activationSelectedType = null;
  let pickFirstSelectionKey = '';
  const params = config.createInitialParams ? config.createInitialParams() : {};

  const getTargetEntity = (id) => getTargetEntityById(ctx, id);
  const getSingleSelectedTargetId = () => getSingleSelectedTargetIdHelper(ctx, getTargetEntityById);
  const getSelectedTargetPair = () => getSelectedTargetPairHelper(ctx, getTargetEntityById);
  const currentSelectionKey = () => currentSelectionKeyHelper(ctx);
  const resolvePickTargetForCtx = (worldPoint, allowSelectionFallback) => resolvePickTarget(
    ctx,
    worldPoint,
    pickTolerancePx,
    (toolCtx) => getSingleSelectedTargetIdHelper(toolCtx, getTargetEntityById),
    allowSelectionFallback,
  );

  const syncParamsFromCommandInput = () => {
    config.syncParamsFromCommandInput?.(params, ctx.readCommandInput?.());
  };

  const setStatus = (message) => {
    if (typeof message === 'string' && message.length > 0) {
      ctx.setStatus(message);
    }
  };

  const setStage = (nextStage) => {
    stage = nextStage;
    const prefix = config.formatPromptPrefix(params);
    if (stage === 'pickFirst') {
      setStatus(`${prefix} ${config.pickFirstPrompt} (Esc to cancel)`);
      return;
    }
    if (activationSelectedPair) {
      setStatus(`${prefix} ${config.pairPrompt} (Esc to cancel)`);
      return;
    }
    if (Number.isFinite(activationSelectedId) && activationSelectedType === 'polyline') {
      const polylinePrompt = firstPick ? config.polylineSecondPrompt : config.polylineFirstPrompt;
      setStatus(`${prefix} ${polylinePrompt} (Esc to cancel)`);
      return;
    }
    setStatus(`${prefix} ${config.pickSecondPrompt} (Esc to cancel)`);
  };

  const reset = () => {
    stage = 'pickFirst';
    firstId = null;
    firstPick = null;
    firstPickFromFallback = false;
    activationSelectedPair = null;
    activationSelectedType = null;
    syncParamsFromCommandInput();
    pickFirstSelectionKey = currentSelectionKey();
    setStage(stage);
  };

  const executeSecondPick = (secondId, secondPick) => {
    if (!Number.isFinite(firstId) || !firstPick) {
      setStatus(`${config.label}: missing state, restarting`);
      reset();
      return;
    }
    const firstEntity = getTargetEntity(firstId);
    if (!firstEntity) {
      setStatus(`${config.label}: missing first entity, restarting`);
      reset();
      return;
    }
    const secondEntity = getTargetEntity(secondId);
    if (!secondEntity) {
      setStatus(supportedTargetText);
      return;
    }
    if (secondId === firstId && firstEntity.type !== 'polyline') {
      setStatus(`${config.label}: pick a different second entity`);
      return;
    }
    const sel = secondId === firstId ? [firstId] : [firstId, secondId];
    ctx.selection?.setSelection?.(sel, firstId);
    const command = config.buildCommand({
      firstId,
      secondId,
      firstPick,
      secondPick,
      params,
    });
    const result = ctx.commandBus.execute(command.id, command.payload);
    setStatus(formatCommandStatus(result, command.okStatus, command.failStatus));
    if (result.ok) {
      reset();
    }
  };

  return {
    id: config.id,
    label: config.label,
    toolState: 'idle',
    activate() {
      activationSelectedPair = getSelectedTargetPair();
      activationSelectedId = getSingleSelectedTargetId();
      const selectedEntity = Number.isFinite(activationSelectedId) ? getTargetEntity(activationSelectedId) : null;
      activationSelectedType = selectedEntity?.type || null;
      syncParamsFromCommandInput();
      if (activationSelectedPair) {
        stage = 'pickSecond';
        firstId = activationSelectedPair.firstId;
        firstPick = null;
        firstPickFromFallback = false;
        setStage(stage);
        return;
      }
      if (Number.isFinite(activationSelectedId)) {
        stage = 'pickSecond';
        firstId = activationSelectedId;
        firstPick = null;
        firstPickFromFallback = false;
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
      syncParamsFromCommandInput();

      if (stage === 'pickFirst') {
        // Vertex-pick: single-click at a vertex where exactly 2 target entities meet
        const vertexMatch = findEntitiesMeetingAtPoint(ctx, event.world, pickTolerancePx * (ctx.pixelSize || 1));
        if (vertexMatch) {
          const ent1 = getTargetEntity(vertexMatch.id1);
          const ent2 = getTargetEntity(vertexMatch.id2);
          if (ent1 && ent2) {
            firstId = vertexMatch.id1;
            firstPick = { x: vertexMatch.vertex.x, y: vertexMatch.vertex.y };
            firstPickFromFallback = false;
            ctx.selection?.setSelection?.([vertexMatch.id1, vertexMatch.id2], vertexMatch.id1);
            stage = 'pickSecond';
            executeSecondPick(vertexMatch.id2, { x: vertexMatch.vertex.x, y: vertexMatch.vertex.y });
            return;
          }
        }

        const hit = resolvePickTargetForCtx(event.world, true);
        if (!hit) {
          setStatus(pickFirstHint);
          return;
        }
        const target = getTargetEntity(hit.id);
        if (!target) {
          setStatus(supportedTargetText);
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
            firstPickFromFallback = false;
            stage = 'pickSecond';
            executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
            return;
          }
        }
        firstId = hit.id;
        firstPick = { x: event.world.x, y: event.world.y };
        firstPickFromFallback = false;
        ctx.selection?.setSelection?.([firstId], firstId);
        setStage('pickSecond');
        return;
      }

      if (activationSelectedPair) {
        const hit = resolvePickTargetForCtx(event.world, false);
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
          setStatus(`${config.label}: selected pair no longer available, restarting`);
          reset();
          return;
        }
        firstId = pairFirstId;
        firstPick = resolveEntityPickPoint(pairFirstEntity, event.world) || { x: event.world.x, y: event.world.y };
        firstPickFromFallback = false;
        const secondPick = resolveEntityPickPoint(pairSecondEntity, event.world) || { x: event.world.x, y: event.world.y };
        executeSecondPick(pairSecondId, secondPick);
        return;
      }

      const firstEntity = getTargetEntity(firstId);
      if (!firstEntity) {
        setStatus(`${config.label}: missing first entity, restarting`);
        reset();
        return;
      }
      const hit = resolvePickTargetForCtx(event.world, true);
      if (!hit) {
        setStatus(`${config.formatPromptPrefix(params)} ${config.pickSecondPrompt} (Esc to cancel)`);
        return;
      }
      if (hit.id === firstId
          && hit.fromSelection
          && firstEntity.type === 'polyline'
          && firstPick) {
        if (config.shouldBlockSameEntitySelectionFallback?.({ firstEntity, firstPickFromFallback }) === true) {
          setStage('pickSecond');
          return;
        }
        executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
        return;
      }
      if (hit.id === firstId && (hit.fromSelection || firstEntity.type === 'line' || !firstPick)) {
        if (firstEntity.type === 'polyline' && !firstPick && hit.fromSelection) {
          firstPick = { x: event.world.x, y: event.world.y };
          firstPickFromFallback = true;
        } else if (!hit.fromSelection) {
          firstPick = { x: event.world.x, y: event.world.y };
          firstPickFromFallback = false;
        }
        setStage('pickSecond');
        return;
      }
      if (!firstPick) {
        firstPick = resolveEntityPickPoint(firstEntity, event.world) || { x: event.world.x, y: event.world.y };
        firstPickFromFallback = false;
      }
      executeSecondPick(hit.id, { x: event.world.x, y: event.world.y });
    },
    onKeyDown(event) {
      if (event.key === 'Escape') {
        activationSelectedId = null;
        reset();
        setStatus(config.canceledStatus);
      }
    },
  };
}
