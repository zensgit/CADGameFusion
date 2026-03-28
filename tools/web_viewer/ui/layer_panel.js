function buildLayerItem(layer, callbacks) {
  const item = document.createElement('li');
  item.className = 'cad-layer-item';

  const swatch = document.createElement('span');
  swatch.className = 'cad-layer-color';
  swatch.style.backgroundColor = layer.color || '#9ca3af';

  const name = document.createElement('span');
  name.className = 'cad-layer-name';
  name.textContent = `${layer.id}:${layer.name}`;

  const visBtn = document.createElement('button');
  visBtn.type = 'button';
  visBtn.textContent = layer.visible ? 'Visible' : 'Hidden';
  visBtn.classList.toggle('is-off', !layer.visible);
  visBtn.addEventListener('click', () => callbacks.onToggleVisibility?.(layer));

  const lockBtn = document.createElement('button');
  lockBtn.type = 'button';
  lockBtn.textContent = layer.locked ? 'Locked' : 'Unlocked';
  lockBtn.classList.toggle('is-off', !layer.locked);
  lockBtn.addEventListener('click', () => callbacks.onToggleLocked?.(layer));

  item.appendChild(swatch);
  item.appendChild(name);
  item.appendChild(visBtn);
  item.appendChild(lockBtn);
  return item;
}

export function createLayerPanel({ documentState, onAddLayer, onToggleVisibility, onToggleLocked }) {
  const listEl = document.getElementById('cad-layer-list');
  const addBtn = document.getElementById('cad-add-layer');
  const nameInput = document.getElementById('cad-new-layer-name');

  function render() {
    if (!listEl) return;
    listEl.innerHTML = '';
    for (const layer of documentState.listLayers()) {
      listEl.appendChild(buildLayerItem(layer, {
        onToggleVisibility,
        onToggleLocked,
      }));
    }
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
    render,
  };
}
