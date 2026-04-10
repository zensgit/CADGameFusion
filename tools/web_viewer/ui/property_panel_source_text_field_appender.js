import { buildFullTextEditFieldDescriptors } from './property_panel_entity_fields.js';

export function appendSourceTextFields(appendFieldDescriptors, primary, deps = {}) {
  const { patchSelection, buildPatch } = deps;
  appendFieldDescriptors(buildFullTextEditFieldDescriptors(primary, { patchSelection, buildPatch }));
}
