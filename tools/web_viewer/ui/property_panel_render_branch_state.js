export function buildPropertyPanelRenderBranchState(selectionContext) {
  const { kind, entities, presentation, primary } = selectionContext;

  const shouldRenderCurrentLayerDefaults = kind === 'empty';
  const shouldRenderActiveSelection =
    kind === 'active' && Array.isArray(entities) && entities.length > 0 && primary != null;

  return {
    kind,
    presentation,
    selectionContext,
    shouldRenderCurrentLayerDefaults,
    shouldRenderActiveSelection,
  };
}
