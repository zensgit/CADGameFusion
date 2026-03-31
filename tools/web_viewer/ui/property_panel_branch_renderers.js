export function renderReadOnlySelectionBranch(context, handlers) {
  const entityCount = Array.isArray(context?.entities) ? context.entities.length : 0;
  const readOnlyCount = Number.isFinite(context?.readOnlyCount) ? context.readOnlyCount : 0;
  const readOnlyPlan = context?.notePlan?.readOnly || null;
  if (!(readOnlyCount > 0) || !readOnlyPlan?.text) {
    return { blocked: false };
  }

  handlers.addReadonlyNote(readOnlyPlan.text, 'read-only-note');
  if (entityCount === 1 || readOnlyCount === entityCount) {
    handlers.appendBranchContext({ showReleasedSelectionInfo: true });
  }
  if (!readOnlyPlan.blocksFurtherEditing) {
    return { blocked: false };
  }

  if (readOnlyPlan.allowDirectSourceTextEditing) {
    handlers.appendFullTextFields();
  } else if (readOnlyPlan.allowDirectInsertTextEditing) {
    handlers.appendInsertProxyTextFields({
      allowPositionEditing: readOnlyPlan.allowInsertTextPositionEditing,
    });
  }
  return { blocked: true };
}

export function renderReleasedInsertArchiveNote(context, handlers) {
  if (!context?.releasedInsertArchive || !context?.notePlan?.releasedInsert?.text) {
    return { rendered: false };
  }
  handlers.addReadonlyNote(context.notePlan.releasedInsert.text, 'released-note');
  return { rendered: true };
}

export function renderLockedSelectionBranch(context, handlers) {
  const entityCount = Array.isArray(context?.entities) ? context.entities.length : 0;
  const lockedCount = Number.isFinite(context?.lockedCount) ? context.lockedCount : 0;
  const lockedPlan = context?.notePlan?.locked || null;
  if (!(lockedCount > 0) || !lockedPlan?.text) {
    return { blocked: false };
  }

  handlers.addReadonlyNote(lockedPlan.text, 'locked-note');
  if (entityCount === 1 || lockedCount === entityCount) {
    handlers.appendBranchContext({ showReleasedActions: true, preferSourceGroupFallback: true });
  }
  return { blocked: lockedPlan.blocksFurtherEditing === true };
}

export function renderEditableSelectionBranch(context, handlers) {
  const entityCount = Array.isArray(context?.entities) ? context.entities.length : 0;

  if (entityCount === 1) {
    handlers.appendSingleSelectionInfo();
  } else {
    handlers.appendGroupedSelectionInfo();
  }

  handlers.appendCommonSelectionActions();
  handlers.appendCommonPropertyFields();
  handlers.appendStyleActions();

  if (entityCount === 1) {
    handlers.appendSingleEntityFields();
  }
}
