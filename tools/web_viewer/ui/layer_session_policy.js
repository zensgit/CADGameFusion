function normalizeLayerId(value) {
  return Number.isFinite(value) ? Math.trunc(Number(value)) : null;
}

function collectSelectionIds(selectionState) {
  return Array.isArray(selectionState?.entityIds)
    ? [...new Set(selectionState.entityIds.filter((id) => Number.isFinite(id)).map((id) => Math.trunc(Number(id))))]
    : [];
}

function collectLayerVisibilityRestoreSnapshot(layers) {
  return layers.map((layer) => ({
    id: layer.id,
    visible: layer.visible !== false,
  }));
}

function collectLayerFrozenRestoreSnapshot(layers) {
  return layers.map((layer) => ({
    id: layer.id,
    frozen: layer.frozen === true,
  }));
}

function resolveSelectionLayerTargets(documentState, selectionState, {
  command,
  emptyMessage,
  invalidSelectionMessage,
  invalidLayerMessage,
} = {}) {
  const ids = collectSelectionIds(selectionState);
  if (ids.length === 0) {
    return {
      ok: false,
      error_code: 'NO_SELECTION',
      message: emptyMessage || `${command}: select at least one entity`,
    };
  }

  const entities = ids
    .map((id) => (typeof documentState?.getEntity === 'function' ? documentState.getEntity(id) : null))
    .filter((entity) => !!entity && Number.isFinite(entity.layerId));
  if (entities.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_SELECTION',
      message: invalidSelectionMessage || `${command}: selected entities are unavailable`,
    };
  }

  const layerIds = [...new Set(entities.map((entity) => Math.trunc(Number(entity.layerId))))];
  const layers = layerIds
    .map((layerId) => (typeof documentState?.getLayer === 'function' ? documentState.getLayer(layerId) : null))
    .filter((layer) => !!layer && Number.isFinite(layer.id));
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: invalidLayerMessage || `${command}: selected entity layers are unavailable`,
    };
  }

  const primaryId = Number.isFinite(selectionState?.primaryId) && ids.includes(Math.trunc(Number(selectionState.primaryId)))
    ? Math.trunc(Number(selectionState.primaryId))
    : entities[0].id;
  const primary = entities.find((entity) => entity.id === primaryId) || entities[0];

  return {
    ok: true,
    entityIds: entities.map((entity) => entity.id),
    layerIds: layers.map((layer) => layer.id),
    layers,
    primaryEntityId: primary?.id ?? null,
    primaryLayerId: Number.isFinite(primary?.layerId) ? Math.trunc(Number(primary.layerId)) : null,
  };
}

export function isEditableLayer(layer) {
  if (!layer || typeof layer !== 'object') return false;
  return layer.visible !== false && layer.frozen !== true && layer.locked !== true;
}

export function formatLayerRef(layer) {
  if (!layer || !Number.isFinite(layer.id)) return 'n/a';
  return `${layer.id}:${String(layer.name || '').trim() || layer.id}`;
}

export function resolveSelectionCurrentLayer(documentState, selectionState) {
  const resolved = resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYMCUR',
    emptyMessage: 'LAYMCUR: select an entity to use its layer as current',
    invalidSelectionMessage: 'LAYMCUR: selected entity is unavailable',
    invalidLayerMessage: 'LAYMCUR: selected entity layer is unavailable',
  });
  if (!resolved?.ok) {
    return resolved;
  }

  const entity = typeof documentState?.getEntity === 'function'
    ? documentState.getEntity(resolved.primaryEntityId)
    : null;
  const layerId = normalizeLayerId(entity.layerId);
  const layer = layerId !== null && typeof documentState?.getLayer === 'function'
    ? documentState.getLayer(layerId)
    : null;
  if (!layer || !Number.isFinite(layer.id)) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYMCUR: selected entity layer is unavailable',
    };
  }
  if (!isEditableLayer(layer)) {
    return {
      ok: false,
      error_code: 'LAYER_UNAVAILABLE',
      message: `Layer unavailable for drawing: ${layer.name || layer.id}`,
      layerId,
      layer,
      entityId: resolved.primaryEntityId,
    };
  }

  return {
    ok: true,
    layerId,
    layer,
    entityId: resolved.primaryEntityId,
  };
}

export function resolveSelectionIsolationLayers(documentState, selectionState) {
  const resolved = resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYISO',
    emptyMessage: 'LAYISO: select at least one entity to isolate its layer',
    invalidSelectionMessage: 'LAYISO: selected entities are unavailable',
    invalidLayerMessage: 'LAYISO: selected entity layers are unavailable',
  });
  if (!resolved?.ok) {
    return resolved;
  }
  return resolved;
}

