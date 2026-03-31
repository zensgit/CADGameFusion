import { buildLayerActions } from './property_panel_layer_actions.js';
import {
  buildInsertGroupActions,
  buildReleasedInsertArchiveActions,
  buildSourceGroupActions,
} from './property_panel_group_actions.js';
import {
  buildFullTextEditFieldDescriptors,
  buildInsertProxyTextFieldDescriptors,
  buildSingleEntityEditFieldDescriptors,
} from './property_panel_entity_fields.js';
import {
  buildCommonPropertyFieldDescriptors,
  buildStyleActionDescriptors,
} from './property_panel_common_fields.js';

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

  function appendSourceGroupActions(entity, actionContext = null) {
    addActionRow(buildSourceGroupActions(entity, actionContext, {
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
    }));
  }

  function appendInsertGroupActions(entity, actionContext = null) {
    addActionRow(buildInsertGroupActions(entity, actionContext, {
      setStatus,
      openInsertPeer,
      selectInsertGroup,
      selectInsertText,
      selectEditableInsertText,
      selectEditableInsertGroup,
      fitInsertGroup,
      editInsertText,
      releaseInsertGroup,
    }));
  }

  function appendReleasedInsertArchiveActions(entity, actionContext = null) {
    addActionRow(buildReleasedInsertArchiveActions(entity, actionContext, {
      setStatus,
      openReleasedInsertPeer,
      selectReleasedInsertGroup,
      fitReleasedInsertGroup,
    }));
  }

  function appendCommonSelectionActions(primary, actionContext) {
    appendSourceGroupActions(primary, actionContext);
    appendInsertGroupActions(primary, actionContext);
    appendReleasedInsertArchiveActions(primary, actionContext);
  }

  function appendCommonPropertyFields(primary, displayedColor, promoteImportedColorSource) {
    appendFieldDescriptors(buildCommonPropertyFieldDescriptors(
      primary,
      { displayedColor, promoteImportedColorSource },
      {
        patchSelection,
        buildPatch,
        getLayer,
        ensureLayer,
      },
    ));
  }

  function appendSourceTextFields(primary) {
    appendFieldDescriptors(buildFullTextEditFieldDescriptors(primary, { patchSelection, buildPatch }));
  }

  function appendInsertProxyTextFields(primary, { allowPositionEditing = false } = {}) {
    appendFieldDescriptors(buildInsertProxyTextFieldDescriptors(
      primary,
      { allowPositionEditing },
      { patchSelection, buildPatch },
    ));
  }

  function appendSingleEntityFields(primary) {
    appendFieldDescriptors(buildSingleEntityEditFieldDescriptors(primary, { patchSelection, buildPatch }));
  }

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
