import { buildSingleEntityEditFieldDescriptors } from './property_panel_entity_fields.js';

export function appendSingleEntityFields(appendFieldDescriptors, primary, deps = {}) {
  const { patchSelection, buildPatch } = deps;
  appendFieldDescriptors(buildSingleEntityEditFieldDescriptors(primary, { patchSelection, buildPatch }));
}
