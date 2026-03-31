export function buildPropertyPanelSelectionResolution(selectionState, documentState) {
  const selectionIds = Array.isArray(selectionState?.entityIds)
    ? selectionState.entityIds.filter(Number.isFinite)
    : [];
  const primaryId = Number.isFinite(selectionState?.primaryId) ? selectionState.primaryId : null;
  const getLayer = (layerId) => (documentState ? documentState.getLayer(layerId) : null);
  const listEntities = () => (documentState ? documentState.listEntities() : []);

  const entities = selectionIds
    .map((id) => (documentState ? documentState.getEntity(id) : null))
    .filter((entity) => !!entity);

  const primary = entities.length > 0
    ? ((documentState ? documentState.getEntity(primaryId) : null) || entities[0])
    : null;

  return { selectionIds, primaryId, entities, primary, getLayer, listEntities };
}
