import {
  renderGroupedSelectionSection,
  renderSingleSelectionSection,
} from './property_panel_section_shells.js';

export function createPropertyPanelSelectionInfoHelpers({
  documentState,
  appendInfoRows,
  appendLayerActions,
}) {
  function appendSingleSelectionInfo(primary, primaryLayer) {
    renderSingleSelectionSection(
      {
        primary,
        primaryLayer,
        getLayer: (layerId) => (documentState ? documentState.getLayer(layerId) : null),
        listEntities: () => (documentState ? documentState.listEntities() : []),
      },
      {
        appendInfoRows,
        appendLayerActions,
      },
    );
  }

  function appendGroupedSelectionInfo(primary, sourceGroupSummary, insertGroupSummary, releasedInsertArchiveSelection, actionContext) {
    renderGroupedSelectionSection(
      {
        primary,
        sourceGroupSummary,
        insertGroupSummary,
        releasedInsertArchiveSelection,
        insertPeerSummary: actionContext.insertGroup?.peerSummary || null,
        listEntities: () => (documentState ? documentState.listEntities() : []),
      },
      {
        appendInfoRows,
      },
    );
  }

  return {
    appendGroupedSelectionInfo,
    appendSingleSelectionInfo,
  };
}
