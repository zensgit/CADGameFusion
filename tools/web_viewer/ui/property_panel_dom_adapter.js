function resolveDocument(form) {
  if (form?.ownerDocument && typeof form.ownerDocument.createElement === 'function') {
    return form.ownerDocument;
  }
  return document;
}

function createField(doc, { label, name, type = 'text', value = '', step = 'any' }) {
  const wrapper = doc.createElement('label');
  wrapper.textContent = label;
  const input = doc.createElement('input');
  input.type = type;
  input.name = name;
  input.value = value;
  if (type === 'number') {
    input.step = step;
  }
  wrapper.appendChild(input);
  return { wrapper, input };
}

function appendTextRow(form, doc, className, text, key = '') {
  if (!text) return;
  const row = doc.createElement('div');
  row.className = className;
  if (key) {
    row.dataset.propertyInfo = key;
  }
  row.textContent = text;
  form.appendChild(row);
}

export function createPropertyPanelDomAdapter({ form }) {
  const doc = resolveDocument(form);

  function addField(config, onChange) {
    const { wrapper, input } = createField(doc, config);
    input.addEventListener('change', () => onChange(input.value));
    form.appendChild(wrapper);
  }

  function addToggle(name, checked, onChange) {
    const wrapper = doc.createElement('label');
    wrapper.textContent = name;
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  function addInfo(label, value, key = '') {
    if (value === null || value === undefined || value === '') return;
    appendTextRow(form, doc, 'cad-readonly-meta', `${label}: ${value}`, key);
  }

  function addNote(text, key = '') {
    appendTextRow(form, doc, 'cad-readonly-meta', text, key);
  }

  function addReadonlyNote(text, key = '') {
    appendTextRow(form, doc, 'cad-readonly-note', text, key);
  }

  function addActionRow(actions) {
    if (!Array.isArray(actions) || actions.length === 0) return;
    const row = doc.createElement('div');
    row.className = 'cad-property-actions';
    row.dataset.propertyActions = 'true';
    for (const action of actions) {
      if (!action || typeof action !== 'object' || typeof action.onClick !== 'function') continue;
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'cad-property-actions__button';
      if (action.id) {
        btn.dataset.propertyAction = action.id;
      }
      btn.textContent = action.label || action.id || 'Action';
      btn.addEventListener('click', () => action.onClick());
      row.appendChild(btn);
    }
    if (row.childElementCount > 0) {
      form.appendChild(row);
    }
  }

  function appendFieldDescriptors(descriptors) {
    if (!Array.isArray(descriptors) || descriptors.length === 0) return;
    for (const descriptor of descriptors) {
      if (!descriptor || typeof descriptor !== 'object') continue;
      if (descriptor.kind === 'toggle') {
        addToggle(descriptor.label, descriptor.checked, descriptor.onChange);
      } else {
        addField(descriptor.config, descriptor.onChange);
      }
    }
  }

  function appendInfoRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      addInfo(row.label, row.value, row.key);
    }
  }

  return {
    addActionRow,
    addField,
    addInfo,
    addNote,
    addReadonlyNote,
    addToggle,
    appendFieldDescriptors,
    appendInfoRows,
  };
}
