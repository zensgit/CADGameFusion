import { buildStyleActionDescriptors } from './property_panel_common_fields.js';

export function appendStyleActions(addActionRow, entity, layer, deps = {}) {
  const { patchSelection } = deps;
  addActionRow(buildStyleActionDescriptors(entity, layer, { patchSelection }));
}
