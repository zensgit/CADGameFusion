function pushAction(actions, {
  id,
  label,
  invoke,
  onFalse = null,
  onTrue = null,
  setStatus = null,
}) {
  if (typeof invoke !== 'function') return;
  actions.push({
    id,
    label,
    onClick: () => {
      const result = invoke();
      if (result === false) {
        if (typeof onFalse === 'string' && typeof setStatus === 'function') {
          setStatus(onFalse);
        }
        return;
      }
      if (typeof onTrue === 'string' && typeof setStatus === 'function') {
        setStatus(onTrue);
      }
    },
  });
}

export function buildLayerActions(layer, deps = {}) {
  if (!layer || !Number.isFinite(layer.id)) return [];
  const {
    setStatus = null,
    focusLayer = null,
    getCurrentLayerId = null,
    useLayer = null,
    lockLayer = null,
    unlockLayer = null,
    isolateLayer = null,
    hasLayerIsolation = null,
    restoreLayerIsolation = null,
    turnOffLayer = null,
    turnOnLayer = null,
    freezeLayer = null,
    thawLayer = null,
    hasLayerFreeze = null,
    restoreLayerFreeze = null,
  } = deps;

  const actions = [];

  if (typeof focusLayer === 'function') {
    pushAction(actions, {
      id: 'locate-layer',
      label: 'Locate Layer',
      invoke: () => focusLayer(layer.id),
      onTrue: `Layer focused: ${layer.name}`,
      setStatus,
    });
  }

  const currentLayerId = typeof getCurrentLayerId === 'function' ? getCurrentLayerId() : null;
  if (
    typeof useLayer === 'function'
    && layer.locked !== true
    && layer.visible !== false
    && layer.frozen !== true
    && (!Number.isFinite(currentLayerId) || Math.trunc(Number(currentLayerId)) !== layer.id)
  ) {
    pushAction(actions, {
      id: 'use-layer',
      label: 'Make Current',
      invoke: () => useLayer(layer.id),
      onFalse: `Current layer unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (layer.locked !== true && typeof lockLayer === 'function') {
    pushAction(actions, {
      id: 'lock-layer',
      label: 'Lock Layer',
      invoke: () => lockLayer(layer.id),
      onFalse: `Lock failed: ${layer.name}`,
      setStatus,
    });
  }

  if (layer.locked === true && typeof unlockLayer === 'function') {
    pushAction(actions, {
      id: 'unlock-layer',
      label: 'Unlock Layer',
      invoke: () => unlockLayer(layer.id),
      onFalse: `Unlock failed: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof isolateLayer === 'function' && layer.visible !== false) {
    pushAction(actions, {
      id: 'isolate-layer',
      label: 'Isolate Layer',
      invoke: () => isolateLayer(layer.id),
      onFalse: `Layer isolation unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof turnOffLayer === 'function' && layer.visible !== false) {
    pushAction(actions, {
      id: 'turn-off-layer',
      label: 'Turn Off Layer',
      invoke: () => turnOffLayer(layer.id),
      onFalse: `Layer off unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof freezeLayer === 'function' && layer.visible !== false && layer.frozen !== true) {
    pushAction(actions, {
      id: 'freeze-layer',
      label: 'Freeze Layer',
      invoke: () => freezeLayer(layer.id),
      onFalse: `Layer freeze unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof turnOnLayer === 'function' && layer.visible === false) {
    pushAction(actions, {
      id: 'turn-on-layer',
      label: 'Turn On Layer',
      invoke: () => turnOnLayer(layer.id),
      onFalse: `Layer on unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof thawLayer === 'function' && layer.frozen === true) {
    pushAction(actions, {
      id: 'thaw-layer',
      label: 'Thaw Layer',
      invoke: () => thawLayer(layer.id),
      onFalse: `Layer thaw unchanged: ${layer.name}`,
      setStatus,
    });
  }

  if (typeof restoreLayerIsolation === 'function' && typeof hasLayerIsolation === 'function' && hasLayerIsolation()) {
    pushAction(actions, {
      id: 'restore-layers',
      label: 'Restore Layers',
      invoke: () => restoreLayerIsolation(),
      onFalse: 'No isolated layers to restore',
      setStatus,
    });
  }

  if (typeof restoreLayerFreeze === 'function' && typeof hasLayerFreeze === 'function' && hasLayerFreeze()) {
    pushAction(actions, {
      id: 'thaw-layers',
      label: 'Thaw Layers',
      invoke: () => restoreLayerFreeze(),
      onFalse: 'No frozen layers to restore',
      setStatus,
    });
  }

  return actions;
}
