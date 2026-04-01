function buildLayerItem(layer, callbacks, options = {}) {
  const item = document.createElement('li');
  item.className = 'cad-layer-item';
  item.dataset.layerId = String(layer.id);
  if (options.current === true) {
    item.classList.add('is-current');
    item.dataset.current = 'true';
  } else {
    item.dataset.current = 'false';
  }
  if (options.focused === true) {
    item.classList.add('is-focused');
    item.dataset.focused = 'true';
  } else {
    item.dataset.focused = 'false';
  }

  const swatch = document.createElement('span');
  swatch.className = 'cad-layer-color';
  swatch.style.backgroundColor = layer.color || '#9ca3af';

  const name = document.createElement('span');
  name.className = 'cad-layer-name';
  name.textContent = `${layer.id}:${layer.name}`;

  const controls = document.createElement('div');
  controls.className = 'cad-layer-controls';

  const appendToggle = ({ label, action, isActive, onClick }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.classList.toggle('is-off', !isActive);
    btn.dataset.layerAction = action;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      onClick?.(event);
    });
    controls.appendChild(btn);
  };

  appendToggle({
    label: options.current === true ? 'Current' : 'Use',
    action: 'current',
    isActive: options.current === true,
    onClick: () => callbacks.onSetCurrentLayer?.(layer),
  });
  appendToggle({
    label: layer.visible ? 'Shown' : 'Hidden',
    action: 'visibility',
    isActive: layer.visible,
    onClick: () => callbacks.onToggleVisibility?.(layer),
  });
  if (typeof callbacks.onTurnOffLayer === 'function' && layer.visible !== false) {
    appendToggle({
      label: 'Off',
      action: 'turn-off',
      isActive: true,
      onClick: () => callbacks.onTurnOffLayer?.(layer),
    });
  }
  if (typeof callbacks.onTurnOnLayer === 'function' && layer.visible === false) {
    appendToggle({
      label: 'On',
      action: 'turn-on',
      isActive: true,
      onClick: () => callbacks.onTurnOnLayer?.(layer),
    });
  }
  appendToggle({
    label: layer.locked ? 'Locked' : 'Open',
    action: 'locked',
    isActive: layer.locked,
    onClick: () => callbacks.onToggleLocked?.(layer),
  });
  appendToggle({
    label: layer.frozen ? 'Frozen' : 'Live',
    action: 'frozen',
    isActive: !layer.frozen,
    onClick: () => callbacks.onToggleFrozen?.(layer),
  });
  appendToggle({
    label: layer.printable === false ? 'NoPrint' : 'Print',
    action: 'printable',
    isActive: layer.printable !== false,
    onClick: () => callbacks.onTogglePrintable?.(layer),
  });
  appendToggle({
    label: layer.construction ? 'Constr' : 'Normal',
    action: 'construction',
    isActive: layer.construction !== true,
    onClick: () => callbacks.onToggleConstruction?.(layer),
  });

  item.addEventListener('click', () => callbacks.onSetCurrentLayer?.(layer));

  item.appendChild(swatch);
  item.appendChild(name);
  item.appendChild(controls);
  return item;
}

export function createLayerPanel({
  documentState,
  getFocusedLayerId,
  getCurrentLayerId,
  onAddLayer,
  onSetCurrentLayer,
  onToggleVisibility,
  onTurnOffLayer,
  onTurnOnLayer,
  onToggleLocked,
  onToggleFrozen,
  onTogglePrintable,
  onToggleConstruction,
}) {
  const listEl = document.getElementById('cad-layer-list');
  const addBtn = document.getElementById('cad-add-layer');
  const nameInput = document.getElementById('cad-new-layer-name');
  let lastFocusedLayerId = null;

  function resolveFocusedLayerId() {
    const id = typeof getFocusedLayerId === 'function' ? getFocusedLayerId() : null;
    return Number.isFinite(id) ? Math.trunc(Number(id)) : null;
  }

  function resolveCurrentLayerId() {
    const id = typeof getCurrentLayerId === 'function' ? getCurrentLayerId() : null;
    return Number.isFinite(id) ? Math.trunc(Number(id)) : null;
  }

  function focusLayer(layerId, { scroll = true } = {}) {
    if (!listEl || !Number.isFinite(layerId)) return false;
    const normalized = Math.trunc(Number(layerId));
    const item = listEl.querySelector(`.cad-layer-item[data-layer-id="${normalized}"]`);
    if (!item) return false;
    if (scroll) {
      item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    return true;
  }

  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    const focusedLayerId = resolveFocusedLayerId();
    const currentLayerId = resolveCurrentLayerId();
    for (const layer of documentState.listLayers()) {
      listEl.appendChild(buildLayerItem(layer, {
        onSetCurrentLayer,
        onToggleVisibility,
        onTurnOffLayer,
        onTurnOnLayer,
        onToggleLocked,
        onToggleFrozen,
        onTogglePrintable,
        onToggleConstruction,
      }, {
        current: currentLayerId !== null && layer.id === currentLayerId,
        focused: focusedLayerId !== null && layer.id === focusedLayerId,
      }));
    }
    if (focusedLayerId !== null && focusedLayerId !== lastFocusedLayerId) {
      focusLayer(focusedLayerId);
    }
    lastFocusedLayerId = focusedLayerId;
  }

  addBtn?.addEventListener('click', () => {
    const name = nameInput?.value?.trim() || '';
    if (onAddLayer) {
      onAddLayer(name);
    }
    if (nameInput) {
      nameInput.value = '';
    }
  });

  nameInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addBtn?.click();
    }
  });

  documentState.addEventListener('change', render);
  render();

  return {
    focusLayer,
    render,
  };
}
