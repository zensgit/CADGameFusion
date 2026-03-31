function resolveFunction(source, key) {
  return typeof source?.[key] === 'function' ? source[key] : null;
}

export function buildPropertyPanelControllerSlice(controller, deps = {}) {
  const patchSelection = resolveFunction(controller, 'patchSelection');
  const buildPatch = resolveFunction(deps, 'buildPatch');
  return {
    patchSelection,
    buildPatch,
  };
}
