import { createPropertyPanelBranchContextHelper } from './property_panel_branch_context_helper.js';
import { createPropertyPanelGlueFacade } from './property_panel_glue_facade.js';
import { createPropertyPanelSelectionInfoHelpers } from './property_panel_selection_info_helpers.js';

function resolveDomBinding(domBindings, legacyValue, key) {
  return typeof domBindings?.[key] === 'function'
    ? domBindings[key]
    : legacyValue;
}

export function createPropertyPanelCollaborators({
  documentState,
  controller,
  domBindings = null,
  addActionRow,
  appendFieldDescriptors,
  appendInfoRows,
  setStatus,
  actionBags,
}) {
  const resolvedAddActionRow = resolveDomBinding(domBindings, addActionRow, 'addActionRow');
  const resolvedAppendFieldDescriptors = resolveDomBinding(domBindings, appendFieldDescriptors, 'appendFieldDescriptors');
  const resolvedAppendInfoRows = resolveDomBinding(domBindings, appendInfoRows, 'appendInfoRows');
  const layerActions = actionBags?.layer || {};
  const sourceGroupActions = actionBags?.sourceGroup || {};
  const insertGroupActions = actionBags?.insertGroup || {};
  const glueFacade = createPropertyPanelGlueFacade({
    addActionRow: resolvedAddActionRow,
    appendFieldDescriptors: resolvedAppendFieldDescriptors,
    patchSelection: controller.patchSelection,
    buildPatch: controller.buildPatch,
    getLayer: (layerId) => documentState.getLayer(layerId),
    ensureLayer: (layerId) => documentState.ensureLayer(layerId),
    setStatus,
    focusLayer: layerActions.focusLayer,
    getCurrentLayerId: layerActions.getCurrentLayerId,
    useLayer: layerActions.useLayer,
    lockLayer: layerActions.lockLayer,
    unlockLayer: layerActions.unlockLayer,
    isolateLayer: layerActions.isolateLayer,
    hasLayerIsolation: layerActions.hasLayerIsolation,
    restoreLayerIsolation: layerActions.restoreLayerIsolation,
    turnOffLayer: layerActions.turnOffLayer,
    turnOnLayer: layerActions.turnOnLayer,
    freezeLayer: layerActions.freezeLayer,
    thawLayer: layerActions.thawLayer,
    hasLayerFreeze: layerActions.hasLayerFreeze,
    restoreLayerFreeze: layerActions.restoreLayerFreeze,
    selectSourceGroup: sourceGroupActions.selectSourceGroup,
    selectSourceText: sourceGroupActions.selectSourceText,
    selectSourceAnchorDriver: sourceGroupActions.selectSourceAnchorDriver,
    flipDimensionTextSide: sourceGroupActions.flipDimensionTextSide,
    flipLeaderLandingSide: sourceGroupActions.flipLeaderLandingSide,
    resetSourceTextPlacement: sourceGroupActions.resetSourceTextPlacement,
    fitSourceAnchor: sourceGroupActions.fitSourceAnchor,
    fitLeaderLanding: sourceGroupActions.fitLeaderLanding,
    fitSourceGroup: sourceGroupActions.fitSourceGroup,
    editSourceGroupText: sourceGroupActions.editSourceGroupText,
    releaseSourceGroup: sourceGroupActions.releaseSourceGroup,
    openInsertPeer: insertGroupActions.openInsertPeer,
    selectInsertGroup: insertGroupActions.selectInsertGroup,
    selectInsertText: insertGroupActions.selectInsertText,
    selectEditableInsertText: insertGroupActions.selectEditableInsertText,
    selectEditableInsertGroup: insertGroupActions.selectEditableInsertGroup,
    fitInsertGroup: insertGroupActions.fitInsertGroup,
    editInsertText: insertGroupActions.editInsertText,
    releaseInsertGroup: insertGroupActions.releaseInsertGroup,
    openReleasedInsertPeer: insertGroupActions.openReleasedInsertPeer,
    selectReleasedInsertGroup: insertGroupActions.selectReleasedInsertGroup,
    fitReleasedInsertGroup: insertGroupActions.fitReleasedInsertGroup,
  });

  const selectionInfoHelpers = createPropertyPanelSelectionInfoHelpers({
    documentState,
    appendInfoRows: resolvedAppendInfoRows,
    appendLayerActions: glueFacade.appendLayerActions,
  });

  const branchContextHelper = createPropertyPanelBranchContextHelper({
    documentState,
    appendInfoRows: resolvedAppendInfoRows,
    appendLayerActions: glueFacade.appendLayerActions,
    appendSourceGroupActions: glueFacade.appendSourceGroupActions,
    appendInsertGroupActions: glueFacade.appendInsertGroupActions,
    appendReleasedInsertArchiveActions: glueFacade.appendReleasedInsertArchiveActions,
  });

  return {
    branchContextHelper,
    glueFacade,
    selectionInfoHelpers,
  };
}
