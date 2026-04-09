import { buildCommonPropertyFieldDescriptors } from './property_panel_common_fields.js';

export function appendCommonPropertyFields(
  appendFieldDescriptors,
  primary,
  displayedColor,
  promoteImportedColorSource,
  deps = {},
) {
  const {
    patchSelection,
    buildPatch,
    getLayer,
    ensureLayer,
  } = deps;
  appendFieldDescriptors(buildCommonPropertyFieldDescriptors(
    primary,
    { displayedColor, promoteImportedColorSource },
    {
      patchSelection,
      buildPatch,
      getLayer,
      ensureLayer,
    },
  ));
}
