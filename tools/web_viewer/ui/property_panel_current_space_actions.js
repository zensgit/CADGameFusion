import { normalizeLayoutName } from '../space_layout.js';

function toActionIdToken(value, fallback = 'layout') {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function pushAction(actions, {
  id,
  label,
  invoke,
  onFalse = null,
  onTrue = null,
  setStatus = null,
}) {
  if (typeof invoke !== 'function') return;
  actions.push({
    id,
    label,
    onClick: () => {
      const result = invoke();
      if (result === false) {
        if (typeof onFalse === 'string' && typeof setStatus === 'function') {
          setStatus(onFalse);
        }
        return;
      }
      if (typeof onTrue === 'string' && typeof setStatus === 'function') {
        setStatus(onTrue);
      }
    },
  });
}

export function buildCurrentSpaceActions(currentSpaceContext = null, paperLayouts = [], deps = {}) {
  const { setCurrentSpaceContext = null, setStatus = null } = deps;
  if (typeof setCurrentSpaceContext !== 'function') return [];
  const actions = [];

  if (currentSpaceContext?.space !== 0) {
    pushAction(actions, {
      id: 'use-model-space',
      label: 'Use Model Space',
      invoke: () => setCurrentSpaceContext({ space: 0, layout: 'Model' }),
      onFalse: 'Current space unchanged: Model',
      setStatus,
    });
  }

  for (const layoutName of Array.isArray(paperLayouts) ? paperLayouts : []) {
    const normalizedLayout = normalizeLayoutName(layoutName);
    if (!normalizedLayout) continue;
    if (currentSpaceContext?.space === 1 && normalizeLayoutName(currentSpaceContext.layout) === normalizedLayout) {
      continue;
    }
    pushAction(actions, {
      id: `use-layout-${toActionIdToken(normalizedLayout)}`,
      label: `Use Layout ${normalizedLayout}`,
      invoke: () => setCurrentSpaceContext({ space: 1, layout: normalizedLayout }),
      onFalse: `Current layout unchanged: ${normalizedLayout}`,
      setStatus,
    });
  }

  return actions;
}