export function resolveSelectionLayerOffLayers(documentState, selectionState) {
  return resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYOFF',
    emptyMessage: 'LAYOFF: select at least one entity to turn off its layer',
    invalidSelectionMessage: 'LAYOFF: selected entities are unavailable',
    invalidLayerMessage: 'LAYOFF: selected entity layers are unavailable',
  });
}

export function resolveSelectionLayerFreezeLayers(documentState, selectionState) {
  return resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYFRZ',
    emptyMessage: 'LAYFRZ: select at least one entity to freeze its layer',
    invalidSelectionMessage: 'LAYFRZ: selected entities are unavailable',
    invalidLayerMessage: 'LAYFRZ: selected entity layers are unavailable',
  });
}

export function resolveSelectionLayerLockLayers(documentState, selectionState) {
  return resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYLCK',
    emptyMessage: 'LAYLCK: select at least one entity to lock its layer',
    invalidSelectionMessage: 'LAYLCK: selected entities are unavailable',
    invalidLayerMessage: 'LAYLCK: selected entity layers are unavailable',
  });
}

export function resolveSelectionLayerUnlockLayers(documentState, selectionState) {
  return resolveSelectionLayerTargets(documentState, selectionState, {
    command: 'LAYULK',
    emptyMessage: 'LAYULK: select at least one entity to unlock its layer',
    invalidSelectionMessage: 'LAYULK: selected entities are unavailable',
    invalidLayerMessage: 'LAYULK: selected entity layers are unavailable',
  });
}

export function activateLayerIsolation(documentState, rawLayerIds) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'NO_LAYERS',
      message: 'LAYISO: document has no layers',
    };
  }

  const keepLayerIds = [...new Set((Array.isArray(rawLayerIds) ? rawLayerIds : [])
    .filter((id) => Number.isFinite(id))
    .map((id) => Math.trunc(Number(id))))]
    .filter((layerId) => !!documentState.getLayer(layerId));
  if (keepLayerIds.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYISO: no valid layers to isolate',
    };
  }

  const keepSet = new Set(keepLayerIds);
  const restore = collectLayerVisibilityRestoreSnapshot(layers);
  let hiddenCount = 0;
  for (const layer of layers) {
    const nextVisible = keepSet.has(layer.id);
    if (layer.visible !== nextVisible) {
      documentState.updateLayer(layer.id, { visible: nextVisible });
    }
    if (!nextVisible) hiddenCount += 1;
  }

  return {
    ok: true,
    keepLayerIds,
    hiddenCount,
    session: {
      restore,
      keepLayerIds,
    },
  };
}

export function activateLayerOff(documentState, rawLayerIds, { currentLayerId = null } = {}) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'NO_LAYERS',
      message: 'LAYOFF: document has no layers',
    };
  }

  const offLayerIds = [...new Set((Array.isArray(rawLayerIds) ? rawLayerIds : [])
    .filter((id) => Number.isFinite(id))
    .map((id) => Math.trunc(Number(id))))].filter((layerId) => !!documentState.getLayer(layerId));
  if (offLayerIds.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYOFF: no valid layers to turn off',
    };
  }

  const offSet = new Set(offLayerIds);
  const currentId = normalizeLayerId(currentLayerId);
  const currentLayer = currentId !== null ? documentState.getLayer(currentId) : null;
  const needsFallback = currentId !== null && offSet.has(currentId) && !!currentLayer;
  const fallbackLayers = needsFallback
    ? layers.filter((layer) => layer.id !== currentId && !offSet.has(layer.id) && isEditableLayer(layer) && layer.visible !== false)
    : [];
  const fallbackLayer = fallbackLayers.find((layer) => layer.id !== 0) || fallbackLayers[0] || null;
  if (needsFallback && !fallbackLayer) {
    return {
      ok: false,
      error_code: 'NO_FALLBACK_LAYER',
      message: 'LAYOFF: turning off the current layer requires another editable visible layer',
    };
  }

  const restore = collectLayerVisibilityRestoreSnapshot(layers);
  let hiddenCount = 0;
  for (const layer of layers) {
    const nextVisible = !offSet.has(layer.id);
    if (layer.visible !== nextVisible) {
      documentState.updateLayer(layer.id, { visible: nextVisible });
    }
    if (!nextVisible) hiddenCount += 1;
  }

  return {
    ok: true,
    offLayerIds,
    hiddenCount,
    nextCurrentLayerId: fallbackLayer ? fallbackLayer.id : currentId,
    session: {
      restore,
      offLayerIds,
      currentLayerId: currentId,
      nextCurrentLayerId: fallbackLayer ? fallbackLayer.id : currentId,
    },
  };
}

