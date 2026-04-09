export function buildFullTextEditFieldDescriptors(primary, deps = {}) {
  if (!primary || primary.type !== 'text') return [];
  const { patchSelection = null, buildPatch = null } = deps;
  if (typeof patchSelection !== 'function' || typeof buildPatch !== 'function') return [];
  return [
    {
      kind: 'field',
      config: { label: 'Text', name: 'value', value: primary.value || 'TEXT' },
      onChange: (value) => patchSelection(buildPatch(primary, 'value', value), 'Text updated'),
    },
    {
      kind: 'field',
      config: { label: 'Position X', name: 'position.x', type: 'number', value: String(primary.position.x) },
      onChange: (value) => patchSelection(buildPatch(primary, 'position.x', value), 'Text position updated'),
    },
    {
      kind: 'field',
      config: { label: 'Position Y', name: 'position.y', type: 'number', value: String(primary.position.y) },
      onChange: (value) => patchSelection(buildPatch(primary, 'position.y', value), 'Text position updated'),
    },
    {
      kind: 'field',
      config: { label: 'Height', name: 'height', type: 'number', value: String(primary.height || 2.5) },
      onChange: (value) => patchSelection(buildPatch(primary, 'height', value), 'Text height updated'),
    },
    {
      kind: 'field',
      config: { label: 'Rotation (rad)', name: 'rotation', type: 'number', value: String(primary.rotation || 0) },
      onChange: (value) => patchSelection(buildPatch(primary, 'rotation', value), 'Text rotation updated'),
    },
  ];
}
