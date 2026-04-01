export function runPropertyPanelRenderPipeline(context, resolvedDeps, rawDeps = {}) {
  context.form.innerHTML = '';
  const selectionContext = resolvedDeps.resolveSelectionContext(context.selectionState, context.documentState);
  const branchState = resolvedDeps.buildBranchState(selectionContext);

  resolvedDeps.renderSelectionShells(context.summary, context.details, branchState.presentation);

  return resolvedDeps.executeBranch(context, branchState, rawDeps);
}
