import { renderPropertyPanelSelectionBranches } from './property_panel_branch_composer.js';
import {
  buildPropertyPanelActiveBranchInput,
  buildPropertyPanelActiveRenderCallbacksInput,
} from './property_panel_active_render_inputs.js';
import { createPropertyPanelRenderCallbacks } from './property_panel_render_callbacks.js';
import { assemblePropertyPanelRenderState } from './property_panel_render_state.js';

export function renderPropertyPanelActiveSelection(context, deps = {}) {
  const assemble = deps?.assemblePropertyPanelRenderState || assemblePropertyPanelRenderState;
  const createCallbacks = deps?.createPropertyPanelRenderCallbacks || createPropertyPanelRenderCallbacks;
  const renderBranches = deps?.renderPropertyPanelSelectionBranches || renderPropertyPanelSelectionBranches;
  const renderState = assemble(context.entities, context.primary, {
    documentState: context.documentState,
    controller: context.controller,
  });
  if (!renderState) {
    return { rendered: false, blockedAt: 'missing-state' };
  }

  const callbacks = createCallbacks(
    buildPropertyPanelActiveRenderCallbacksInput(context, renderState),
  );

  const branchResult = renderBranches(buildPropertyPanelActiveBranchInput(context, renderState), callbacks);

  return {
    rendered: true,
    blockedAt: branchResult?.blockedAt || null,
  };
}