export function activateLayerFreeze(documentState, rawLayerIds, { currentLayerId = null } = {}) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'NO_LAYERS',
      message: 'LAYFRZ: document has no layers',
    };
  }

  const freezeLayerIds = [...new Set((Array.isArray(rawLayerIds) ? rawLayerIds : [])
    .filter((id) => Number.isFinite(id))
    .map((id) => Math.trunc(Number(id))))].filter((layerId) => !!documentState.getLayer(layerId));
  if (freezeLayerIds.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYFRZ: no valid layers to freeze',
    };
  }

  const freezeSet = new Set(freezeLayerIds);
  const currentId = normalizeLayerId(currentLayerId);
  const currentLayer = currentId !== null ? documentState.getLayer(currentId) : null;
  const needsFallback = currentId !== null && freezeSet.has(currentId) && !!currentLayer;
  const fallbackLayers = needsFallback
    ? layers.filter((layer) => layer.id !== currentId && !freezeSet.has(layer.id) && isEditableLayer(layer) && layer.visible !== false)
    : [];
  const fallbackLayer = fallbackLayers.find((layer) => layer.id !== 0) || fallbackLayers[0] || null;
  if (needsFallback && !fallbackLayer) {
    return {
      ok: false,
      error_code: 'NO_FALLBACK_LAYER',
      message: 'LAYFRZ: freezing the current layer requires another editable visible layer',
    };
  }

  const restore = collectLayerFrozenRestoreSnapshot(layers);
  let frozenCount = 0;
  for (const layer of layers) {
    if (!freezeSet.has(layer.id)) {
      if (layer.frozen === true) frozenCount += 1;
      continue;
    }
    if (layer.frozen !== true) {
      documentState.updateLayer(layer.id, { frozen: true });
    }
    frozenCount += 1;
  }

  return {
    ok: true,
    freezeLayerIds,
    frozenCount,
    nextCurrentLayerId: fallbackLayer ? fallbackLayer.id : currentId,
    session: {
      restore,
      freezeLayerIds,
      currentLayerId: currentId,
      nextCurrentLayerId: fallbackLayer ? fallbackLayer.id : currentId,
    },
  };
}

export function activateLayerLock(documentState, rawLayerIds, { currentLayerId = null } = {}) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'NO_LAYERS',
      message: 'LAYLCK: document has no layers',
    };
  }

  const lockedLayerIds = [...new Set((Array.isArray(rawLayerIds) ? rawLayerIds : [])
    .filter((id) => Number.isFinite(id))
    .map((id) => Math.trunc(Number(id))))].filter((layerId) => !!documentState.getLayer(layerId));
  if (lockedLayerIds.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYLCK: no valid layers to lock',
    };
  }

  const lockSet = new Set(lockedLayerIds);
  const currentId = normalizeLayerId(currentLayerId);
  const currentLayer = currentId !== null ? documentState.getLayer(currentId) : null;
  const needsFallback = currentId !== null && lockSet.has(currentId) && !!currentLayer;
  const fallbackLayers = needsFallback
    ? layers.filter((layer) => layer.id !== currentId && !lockSet.has(layer.id) && isEditableLayer(layer))
    : [];
  const fallbackLayer = fallbackLayers.find((layer) => layer.id !== 0) || fallbackLayers[0] || null;
  if (needsFallback && !fallbackLayer) {
    return {
      ok: false,
      error_code: 'NO_FALLBACK_LAYER',
      message: 'LAYLCK: locking the current layer requires another editable visible layer',
    };
  }

  let lockedCount = 0;
  for (const layer of layers) {
    if (!lockSet.has(layer.id)) continue;
    if (layer.locked !== true) {
      documentState.updateLayer(layer.id, { locked: true });
    }
    lockedCount += 1;
  }

  return {
    ok: true,
    lockedLayerIds,
    lockedCount,
    nextCurrentLayerId: fallbackLayer ? fallbackLayer.id : currentId,
  };
}

export function activateLayerUnlock(documentState, rawLayerIds) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return {
      ok: false,
      error_code: 'NO_LAYERS',
      message: 'LAYULK: document has no layers',
    };
  }

  const unlockedLayerIds = [...new Set((Array.isArray(rawLayerIds) ? rawLayerIds : [])
    .filter((id) => Number.isFinite(id))
    .map((id) => Math.trunc(Number(id))))].filter((layerId) => !!documentState.getLayer(layerId));
  if (unlockedLayerIds.length === 0) {
    return {
      ok: false,
      error_code: 'INVALID_LAYER',
      message: 'LAYULK: no valid layers to unlock',
    };
  }

  const unlockSet = new Set(unlockedLayerIds);
  let unlockedCount = 0;
  for (const layer of layers) {
    if (!unlockSet.has(layer.id)) continue;
    if (layer.locked === true) {
      documentState.updateLayer(layer.id, { locked: false });
    }
    unlockedCount += 1;
  }

  return {
    ok: true,
    unlockedLayerIds,
    unlockedCount,
  };
}

