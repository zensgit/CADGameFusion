export function createStatusBar({ snapState, toolOptions = null, onToggleOrtho, onToggleSnap, onToggleGrid, onToggleBreakKeep, onActivateSolver }) {
  const orthoBtn = document.getElementById('cad-toggle-ortho');
  const snapBtn = document.getElementById('cad-toggle-snap');
  const gridBtn = document.getElementById('cad-toggle-grid');
  const breakKeepBtn = document.getElementById('cad-toggle-break-keep');
  const selectionEl = document.getElementById('cad-status-selection');
  const solverEl = document.getElementById('cad-status-solver');
  const messageEl = document.getElementById('cad-status-message');
  const cursorEl = document.getElementById('cad-status-cursor');

  function setMessage(text) {
    if (messageEl) {
      messageEl.textContent = text;
    }
  }

  function setSelection(text) {
    if (selectionEl) {
      selectionEl.textContent = text;
    }
  }

  function setSolver(text) {
    if (solverEl) {
      solverEl.textContent = text;
    }
  }

  function refreshSolverInteraction() {
    if (!solverEl) return;
    const interactive = typeof onActivateSolver === 'function';
    solverEl.classList.toggle('is-clickable', interactive);
    if (interactive) {
      solverEl.tabIndex = 0;
      solverEl.setAttribute('role', 'button');
      solverEl.setAttribute('aria-label', 'Focus recent solver event');
      solverEl.setAttribute('title', 'Focus recent solver event');
    } else {
      solverEl.removeAttribute('tabindex');
      solverEl.removeAttribute('role');
      solverEl.removeAttribute('aria-label');
      solverEl.removeAttribute('title');
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
  solverEl?.addEventListener('click', () => onActivateSolver?.());
  solverEl?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onActivateSolver?.();
  });

  snapState.addEventListener('change', refreshToggleLabels);
  refreshToggleLabels();
  refreshSolverInteraction();

  return {
    setMessage,
    setSelection,
    setSolver,
    setCursor,
    refreshToggleLabels,
  };
}
