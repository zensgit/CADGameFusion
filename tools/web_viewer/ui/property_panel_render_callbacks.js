export function createPropertyPanelRenderCallbacks({
  addReadonlyNote,
  primary,
  primaryLayer,
  actionContext,
  branchContext,
  displayedColor,
  insertGroupSummary,
  promoteImportedColorSource,
  releasedInsertArchiveSelection,
  sourceGroupSummary,
  glueFacade,
  selectionInfoHelpers,
  branchContextHelper,
}) {
  function appendBranchContext(options = {}) {
    branchContextHelper.appendBranchContext(branchContext, options);
  }

  function appendFullTextFields() {
    glueFacade.appendSourceTextFields(primary);
  }

  function appendInsertProxyTextFields({ allowPositionEditing = false } = {}) {
    glueFacade.appendInsertProxyTextFields(primary, { allowPositionEditing });
  }

  function appendSingleSelectionInfo() {
    selectionInfoHelpers.appendSingleSelectionInfo(primary, primaryLayer);
  }

  function appendGroupedSelectionInfo() {
    selectionInfoHelpers.appendGroupedSelectionInfo(
      primary,
      sourceGroupSummary,
      insertGroupSummary,
      releasedInsertArchiveSelection,
      actionContext,
    );
  }

  function appendCommonSelectionActions() {
    glueFacade.appendCommonSelectionActions(primary, actionContext);
  }

  function appendCommonPropertyFields() {
    glueFacade.appendCommonPropertyFields(primary, displayedColor, promoteImportedColorSource);
  }

  function appendStyleActions() {
    glueFacade.appendStyleActions(primary, primaryLayer);
  }

  function appendSingleEntityFields() {
    glueFacade.appendSingleEntityFields(primary);
  }

  return {
    addReadonlyNote,
    appendBranchContext,
    appendCommonPropertyFields,
    appendCommonSelectionActions,
    appendFullTextFields,
    appendGroupedSelectionInfo,
    appendInsertProxyTextFields,
    appendSingleEntityFields,
    appendSingleSelectionInfo,
    appendStyleActions,
  };
}
