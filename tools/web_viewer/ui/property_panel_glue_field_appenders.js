import {
  buildInsertProxyTextFieldDescriptors,
  buildSingleEntityEditFieldDescriptors,
} from './property_panel_entity_fields.js';
import { appendCommonPropertyFields } from './property_panel_common_field_appender.js';
import { appendSourceTextFields } from './property_panel_source_text_field_appender.js';

export function createPropertyPanelGlueFieldAppenders({
  appendFieldDescriptors,
  patchSelection,
  buildPatch,
  getLayer,
  ensureLayer,
}) {
  function appendCommonPropertyFieldsForPrimary(primary, displayedColor, promoteImportedColorSource) {
    appendCommonPropertyFields(
      appendFieldDescriptors,
      primary,
      displayedColor,
      promoteImportedColorSource,
      {
        patchSelection,
        buildPatch,
        getLayer,
        ensureLayer,
      },
    );
  }

  function appendSourceTextFieldsForPrimary(primary) {
    appendSourceTextFields(appendFieldDescriptors, primary, { patchSelection, buildPatch });
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
    appendCommonPropertyFields: appendCommonPropertyFieldsForPrimary,
    appendSourceTextFields: appendSourceTextFieldsForPrimary,
    appendInsertProxyTextFields,
    appendSingleEntityFields,
  };
}
