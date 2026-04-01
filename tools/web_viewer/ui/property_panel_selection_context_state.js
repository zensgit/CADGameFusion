export function buildPropertyPanelSelectionContextState(resolution) {
  const { selectionIds, primaryId, entities, primary } = resolution;

  if (selectionIds.length === 0) {
    return {
      kind: 'empty',
      selectionIds,
      entities: [],
      primary: null,
      presentationEntities: [],
      presentationPrimaryId: primaryId,
    };
  }

  if (entities.length === 0) {
    return {
      kind: 'missing',
      selectionIds,
      entities: [],
      primary: null,
      presentationEntities: [],
      presentationPrimaryId: primaryId,
    };
  }

  return {
    kind: 'active',
    selectionIds,
    entities,
    primary,
    presentationEntities: entities,
    presentationPrimaryId: primary?.id ?? primaryId,
  };
}
