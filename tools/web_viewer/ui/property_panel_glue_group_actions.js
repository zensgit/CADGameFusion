import {
  buildInsertGroupActions,
  buildReleasedInsertArchiveActions,
  buildSourceGroupActions,
} from './property_panel_group_actions.js';

export function createGroupActionAppenders({
  addActionRow,
  setStatus,
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

  return {
    appendSourceGroupActions,
    appendInsertGroupActions,
    appendReleasedInsertArchiveActions,
    appendCommonSelectionActions,
  };
}
