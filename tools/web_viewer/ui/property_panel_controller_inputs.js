function getNestedHandler(controllerHandlers, key) {
  return typeof controllerHandlers?.[key] === 'function' ? controllerHandlers[key] : null;
}

function getHandler(controllerHandlers, legacyValue, key) {
  return getNestedHandler(controllerHandlers, key)
    || (typeof legacyValue === 'function' ? legacyValue : null);
}

export function resolvePropertyPanelControllerInputs({
  controllerHandlers = null,
  getCurrentLayer = null,
  getCurrentSpaceContext = null,
  setCurrentSpaceContext = null,
  listPaperLayouts = null,
  updateCurrentLayer = null,
} = {}) {
  return {
    getCurrentLayer: getHandler(controllerHandlers, getCurrentLayer, 'getCurrentLayer'),
    getCurrentSpaceContext: getHandler(controllerHandlers, getCurrentSpaceContext, 'getCurrentSpaceContext'),
    listPaperLayouts: getHandler(controllerHandlers, listPaperLayouts, 'listPaperLayouts'),
    setCurrentSpaceContext: getHandler(controllerHandlers, setCurrentSpaceContext, 'setCurrentSpaceContext'),
    updateCurrentLayer: getHandler(controllerHandlers, updateCurrentLayer, 'updateCurrentLayer'),
  };
}
