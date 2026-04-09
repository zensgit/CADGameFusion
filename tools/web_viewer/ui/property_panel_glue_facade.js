import { buildLayerActions } from './property_panel_layer_actions.js';
import { createGroupActionAppenders } from './property_panel_glue_group_actions.js';
import { createFieldAppenders } from './property_panel_glue_field_appenders.js';
import { buildStyleActionDescriptors } from './property_panel_common_fields.js';

export function createPropertyPanelGlueFacade({
  addActionRow,
  appendFieldDescriptors,
  patchSelection,
  buildPatch,
  getLayer,
  ensureLayer,
  setStatus,
  focusLayer = null,
  getCurrentLayerId = null,
  useLayer = null,
  lockLayer = null,
  unlockLayer = null,
  isolateLayer = null,
  hasLayerIsolation = null,
  restoreLayerIsolation = null,
  turnOffLayer = null,
  turnOnLayer = null,
  freezeLayer = null,
  thawLayer = null,
  hasLayerFreeze = null,
  restoreLayerFreeze = null,
  selectSourceGroup = null,
  selectSourceText = null,
  selectSourceAnchorDriver = null,
  flipDimensionTextSide = null,
  flipLeaderLandingSide = null,
  resetSourceTextPlacement = null,
  fitSourceAnchor = null,
  fitLeaderLanding = null,
  fitSourceGroup = null,
  editSourceGroupText = null,
  releaseSourceGroup = null,
  openInsertPeer = null,
  selectInsertGroup = null,
  selectInsertText = null,
  selectEditableInsertText = null,
  selectEditableInsertGroup = null,
  fitInsertGroup = null,
  editInsertText = null,
  releaseInsertGroup = null,
  openReleasedInsertPeer = null,
  selectReleasedInsertGroup = null,
  fitReleasedInsertGroup = null,
}) {
  function appendStyleActions(entity, layer) {
    addActionRow(buildStyleActionDescriptors(entity, layer, { patchSelection }));
  }

  function appendLayerActions(layer) {
    addActionRow(buildLayerActions(layer, {
      setStatus,
      focusLayer,
      getCurrentLayerId,
      useLayer,
      lockLayer,
      unlockLayer,
      isolateLayer,
      hasLayerIsolation,
      restoreLayerIsolation,
      turnOffLayer,
      turnOnLayer,
      freezeLayer,
      thawLayer,
      hasLayerFreeze,
      restoreLayerFreeze,
    }));
  }

  const {
    appendSourceGroupActions,
    appendInsertGroupActions,
    appendReleasedInsertArchiveActions,
    appendCommonSelectionActions,
  } = createGroupActionAppenders({
    addActionRow,
    setStatus,
    selectSourceGroup,
    selectSourceText,
    selectSourceAnchorDriver,
    flipDimensionTextSide,
    flipLeaderLandingSide,
    resetSourceTextPlacement,
    fitSourceAnchor,
    fitLeaderLanding,
    fitSourceGroup,
    editSourceGroupText,
    releaseSourceGroup,
    openInsertPeer,
    selectInsertGroup,
    selectInsertText,
    selectEditableInsertText,
    selectEditableInsertGroup,
    fitInsertGroup,
    editInsertText,
    releaseInsertGroup,
    openReleasedInsertPeer,
    selectReleasedInsertGroup,
    fitReleasedInsertGroup,
  });

  const {
    appendCommonPropertyFields,
    appendSourceTextFields,
    appendInsertProxyTextFields,
    appendSingleEntityFields,
  } = createFieldAppenders({
    appendFieldDescriptors,
    patchSelection,
    buildPatch,
    getLayer,
    ensureLayer,
  });

  return {
    appendStyleActions,
    appendLayerActions,
    appendSourceGroupActions,
    appendInsertGroupActions,
    appendReleasedInsertArchiveActions,
    appendCommonSelectionActions,
    appendCommonPropertyFields,
    appendSourceTextFields,
    appendInsertProxyTextFields,
    appendSingleEntityFields,
  };
}
