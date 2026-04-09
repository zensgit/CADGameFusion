import { buildFullTextEditFieldDescriptors } from './property_panel_full_text_fields.js';

export function buildSingleEntityEditFieldDescriptors(primary, deps = {}) {
  if (!primary) return [];
  const { patchSelection = null, buildPatch = null } = deps;
  if (typeof patchSelection !== 'function' || typeof buildPatch !== 'function') return [];

  if (primary.type === 'line') {
    return [
      {
        kind: 'field',
        config: { label: 'Start X', name: 'start.x', type: 'number', value: String(primary.start.x) },
        onChange: (value) => patchSelection(buildPatch(primary, 'start.x', value), 'Line start updated'),
      },
      {
        kind: 'field',
        config: { label: 'Start Y', name: 'start.y', type: 'number', value: String(primary.start.y) },
        onChange: (value) => patchSelection(buildPatch(primary, 'start.y', value), 'Line start updated'),
      },
      {
        kind: 'field',
        config: { label: 'End X', name: 'end.x', type: 'number', value: String(primary.end.x) },
        onChange: (value) => patchSelection(buildPatch(primary, 'end.x', value), 'Line end updated'),
      },
      {
        kind: 'field',
        config: { label: 'End Y', name: 'end.y', type: 'number', value: String(primary.end.y) },
        onChange: (value) => patchSelection(buildPatch(primary, 'end.y', value), 'Line end updated'),
      },
    ];
  }

  if (primary.type === 'polyline') {
    return [
      {
        kind: 'toggle',
        label: 'Closed',
        checked: primary.closed === true,
        onChange: (checked) => patchSelection({ closed: checked }, 'Polyline closed updated'),
      },
    ];
  }

  if (primary.type === 'circle' || primary.type === 'arc') {
    const fields = [
      {
        kind: 'field',
        config: { label: 'Center X', name: 'center.x', type: 'number', value: String(primary.center.x) },
        onChange: (value) => patchSelection(buildPatch(primary, 'center.x', value), 'Center updated'),
      },
      {
        kind: 'field',
        config: { label: 'Center Y', name: 'center.y', type: 'number', value: String(primary.center.y) },
        onChange: (value) => patchSelection(buildPatch(primary, 'center.y', value), 'Center updated'),
      },
      {
        kind: 'field',
        config: { label: 'Radius', name: 'radius', type: 'number', value: String(primary.radius) },
        onChange: (value) => patchSelection(buildPatch(primary, 'radius', value), 'Radius updated'),
      },
    ];
    if (primary.type === 'arc') {
      fields.push(
        {
          kind: 'field',
          config: { label: 'Start Angle (rad)', name: 'startAngle', type: 'number', value: String(primary.startAngle || 0) },
          onChange: (value) => patchSelection(buildPatch(primary, 'startAngle', value), 'Arc start angle updated'),
        },
        {
          kind: 'field',
          config: { label: 'End Angle (rad)', name: 'endAngle', type: 'number', value: String(primary.endAngle || 0) },
          onChange: (value) => patchSelection(buildPatch(primary, 'endAngle', value), 'Arc end angle updated'),
        },
      );
    }
    return fields;
  }

  if (primary.type === 'text') {
    return buildFullTextEditFieldDescriptors(primary, deps);
  }

  return [];
}
