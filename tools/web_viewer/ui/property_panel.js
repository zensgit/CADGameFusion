import { resolvePropertyPanelActionBags } from './property_panel_action_bags.js';
import { resolvePropertyPanelControllerInputs } from './property_panel_controller_inputs.js';
import { createPropertyPanelCollaborators } from './property_panel_collaborators.js';
import { createPropertyPanelDomAdapter } from './property_panel_dom_adapter.js';
import { resolvePropertyPanelDomRoots } from './property_panel_dom_roots.js';
import { createPropertyPanelController } from './property_panel_controller.js';
import { buildPropertyPanelControllerSlice } from './property_panel_controller_slice.js';
import { attachPropertyPanelLifecycle } from './property_panel_lifecycle.js';
import { renderPropertyPanel } from './property_panel_render.js';
import { buildPropertyPanelPatch } from './property_panel_patch_helpers.js';

export function createPropertyPanel(options = {}) {
  const {
    documentState,
    selectionState,
    commandBus,
    setStatus,
    actionHandlers = null,
  } = options;
  const roots = resolvePropertyPanelDomRoots();

  if (!roots) {
    return {
      dispose() {},
      render() {},
    };
  }
  const { form, summary, details } = roots;
  const domBindings = createPropertyPanelDomAdapter({ form });
  const controllerInputs = resolvePropertyPanelControllerInputs(options);
  const controller = createPropertyPanelController({
    documentState,
    commandBus,
    setStatus,
    controllerInputs,
    domBindings,
  });
  const actionBags = resolvePropertyPanelActionBags({
    actionHandlers,
    ...options,
  });

  const {
    branchContextHelper,
    glueFacade,
    selectionInfoHelpers,
  } = createPropertyPanelCollaborators({
    documentState,
    controller: buildPropertyPanelControllerSlice(controller, {
      buildPatch: buildPropertyPanelPatch,
    }),
    domBindings,
    setStatus,
    actionBags,
  });

  function render() {
    renderPropertyPanel({
      form,
      summary,
      details,
      domBindings,
      selectionState,
      documentState,
      controller,
      glueFacade,
      selectionInfoHelpers,
      branchContextHelper,
    });
  }

  return attachPropertyPanelLifecycle({
    selectionState,
    documentState,
    render,
  });
}
