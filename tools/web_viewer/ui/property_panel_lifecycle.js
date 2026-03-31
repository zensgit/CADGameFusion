export function attachPropertyPanelLifecycle({
  selectionState,
  documentState,
  render,
  autoRender = true,
}) {
  if (typeof render !== 'function') {
    return {
      dispose() {},
      render() {},
    };
  }

  const handleChange = () => {
    render();
  };

  if (selectionState && typeof selectionState.addEventListener === 'function') {
    selectionState.addEventListener('change', handleChange);
  }
  if (documentState && typeof documentState.addEventListener === 'function') {
    documentState.addEventListener('change', handleChange);
  }
  if (autoRender !== false) {
    render();
  }

  return {
    render,
    dispose() {
      if (selectionState && typeof selectionState.removeEventListener === 'function') {
        selectionState.removeEventListener('change', handleChange);
      }
      if (documentState && typeof documentState.removeEventListener === 'function') {
        documentState.removeEventListener('change', handleChange);
      }
    },
  };
}
