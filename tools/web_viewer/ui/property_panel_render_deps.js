import {
  renderPropertySelectionShells,
} from './property_panel_selection_shells.js';
import { resolvePropertyPanelSelectionContext } from './property_panel_selection_context.js';
import { buildPropertyPanelRenderBranchState } from './property_panel_render_branch_state.js';
import { executePropertyPanelRenderBranch } from './property_panel_render_branch_execution.js';

export function resolvePropertyPanelRenderDeps(deps = {}) {
  return {
    renderSelectionShells: deps?.renderPropertySelectionShells || renderPropertySelectionShells,
    resolveSelectionContext: deps?.resolvePropertyPanelSelectionContext || resolvePropertyPanelSelectionContext,
    buildBranchState: deps?.buildPropertyPanelRenderBranchState || buildPropertyPanelRenderBranchState,
    executeBranch: deps?.executePropertyPanelRenderBranch || executePropertyPanelRenderBranch,
  };
}
