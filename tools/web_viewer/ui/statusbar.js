export function createStatusBar({ snapState, toolOptions = null, onToggleOrtho, onToggleSnap, onToggleGrid, onToggleBreakKeep }) {
  const orthoBtn = document.getElementById('cad-toggle-ortho');
  const snapBtn = document.getElementById('cad-toggle-snap');
  const gridBtn = document.getElementById('cad-toggle-grid');
  const breakKeepBtn = document.getElementById('cad-toggle-break-keep');
  const messageEl = document.getElementById('cad-status-message');
  const cursorEl = document.getElementById('cad-status-cursor');

  function setMessage(text) {
    if (messageEl) {
      messageEl.textContent = text;
    }
  }

  function setCursor(worldPoint) {
    if (!cursorEl) return;
    cursorEl.textContent = `X: ${worldPoint.x.toFixed(3)} Y: ${worldPoint.y.toFixed(3)}`;
  }

  function refreshToggleLabels() {
    const options = snapState.toJSON();
    if (orthoBtn) {
      orthoBtn.textContent = `Ortho: ${options.ortho ? 'On' : 'Off'}`;
    }
    if (snapBtn) {
      const enabled = options.endpoint
        || options.midpoint
        || options.quadrant
        || options.center
        || options.intersection
        || options.nearest
        || options.tangent;
      snapBtn.textContent = `Snap: ${enabled ? 'On' : 'Off'}`;
    }
    if (gridBtn) {
      gridBtn.textContent = `Grid: ${options.grid ? 'On' : 'Off'}`;
    }
    if (breakKeepBtn) {
      const mode = toolOptions && typeof toolOptions.breakKeep === 'string' ? toolOptions.breakKeep : 'auto';
      const label = mode === 'short' ? 'Short' : (mode === 'long' ? 'Long' : 'Auto');
      breakKeepBtn.textContent = `Break Keep: ${label}`;
    }
  }

  orthoBtn?.addEventListener('click', () => onToggleOrtho?.());
  snapBtn?.addEventListener('click', () => onToggleSnap?.());
  gridBtn?.addEventListener('click', () => onToggleGrid?.());
  breakKeepBtn?.addEventListener('click', () => onToggleBreakKeep?.());

  snapState.addEventListener('change', refreshToggleLabels);
  refreshToggleLabels();

  return {
    setMessage,
    setCursor,
    refreshToggleLabels,
  };
}
