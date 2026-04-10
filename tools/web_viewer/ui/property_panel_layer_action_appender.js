import { buildLayerActions } from './property_panel_layer_actions.js';

export function appendLayerActions(addActionRow, layer, deps = {}) {
  addActionRow(buildLayerActions(layer, deps));
}
