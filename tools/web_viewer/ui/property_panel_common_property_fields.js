export function buildCommonPropertyFieldDescriptors(primary, options = {}, deps = {}) {
  if (!primary) return [];
  const { displayedColor = '', promoteImportedColorSource = false } = options;
  const {
    patchSelection = null,
    buildPatch = null,
    getLayer = null,
    ensureLayer = null,
  } = deps;
  if (typeof patchSelection !== 'function' || typeof buildPatch !== 'function') return [];

  return [
    {
      kind: 'field',
      config: { label: 'Layer ID', name: 'layerId', type: 'number', value: String(primary.layerId) },
      onChange: (value) => {
        const layerId = Number.parseInt(value, 10);
        if (!Number.isFinite(layerId)) return;
        if (typeof getLayer === 'function' && !getLayer(layerId) && typeof ensureLayer === 'function') {
          ensureLayer(layerId);
        }
        const patch = promoteImportedColorSource ? { layerId, colorSource: 'TRUECOLOR', colorAci: null } : { layerId };
        patchSelection(
          patch,
          promoteImportedColorSource ? 'Layer updated; imported color promoted to explicit' : 'Layer updated',
        );
      },
    },
    {
      kind: 'field',
      config: { label: 'Color Override (#RRGGBB)', name: 'color', value: displayedColor || primary.color || '#1f2937' },
      onChange: (value) => patchSelection({ color: value || '#1f2937', colorSource: 'TRUECOLOR', colorAci: null }, 'Color updated'),
    },
    {
      kind: 'toggle',
      label: 'Visible',
      checked: primary.visible !== false,
      onChange: (checked) => patchSelection({ visible: checked }, 'Visibility updated'),
    },
    {
      kind: 'field',
      config: { label: 'Line Type Override', name: 'lineType', value: primary.lineType || 'CONTINUOUS' },
      onChange: (value) => patchSelection(buildPatch(primary, 'lineType', value), 'Line type updated'),
    },
    {
      kind: 'field',
      config: {
        label: 'Line Weight Override',
        name: 'lineWeight',
        type: 'number',
        value: String(Number.isFinite(primary.lineWeight) ? primary.lineWeight : 0),
        step: '0.05',
      },
      onChange: (value) => patchSelection(buildPatch(primary, 'lineWeight', value), 'Line weight updated'),
    },
    {
      kind: 'field',
      config: {
        label: 'Line Type Scale Override',
        name: 'lineTypeScale',
        type: 'number',
        value: String(Number.isFinite(primary.lineTypeScale) ? primary.lineTypeScale : 1),
        step: '0.1',
      },
      onChange: (value) => patchSelection(buildPatch(primary, 'lineTypeScale', value), 'Line type scale updated'),
    },
  ];
}
