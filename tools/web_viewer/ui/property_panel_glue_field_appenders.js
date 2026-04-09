import {
  buildFullTextEditFieldDescriptors,
  buildInsertProxyTextFieldDescriptors,
  buildSingleEntityEditFieldDescriptors,
} from './property_panel_entity_fields.js';
import { buildCommonPropertyFieldDescriptors } from './property_panel_common_fields.js';

export function createPropertyPanelGlueFieldAppenders({
  appendFieldDescriptors,
  patchSelection,
  buildPatch,
  getLayer,
  ensureLayer,
}) {
  function appendCommonPropertyFields(primary, displayedColor, promoteImportedColorSource) {
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

  function appendSourceTextFields(primary) {
    appendFieldDescriptors(buildFullTextEditFieldDescriptors(primary, { patchSelection, buildPatch }));
  }

  function appendInsertProxyTextFields(primary, { allowPositionEditing = false } = {}) {
    appendFieldDescriptors(buildInsertProxyTextFieldDescriptors(
      primary,
      { allowPositionEditing },
      { patchSelection, buildPatch },
    ));
  }

  function appendSingleEntityFields(primary) {
    appendFieldDescriptors(buildSingleEntityEditFieldDescriptors(primary, { patchSelection, buildPatch }));
  }

  return {
    appendCommonPropertyFields,
    appendSourceTextFields,
    appendInsertProxyTextFields,
    appendSingleEntityFields,
  };
}
