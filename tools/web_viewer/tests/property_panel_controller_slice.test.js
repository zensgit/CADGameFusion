import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPropertyPanelControllerSlice } from '../ui/property_panel_controller_slice.js';

test('buildPropertyPanelControllerSlice projects patchSelection and buildPatch only', () => {
  const patchSelection = () => 'patch';
  const buildPatch = () => 'build';

  const slice = buildPropertyPanelControllerSlice(
    {
      patchSelection,
      renderCurrentLayerDefaults: () => 'defaults',
      resolveSelectionActionContext: () => 'context',
    },
    { buildPatch },
  );

  assert.deepEqual(slice, {
    patchSelection,
    buildPatch,
  });
});

test('buildPropertyPanelControllerSlice tolerates missing functions', () => {
  const slice = buildPropertyPanelControllerSlice({}, {});

  assert.deepEqual(slice, {
    patchSelection: null,
    buildPatch: null,
  });
});
