import { appendLayerActions as appendLayerActionsHelper } from './property_panel_layer_action_appender.js';
import { appendStyleActions as appendStyleActionsHelper } from './property_panel_style_action_appender.js';

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
  function appendStyleActionsForEntity(entity, layer) {
    appendStyleActionsHelper(addActionRow, entity, layer, { patchSelection });
  }

  function appendLayerActions(layer) {
    appendLayerActionsHelper(addActionRow, layer, {
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
    });
  }

  return { appendStyleActions: appendStyleActionsForEntity, appendLayerActions };
}
