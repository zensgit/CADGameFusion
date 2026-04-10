import { buildInsertProxyTextFieldDescriptors } from './property_panel_entity_fields.js';

export function appendInsertProxyTextFields(
  appendFieldDescriptors,
  primary,
  options = {},
  deps = {},
) {
  const { allowPositionEditing = false } = options;
  const { patchSelection, buildPatch } = deps;
  appendFieldDescriptors(buildInsertProxyTextFieldDescriptors(
    primary,
    { allowPositionEditing },
    { patchSelection, buildPatch },
  ));
}
