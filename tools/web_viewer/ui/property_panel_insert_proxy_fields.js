export function buildInsertProxyTextFieldDescriptors(primary, options = {}, deps = {}) {
  if (!primary || primary.type !== 'text') return [];
  const { allowPositionEditing = false } = options;
  const { patchSelection = null, buildPatch = null } = deps;
  if (typeof patchSelection !== 'function' || typeof buildPatch !== 'function') return [];
  const label = String(primary?.textKind || '').trim().toLowerCase() === 'attdef' ? 'Default Text' : 'Text';
  const fields = [
    {
      kind: 'field',
      config: { label, name: 'value', value: primary.value || 'TEXT' },
      onChange: (value) => patchSelection({ value: String(value ?? primary.value ?? '') }, 'Text updated'),
    },
  ];
  if (allowPositionEditing) {
    fields.push(
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
    );
  }
  return fields;
}
