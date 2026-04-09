import { buildStyleActionDescriptors } from './property_panel_common_fields.js';
import { buildLayerActions } from './property_panel_layer_actions.js';

export function createStyleLayerActionAppenders({
  addActionRow,
  patchSelection,
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

  return { appendStyleActions, appendLayerActions };
}
