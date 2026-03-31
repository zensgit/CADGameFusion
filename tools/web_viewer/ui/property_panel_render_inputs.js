export function resolvePropertyPanelReadonlyNote(context) {
  return typeof context?.domBindings?.addReadonlyNote === 'function'
    ? context.domBindings.addReadonlyNote
    : context?.addReadonlyNote;
}

export function buildPropertyPanelActiveSelectionInput(context, selectionContext) {
  return {
    entities: selectionContext.entities,
    primary: selectionContext.primary,
    documentState: context.documentState,
    controller: context.controller,
    glueFacade: context.glueFacade,
    selectionInfoHelpers: context.selectionInfoHelpers,
    branchContextHelper: context.branchContextHelper,
    addReadonlyNote: resolvePropertyPanelReadonlyNote(context),
  };
}
