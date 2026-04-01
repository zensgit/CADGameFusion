function getNestedAction(actionHandlers, groupKey, actionKey) {
  const group = actionHandlers && typeof actionHandlers === 'object'
    ? actionHandlers[groupKey]
    : null;
  return typeof group?.[actionKey] === 'function' ? group[actionKey] : null;
}

function getAction(actionHandlers, legacyValue, groupKey, actionKey) {
  return getNestedAction(actionHandlers, groupKey, actionKey)
    || (typeof legacyValue === 'function' ? legacyValue : null);
}

export function resolvePropertyPanelActionBags({
  actionHandlers = null,
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
  resetSourceTextPlacement = null,
  flipDimensionTextSide = null,
  flipLeaderLandingSide = null,
  fitSourceAnchor = null,
  fitLeaderLanding = null,
  fitSourceGroup = null,
  editSourceGroupText = null,
  releaseSourceGroup = null,
  openInsertPeer = null,
  openReleasedInsertPeer = null,
  selectInsertGroup = null,
  selectReleasedInsertGroup = null,
  selectInsertText = null,
  selectEditableInsertText = null,
  selectEditableInsertGroup = null,
  editInsertText = null,
  releaseInsertGroup = null,
  fitInsertGroup = null,
  fitReleasedInsertGroup = null,
} = {}) {
  return {
    insertGroup: {
      editInsertText: getAction(actionHandlers, editInsertText, 'insertGroup', 'editInsertText'),
      fitInsertGroup: getAction(actionHandlers, fitInsertGroup, 'insertGroup', 'fitInsertGroup'),
      fitReleasedInsertGroup: getAction(actionHandlers, fitReleasedInsertGroup, 'insertGroup', 'fitReleasedInsertGroup'),
      openInsertPeer: getAction(actionHandlers, openInsertPeer, 'insertGroup', 'openInsertPeer'),
      openReleasedInsertPeer: getAction(actionHandlers, openReleasedInsertPeer, 'insertGroup', 'openReleasedInsertPeer'),
      releaseInsertGroup: getAction(actionHandlers, releaseInsertGroup, 'insertGroup', 'releaseInsertGroup'),
      selectEditableInsertGroup: getAction(actionHandlers, selectEditableInsertGroup, 'insertGroup', 'selectEditableInsertGroup'),
      selectEditableInsertText: getAction(actionHandlers, selectEditableInsertText, 'insertGroup', 'selectEditableInsertText'),
      selectInsertGroup: getAction(actionHandlers, selectInsertGroup, 'insertGroup', 'selectInsertGroup'),
      selectInsertText: getAction(actionHandlers, selectInsertText, 'insertGroup', 'selectInsertText'),
      selectReleasedInsertGroup: getAction(actionHandlers, selectReleasedInsertGroup, 'insertGroup', 'selectReleasedInsertGroup'),
    },
    layer: {
      focusLayer: getAction(actionHandlers, focusLayer, 'layer', 'focusLayer'),
      freezeLayer: getAction(actionHandlers, freezeLayer, 'layer', 'freezeLayer'),
      getCurrentLayerId: getAction(actionHandlers, getCurrentLayerId, 'layer', 'getCurrentLayerId'),
      hasLayerFreeze: getAction(actionHandlers, hasLayerFreeze, 'layer', 'hasLayerFreeze'),
      hasLayerIsolation: getAction(actionHandlers, hasLayerIsolation, 'layer', 'hasLayerIsolation'),
      isolateLayer: getAction(actionHandlers, isolateLayer, 'layer', 'isolateLayer'),
      lockLayer: getAction(actionHandlers, lockLayer, 'layer', 'lockLayer'),
      restoreLayerFreeze: getAction(actionHandlers, restoreLayerFreeze, 'layer', 'restoreLayerFreeze'),
      restoreLayerIsolation: getAction(actionHandlers, restoreLayerIsolation, 'layer', 'restoreLayerIsolation'),
      thawLayer: getAction(actionHandlers, thawLayer, 'layer', 'thawLayer'),
      turnOffLayer: getAction(actionHandlers, turnOffLayer, 'layer', 'turnOffLayer'),
      turnOnLayer: getAction(actionHandlers, turnOnLayer, 'layer', 'turnOnLayer'),
      unlockLayer: getAction(actionHandlers, unlockLayer, 'layer', 'unlockLayer'),
      useLayer: getAction(actionHandlers, useLayer, 'layer', 'useLayer'),
    },
    sourceGroup: {
      editSourceGroupText: getAction(actionHandlers, editSourceGroupText, 'sourceGroup', 'editSourceGroupText'),
      fitLeaderLanding: getAction(actionHandlers, fitLeaderLanding, 'sourceGroup', 'fitLeaderLanding'),
      fitSourceAnchor: getAction(actionHandlers, fitSourceAnchor, 'sourceGroup', 'fitSourceAnchor'),
      fitSourceGroup: getAction(actionHandlers, fitSourceGroup, 'sourceGroup', 'fitSourceGroup'),
      flipDimensionTextSide: getAction(actionHandlers, flipDimensionTextSide, 'sourceGroup', 'flipDimensionTextSide'),
      flipLeaderLandingSide: getAction(actionHandlers, flipLeaderLandingSide, 'sourceGroup', 'flipLeaderLandingSide'),
      releaseSourceGroup: getAction(actionHandlers, releaseSourceGroup, 'sourceGroup', 'releaseSourceGroup'),
      resetSourceTextPlacement: getAction(actionHandlers, resetSourceTextPlacement, 'sourceGroup', 'resetSourceTextPlacement'),
      selectSourceAnchorDriver: getAction(actionHandlers, selectSourceAnchorDriver, 'sourceGroup', 'selectSourceAnchorDriver'),
      selectSourceGroup: getAction(actionHandlers, selectSourceGroup, 'sourceGroup', 'selectSourceGroup'),
      selectSourceText: getAction(actionHandlers, selectSourceText, 'sourceGroup', 'selectSourceText'),
    },
  };
}
