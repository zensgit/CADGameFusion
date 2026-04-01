import { resolvePropertyPanelRenderDeps } from './property_panel_render_deps.js';
import { runPropertyPanelRenderPipeline } from './property_panel_render_pipeline.js';

export function renderPropertyPanel(context, deps = {}) {
  const resolved = resolvePropertyPanelRenderDeps(deps);
  return runPropertyPanelRenderPipeline(context, resolved, deps);
}
