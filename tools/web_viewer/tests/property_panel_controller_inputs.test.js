import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePropertyPanelControllerInputs } from '../ui/property_panel_controller_inputs.js';

test('resolvePropertyPanelControllerInputs groups legacy flat handlers', () => {
  const handlers = {
    getCurrentLayer: () => 'layer',
    getCurrentSpaceContext: () => 'space',
    setCurrentSpaceContext: () => 'set-space',
    listPaperLayouts: () => ['A1'],
    updateCurrentLayer: () => 'update-layer',
  };

  const resolved = resolvePropertyPanelControllerInputs(handlers);

  assert.equal(resolved.getCurrentLayer, handlers.getCurrentLayer);
  assert.equal(resolved.getCurrentSpaceContext, handlers.getCurrentSpaceContext);
  assert.equal(resolved.setCurrentSpaceContext, handlers.setCurrentSpaceContext);
  assert.equal(resolved.listPaperLayouts, handlers.listPaperLayouts);
  assert.equal(resolved.updateCurrentLayer, handlers.updateCurrentLayer);
});

test('resolvePropertyPanelControllerInputs prefers nested controllerHandlers over legacy flat handlers', () => {
  const legacy = () => 'legacy';
  const nested = () => 'nested';

  const resolved = resolvePropertyPanelControllerInputs({
    controllerHandlers: {
      getCurrentLayer: nested,
      listPaperLayouts: nested,
    },
    getCurrentLayer: legacy,
    listPaperLayouts: legacy,
  });

  assert.equal(resolved.getCurrentLayer, nested);
  assert.equal(resolved.listPaperLayouts, nested);
});
