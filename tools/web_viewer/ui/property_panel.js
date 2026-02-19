function createField({ label, name, type = 'text', value = '', step = 'any' }) {
  const wrapper = document.createElement('label');
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.value = value;
  if (type === 'number') {
    input.step = step;
  }
  wrapper.appendChild(input);
  return { wrapper, input };
}

function setSelectionSummary(element, text) {
  if (element) {
    element.textContent = text;
  }
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseNumber(value, fallback = 0) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildPatch(entity, key, rawValue) {
  const patch = {};

  if (key === 'layerId') {
    patch.layerId = Number.parseInt(rawValue, 10);
    return patch;
  }
  if (key === 'color') {
    patch.color = String(rawValue || '').trim();
    return patch;
  }
  if (key === 'visible') {
    patch.visible = parseBool(rawValue);
    return patch;
  }

  if (entity.type === 'line') {
    patch.start = { ...entity.start };
    patch.end = { ...entity.end };
    if (key === 'start.x') patch.start.x = parseNumber(rawValue, entity.start.x);
    if (key === 'start.y') patch.start.y = parseNumber(rawValue, entity.start.y);
    if (key === 'end.x') patch.end.x = parseNumber(rawValue, entity.end.x);
    if (key === 'end.y') patch.end.y = parseNumber(rawValue, entity.end.y);
    return patch;
  }

  if (entity.type === 'polyline') {
    if (key === 'closed') {
      patch.closed = parseBool(rawValue);
    }
    return patch;
  }

  if (entity.type === 'circle') {
    patch.center = { ...entity.center };
    if (key === 'center.x') patch.center.x = parseNumber(rawValue, entity.center.x);
    if (key === 'center.y') patch.center.y = parseNumber(rawValue, entity.center.y);
    if (key === 'radius') patch.radius = Math.max(0.001, parseNumber(rawValue, entity.radius));
    return patch;
  }

  if (entity.type === 'arc') {
    patch.center = { ...entity.center };
    if (key === 'center.x') patch.center.x = parseNumber(rawValue, entity.center.x);
    if (key === 'center.y') patch.center.y = parseNumber(rawValue, entity.center.y);
    if (key === 'radius') patch.radius = Math.max(0.001, parseNumber(rawValue, entity.radius));
    if (key === 'startAngle') patch.startAngle = parseNumber(rawValue, entity.startAngle || 0);
    if (key === 'endAngle') patch.endAngle = parseNumber(rawValue, entity.endAngle || 0);
    return patch;
  }

  if (entity.type === 'text') {
    patch.position = { ...entity.position };
    if (key === 'position.x') patch.position.x = parseNumber(rawValue, entity.position.x);
    if (key === 'position.y') patch.position.y = parseNumber(rawValue, entity.position.y);
    if (key === 'value') patch.value = String(rawValue ?? entity.value);
    if (key === 'height') patch.height = Math.max(0.1, parseNumber(rawValue, entity.height || 2.5));
    if (key === 'rotation') patch.rotation = parseNumber(rawValue, entity.rotation || 0);
    return patch;
  }

  return patch;
}

export function createPropertyPanel({ documentState, selectionState, commandBus, setStatus }) {
  const form = document.getElementById('cad-property-form');
  const summary = document.getElementById('cad-selection-summary');

  if (!form) {
    return {
      render() {},
    };
  }

  function addField(config, onChange) {
    const { wrapper, input } = createField(config);
    input.addEventListener('change', () => onChange(input.value));
    form.appendChild(wrapper);
  }

  function addToggle(name, checked, onChange) {
    const wrapper = document.createElement('label');
    wrapper.textContent = name;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  function patchSelection(patch, message = 'Property updated') {
    const result = commandBus.execute('selection.propertyPatch', { patch });
    setStatus(result.ok ? message : (result.message || 'Property update failed'));
  }

  function render() {
    const ids = selectionState.entityIds || [];
    form.innerHTML = '';

    if (ids.length === 0) {
      setSelectionSummary(summary, 'No selection');
      return;
    }

    const entities = ids
      .map((id) => documentState.getEntity(id))
      .filter((entity) => !!entity);

    setSelectionSummary(summary, `${entities.length} selected (${entities.map((entity) => entity.type).join(', ')})`);

    if (entities.length === 0) {
      return;
    }

    const primary = documentState.getEntity(selectionState.primaryId) || entities[0];

    addField({ label: 'Layer ID', name: 'layerId', type: 'number', value: String(primary.layerId) }, (value) => {
      const layerId = Number.parseInt(value, 10);
      if (!Number.isFinite(layerId)) {
        return;
      }
      if (!documentState.getLayer(layerId)) {
        documentState.ensureLayer(layerId);
      }
      patchSelection({ layerId }, 'Layer updated');
    });

    addField({ label: 'Color (#RRGGBB)', name: 'color', value: primary.color || '#1f2937' }, (value) => {
      patchSelection({ color: value || '#1f2937' }, 'Color updated');
    });

    addToggle('Visible', primary.visible !== false, (checked) => {
      patchSelection({ visible: checked }, 'Visibility updated');
    });

    if (entities.length > 1) {
      return;
    }

    if (primary.type === 'line') {
      addField({ label: 'Start X', name: 'start.x', type: 'number', value: String(primary.start.x) }, (value) => {
        patchSelection(buildPatch(primary, 'start.x', value), 'Line start updated');
      });
      addField({ label: 'Start Y', name: 'start.y', type: 'number', value: String(primary.start.y) }, (value) => {
        patchSelection(buildPatch(primary, 'start.y', value), 'Line start updated');
      });
      addField({ label: 'End X', name: 'end.x', type: 'number', value: String(primary.end.x) }, (value) => {
        patchSelection(buildPatch(primary, 'end.x', value), 'Line end updated');
      });
      addField({ label: 'End Y', name: 'end.y', type: 'number', value: String(primary.end.y) }, (value) => {
        patchSelection(buildPatch(primary, 'end.y', value), 'Line end updated');
      });
      return;
    }

    if (primary.type === 'polyline') {
      addToggle('Closed', primary.closed === true, (checked) => {
        patchSelection({ closed: checked }, 'Polyline closed updated');
      });
      return;
    }

    if (primary.type === 'circle' || primary.type === 'arc') {
      addField({ label: 'Center X', name: 'center.x', type: 'number', value: String(primary.center.x) }, (value) => {
        patchSelection(buildPatch(primary, 'center.x', value), 'Center updated');
      });
      addField({ label: 'Center Y', name: 'center.y', type: 'number', value: String(primary.center.y) }, (value) => {
        patchSelection(buildPatch(primary, 'center.y', value), 'Center updated');
      });
      addField({ label: 'Radius', name: 'radius', type: 'number', value: String(primary.radius) }, (value) => {
        patchSelection(buildPatch(primary, 'radius', value), 'Radius updated');
      });
      if (primary.type === 'arc') {
        addField({ label: 'Start Angle (rad)', name: 'startAngle', type: 'number', value: String(primary.startAngle || 0) }, (value) => {
          patchSelection(buildPatch(primary, 'startAngle', value), 'Arc start angle updated');
        });
        addField({ label: 'End Angle (rad)', name: 'endAngle', type: 'number', value: String(primary.endAngle || 0) }, (value) => {
          patchSelection(buildPatch(primary, 'endAngle', value), 'Arc end angle updated');
        });
      }
      return;
    }

    if (primary.type === 'text') {
      addField({ label: 'Text', name: 'value', value: primary.value || 'TEXT' }, (value) => {
        patchSelection(buildPatch(primary, 'value', value), 'Text updated');
      });
      addField({ label: 'Position X', name: 'position.x', type: 'number', value: String(primary.position.x) }, (value) => {
        patchSelection(buildPatch(primary, 'position.x', value), 'Text position updated');
      });
      addField({ label: 'Position Y', name: 'position.y', type: 'number', value: String(primary.position.y) }, (value) => {
        patchSelection(buildPatch(primary, 'position.y', value), 'Text position updated');
      });
      addField({ label: 'Height', name: 'height', type: 'number', value: String(primary.height || 2.5) }, (value) => {
        patchSelection(buildPatch(primary, 'height', value), 'Text height updated');
      });
      addField({ label: 'Rotation (rad)', name: 'rotation', type: 'number', value: String(primary.rotation || 0) }, (value) => {
        patchSelection(buildPatch(primary, 'rotation', value), 'Text rotation updated');
      });
    }
  }

  selectionState.addEventListener('change', render);
  documentState.addEventListener('change', render);
  render();

  return {
    render,
  };
}
