import { resolveEntityStyleSources } from '../line_style.js';

export function buildStyleActionDescriptors(entity, layer, deps = {}) {
  if (!entity || !layer) return [];
  const { patchSelection = null } = deps;
  if (typeof patchSelection !== 'function') return [];
  const styleSources = resolveEntityStyleSources(entity);
  const actions = [];
  if (styleSources.colorSource !== 'BYLAYER') {
    actions.push({
      id: 'use-layer-color',
      label: 'Use Layer Color',
      onClick: () => patchSelection({
        color: layer.color || '#9ca3af',
        colorSource: 'BYLAYER',
        colorAci: null,
      }, 'Color source: BYLAYER'),
    });
  }
  if (styleSources.lineTypeSource !== 'BYLAYER') {
    actions.push({
      id: 'use-layer-line-type',
      label: 'Use Layer Line Type',
      onClick: () => patchSelection({ lineType: 'BYLAYER' }, 'Line type source: BYLAYER'),
    });
  }
  if (styleSources.lineWeightSource !== 'BYLAYER') {
    actions.push({
      id: 'use-layer-line-weight',
      label: 'Use Layer Line Weight',
      onClick: () => patchSelection({ lineWeight: 0, lineWeightSource: 'BYLAYER' }, 'Line weight source: BYLAYER'),
    });
  }
  if (styleSources.lineTypeScaleSource !== 'DEFAULT') {
    actions.push({
      id: 'use-default-line-type-scale',
      label: 'Use Default Line Type Scale',
      onClick: () => patchSelection({ lineTypeScale: 1, lineTypeScaleSource: 'DEFAULT' }, 'Line type scale source: DEFAULT'),
    });
  }
  return actions;
}
