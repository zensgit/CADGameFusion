import { renderPropertyBranchContext } from './property_panel_branch_context.js';

export function createPropertyPanelBranchContextHelper({
  documentState,
  appendInfoRows,
  appendLayerActions,
  appendSourceGroupActions,
  appendInsertGroupActions,
  appendReleasedInsertArchiveActions,
}) {
  function appendBranchContext(branchContext, {
    showReleasedSelectionInfo = false,
    showReleasedActions = false,
    preferSourceGroupFallback = false,
  } = {}) {
    renderPropertyBranchContext(
      {
        primary: branchContext?.primary || null,
        primaryLayer: branchContext?.primaryLayer || null,
        entityCount: Number.isFinite(branchContext?.entityCount) ? branchContext.entityCount : 0,
        sourceGroupSummary: branchContext?.sourceGroupSummary || null,
        insertGroupSummary: branchContext?.insertGroupSummary || null,
        releasedInsertArchiveSelection: branchContext?.releasedInsertArchiveSelection || null,
        insertPeerSummary: branchContext?.actionContext?.insertGroup?.peerSummary || null,
        actionContext: branchContext?.actionContext || null,
        showReleasedSelectionInfo,
        showReleasedActions,
        preferSourceGroupFallback,
        getLayer: (layerId) => (documentState ? documentState.getLayer(layerId) : null),
        listEntities: () => (documentState ? documentState.listEntities() : []),
      },
      {
        appendInfoRows,
        appendLayerActions,
        appendSourceGroupActions,
        appendInsertGroupActions,
        appendReleasedInsertArchiveActions,
      },
    );
  }

  return {
    appendBranchContext,
  };
}
