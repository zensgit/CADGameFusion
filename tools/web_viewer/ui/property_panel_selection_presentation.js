import { buildSelectionPresentation } from './selection_presenter.js';

export function buildPropertyPanelSelectionPresentation(resolution, contextState) {
  return buildSelectionPresentation(
    contextState.presentationEntities,
    contextState.presentationPrimaryId,
    { getLayer: resolution.getLayer, listEntities: resolution.listEntities },
  );
}