export function restoreLayerIsolation(documentState, session) {
  const restore = Array.isArray(session?.restore) ? session.restore : [];
  if (restore.length === 0) {
    return {
      ok: false,
      error_code: 'NO_SESSION',
      message: 'LAYUNISO: no active isolation session',
    };
  }

  let restoredCount = 0;
  for (const item of restore) {
    const layerId = normalizeLayerId(item?.id);
    if (layerId === null || !documentState.getLayer(layerId)) continue;
    documentState.updateLayer(layerId, { visible: item.visible !== false });
    restoredCount += 1;
  }

  return {
    ok: true,
    restoredCount,
    keepLayerIds: Array.isArray(session?.keepLayerIds) ? [...session.keepLayerIds] : [],
  };
}

export function restoreLayerOff(documentState, session) {
  const restore = Array.isArray(session?.restore) ? session.restore : [];
  if (restore.length === 0) {
    return {
      ok: false,
      error_code: 'NO_SESSION',
      message: 'LAYON: no active layer-off session',
    };
  }

  let restoredCount = 0;
  for (const item of restore) {
    const layerId = normalizeLayerId(item?.id);
    if (layerId === null || !documentState.getLayer(layerId)) continue;
    documentState.updateLayer(layerId, { visible: item.visible !== false });
    restoredCount += 1;
  }

  return {
    ok: true,
    restoredCount,
    offLayerIds: Array.isArray(session?.offLayerIds) ? [...session.offLayerIds] : [],
    restoreCurrentLayerId: normalizeLayerId(session?.currentLayerId),
    nextCurrentLayerId: normalizeLayerId(session?.currentLayerId),
  };
}

export function restoreLayerFreeze(documentState, session) {
  const restore = Array.isArray(session?.restore) ? session.restore : [];
  if (restore.length === 0) {
    return {
      ok: false,
      error_code: 'NO_SESSION',
      message: 'LAYTHW: no active frozen-layer session',
    };
  }

  let restoredCount = 0;
  for (const item of restore) {
    const layerId = normalizeLayerId(item?.id);
    if (layerId === null || !documentState.getLayer(layerId)) continue;
    documentState.updateLayer(layerId, { frozen: item.frozen === true });
    restoredCount += 1;
  }

  return {
    ok: true,
    restoredCount,
    freezeLayerIds: Array.isArray(session?.freezeLayerIds) ? [...session.freezeLayerIds] : [],
    restoreCurrentLayerId: normalizeLayerId(session?.currentLayerId),
    nextCurrentLayerId: normalizeLayerId(session?.currentLayerId),
  };
}

function collectLayerUsage(documentState) {
  const counts = new Map();
  if (!documentState || typeof documentState.listEntities !== 'function') {
    return counts;
  }
  for (const entity of documentState.listEntities()) {
    if (!entity || !Number.isFinite(entity.layerId)) continue;
    const layerId = Math.trunc(Number(entity.layerId));
    counts.set(layerId, (counts.get(layerId) || 0) + 1);
  }
  return counts;
}

export function resolveCurrentLayerId(documentState, preferredId = null, { preferPopulated = false } = {}) {
  const layers = typeof documentState?.listLayers === 'function'
    ? documentState.listLayers()
    : [];
  if (layers.length === 0) {
    return 0;
  }

  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const normalizedPreferred = normalizeLayerId(preferredId);
  if (normalizedPreferred !== null && isEditableLayer(byId.get(normalizedPreferred))) {
    return normalizedPreferred;
  }

  const editableLayers = layers.filter((layer) => isEditableLayer(layer));
  if (editableLayers.length === 0) {
    return Number.isFinite(layers[0]?.id) ? layers[0].id : 0;
  }

  const usage = preferPopulated ? collectLayerUsage(documentState) : new Map();
  if (preferPopulated) {
    const populatedEditable = editableLayers.filter((layer) => (usage.get(layer.id) || 0) > 0);
    const populatedNonDefault = populatedEditable.filter((layer) => layer.id !== 0);
    if (populatedNonDefault.length > 0) {
      return populatedNonDefault[0].id;
    }
    if (populatedEditable.length > 0) {
      return populatedEditable[0].id;
    }
  }

  const nonDefault = editableLayers.find((layer) => layer.id !== 0);
  return (nonDefault || editableLayers[0]).id;
}
