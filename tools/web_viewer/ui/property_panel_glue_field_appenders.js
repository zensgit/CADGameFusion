import { appendCommonPropertyFields } from './property_panel_common_field_appender.js';
import { appendSourceTextFields } from './property_panel_source_text_field_appender.js';
import { appendInsertProxyTextFields as appendInsertProxyTextFieldsHelper } from './property_panel_insert_proxy_field_appender.js';
import { appendSingleEntityFields as appendSingleEntityFieldsHelper } from './property_panel_single_entity_field_appender.js';

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

  function appendInsertProxyTextFieldsForPrimary(primary, { allowPositionEditing = false } = {}) {
    appendInsertProxyTextFieldsHelper(
      appendFieldDescriptors,
      primary,
      { allowPositionEditing },
      {
        patchSelection,
        buildPatch,
      },
    );
  }

  function appendSingleEntityFieldsForPrimary(primary) {
    appendSingleEntityFieldsHelper(appendFieldDescriptors, primary, { patchSelection, buildPatch });
  }

  return {
    appendCommonPropertyFields: appendCommonPropertyFieldsForPrimary,
    appendSourceTextFields: appendSourceTextFieldsForPrimary,
    appendInsertProxyTextFields: appendInsertProxyTextFieldsForPrimary,
    appendSingleEntityFields: appendSingleEntityFieldsForPrimary,
  };
}
