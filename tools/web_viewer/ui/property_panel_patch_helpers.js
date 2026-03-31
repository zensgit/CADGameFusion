function parsePropertyBool(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePropertyNumber(value, fallback = 0) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : fallback;
}

export function shouldPromoteImportedColorSource(entities) {
  return (entities || []).some((entity) => {
    const source = typeof entity?.colorSource === 'string' ? entity.colorSource.trim().toUpperCase() : '';
    return source === 'BYBLOCK' || source === 'INDEX';
  });
}

export function buildPropertyPanelPatch(entity, key, rawValue) {
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
    patch.visible = parsePropertyBool(rawValue);
    return patch;
  }
  if (key === 'lineType') {
    patch.lineType = String(rawValue || '').trim().toUpperCase() || 'CONTINUOUS';
    return patch;
  }
  if (key === 'lineWeight') {
    patch.lineWeight = Math.max(0, parsePropertyNumber(rawValue, entity.lineWeight || 0));
    patch.lineWeightSource = 'EXPLICIT';
    return patch;
  }
  if (key === 'lineTypeScale') {
    patch.lineTypeScale = Math.max(0, parsePropertyNumber(rawValue, entity.lineTypeScale || 1));
    patch.lineTypeScaleSource = 'EXPLICIT';
    return patch;
  }

  if (entity.type === 'line') {
    patch.start = { ...entity.start };
    patch.end = { ...entity.end };
    if (key === 'start.x') patch.start.x = parsePropertyNumber(rawValue, entity.start.x);
    if (key === 'start.y') patch.start.y = parsePropertyNumber(rawValue, entity.start.y);
    if (key === 'end.x') patch.end.x = parsePropertyNumber(rawValue, entity.end.x);
    if (key === 'end.y') patch.end.y = parsePropertyNumber(rawValue, entity.end.y);
    return patch;
  }

  if (entity.type === 'polyline') {
    if (key === 'closed') {
      patch.closed = parsePropertyBool(rawValue);
    }
    return patch;
  }

  if (entity.type === 'circle') {
    patch.center = { ...entity.center };
    if (key === 'center.x') patch.center.x = parsePropertyNumber(rawValue, entity.center.x);
    if (key === 'center.y') patch.center.y = parsePropertyNumber(rawValue, entity.center.y);
    if (key === 'radius') patch.radius = Math.max(0.001, parsePropertyNumber(rawValue, entity.radius));
    return patch;
  }

  if (entity.type === 'arc') {
    patch.center = { ...entity.center };
    if (key === 'center.x') patch.center.x = parsePropertyNumber(rawValue, entity.center.x);
    if (key === 'center.y') patch.center.y = parsePropertyNumber(rawValue, entity.center.y);
    if (key === 'radius') patch.radius = Math.max(0.001, parsePropertyNumber(rawValue, entity.radius));
    if (key === 'startAngle') patch.startAngle = parsePropertyNumber(rawValue, entity.startAngle || 0);
    if (key === 'endAngle') patch.endAngle = parsePropertyNumber(rawValue, entity.endAngle || 0);
    return patch;
  }

  if (entity.type === 'text') {
    patch.position = { ...entity.position };
    if (key === 'position.x') patch.position.x = parsePropertyNumber(rawValue, entity.position.x);
    if (key === 'position.y') patch.position.y = parsePropertyNumber(rawValue, entity.position.y);
    if (key === 'value') patch.value = String(rawValue ?? entity.value);
    if (key === 'height') patch.height = Math.max(0.1, parsePropertyNumber(rawValue, entity.height || 2.5));
    if (key === 'rotation') patch.rotation = parsePropertyNumber(rawValue, entity.rotation || 0);
    return patch;
  }

  return patch;
}
