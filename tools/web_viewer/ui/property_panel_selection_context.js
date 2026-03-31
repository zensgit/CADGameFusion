import { buildPropertyPanelSelectionResolution } from './property_panel_selection_resolution.js';
import { buildPropertyPanelSelectionContextState } from './property_panel_selection_context_state.js';
import { buildPropertyPanelSelectionPresentation } from './property_panel_selection_presentation.js';

export function resolvePropertyPanelSelectionContext(selectionState, documentState) {
  const resolution = buildPropertyPanelSelectionResolution(selectionState, documentState);
  const contextState = buildPropertyPanelSelectionContextState(resolution);
  const presentation = buildPropertyPanelSelectionPresentation(resolution, contextState);

  return {
    kind: contextState.kind,
    selectionIds: contextState.selectionIds,
    entities: contextState.entities,
    primary: contextState.primary,
    presentation,
  };
}
