function makeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function createSnapPanel({ snapState }) {
  const form = document.getElementById('cad-snap-form');
  if (!form || !snapState) {
    return { refresh() {}, destroy() {} };
  }

  form.innerHTML = '';

  const bindings = new Map();

  function addCheckbox(name, label) {
    const row = makeEl('label', 'cad-checkbox');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      snapState.setOption(name, input.checked);
    });
    row.appendChild(input);
    row.appendChild(makeEl('span', '', label));
    form.appendChild(row);
    bindings.set(name, { type: 'checkbox', input });
  }

  function addNumber(name, label, { min = null, step = null } = {}) {
    const row = makeEl('label', '');
    row.appendChild(makeEl('span', '', label));
    const input = document.createElement('input');
    input.type = 'number';
    if (min !== null) input.min = String(min);
    if (step !== null) input.step = String(step);
    input.addEventListener('change', () => {
      snapState.setOption(name, Number.parseFloat(input.value));
    });
    row.appendChild(input);
    form.appendChild(row);
    bindings.set(name, { type: 'number', input });
  }

  addCheckbox('endpoint', 'Endpoint');
  addCheckbox('midpoint', 'Midpoint (includes arcs)');
  addCheckbox('quadrant', 'Quadrant');
  addCheckbox('center', 'Center');
  addCheckbox('intersection', 'Intersection');
  addCheckbox('tangent', 'Tangent (needs a reference point)');
  addCheckbox('nearest', 'Nearest');
  addCheckbox('ortho', 'Ortho');
  addCheckbox('grid', 'Grid');
  addNumber('gridSize', 'Grid size', { min: 0.5, step: 0.5 });
  addNumber('snapRadiusPx', 'Snap radius (px)', { min: 2, step: 1 });

  function refresh() {
    const opts = snapState.toJSON();
    for (const [name, binding] of bindings.entries()) {
      if (!Object.prototype.hasOwnProperty.call(opts, name)) continue;
      if (binding.type === 'checkbox') {
        binding.input.checked = opts[name] === true;
      } else if (binding.type === 'number') {
        binding.input.value = String(opts[name]);
      }
    }
  }

  const onChange = () => refresh();
  snapState.addEventListener('change', onChange);
  refresh();

  return {
    refresh,
    destroy() {
      snapState.removeEventListener('change', onChange);
      form.innerHTML = '';
      bindings.clear();
    },
  };
}

