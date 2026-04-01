import {
  buildPropertyPanelActiveSelectionInput,
} from './property_panel_render_inputs.js';
import { renderPropertyPanelActiveSelection } from './property_panel_active_render.js';

export function executePropertyPanelRenderBranch(context, branchState, deps = {}) {
  const buildActiveSelectionInput = deps?.buildPropertyPanelActiveSelectionInput || buildPropertyPanelActiveSelectionInput;
  const renderActiveSelection = deps?.renderPropertyPanelActiveSelection || renderPropertyPanelActiveSelection;

  if (branchState.shouldRenderCurrentLayerDefaults) {
    context.controller.renderCurrentLayerDefaults();
    return { rendered: true, kind: branchState.kind };
  }

  if (!branchState.shouldRenderActiveSelection) {
    return { rendered: false, kind: branchState.kind };
  }

  return renderActiveSelection(buildActiveSelectionInput(context, branchState.selectionContext));
}
