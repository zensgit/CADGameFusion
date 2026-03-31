export function buildPropertyPanelActiveRenderCallbacksInput(context, renderState) {
  return {
    addReadonlyNote: context.addReadonlyNote,
    primary: context.primary,
    primaryLayer: renderState.primaryLayer,
    actionContext: renderState.actionContext,
    branchContext: renderState.branchContext,
    displayedColor: renderState.displayedColor,
    insertGroupSummary: renderState.insertGroupSummary,
    promoteImportedColorSource: renderState.promoteImportedColorSource,
    releasedInsertArchiveSelection: renderState.releasedInsertArchiveSelection,
    sourceGroupSummary: renderState.sourceGroupSummary,
    glueFacade: context.glueFacade,
    selectionInfoHelpers: context.selectionInfoHelpers,
    branchContextHelper: context.branchContextHelper,
  };
}

export function buildPropertyPanelActiveBranchInput(context, renderState) {
  return {
    entities: context.entities,
    readOnlyCount: renderState.readOnlyCount,
    lockedCount: renderState.lockedCount,
    releasedInsertArchive: renderState.releasedInsertArchive,
    notePlan: renderState.notePlan,
  };
}
