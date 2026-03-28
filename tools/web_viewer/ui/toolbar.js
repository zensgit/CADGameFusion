export function createToolbar({
  onToolChange,
  onCommandRun,
  onImport,
  onExport,
  onExportCadgf,
  onFitView,
  onClear,
  onUndo,
  onRedo,
}) {
  const toolButtons = [...document.querySelectorAll('.cad-tool')];
  const commandInput = document.getElementById('cad-command-input');
  const commandRunBtn = document.getElementById('cad-command-run');
  const importBtn = document.getElementById('cad-import-json');
  const exportBtn = document.getElementById('cad-export-json');
  const exportCadgfBtn = document.getElementById('cad-export-cadgf');
  const fitViewBtn = document.getElementById('cad-fit-view');
  const clearBtn = document.getElementById('cad-clear-doc');

  function setActiveTool(toolId) {
    for (const button of toolButtons) {
      const active = button.dataset.tool === toolId;
      button.classList.toggle('is-active', active);
    }
  }

  for (const button of toolButtons) {
    button.addEventListener('click', () => {
      const toolId = button.dataset.tool;
      setActiveTool(toolId);
      if (onToolChange) {
        onToolChange(toolId);
      }
    });
  }

  commandRunBtn?.addEventListener('click', () => {
    if (onCommandRun) {
      onCommandRun(commandInput?.value || '');
    }
  });

  commandInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (onCommandRun) {
        onCommandRun(commandInput.value || '');
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        onRedo?.();
      } else {
        onUndo?.();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      onRedo?.();
    }
  });

  importBtn?.addEventListener('click', () => onImport?.());
  exportBtn?.addEventListener('click', () => onExport?.());
  exportCadgfBtn?.addEventListener('click', () => onExportCadgf?.());
  fitViewBtn?.addEventListener('click', () => onFitView?.());
  clearBtn?.addEventListener('click', () => onClear?.());

  return {
    setActiveTool,
    getCommandInput() {
      return commandInput?.value || '';
    },
    setCommandInput(value) {
      if (commandInput) {
        commandInput.value = value;
      }
    },
    clearCommandInput() {
      if (commandInput) {
        commandInput.value = '';
      }
    },
    focusCommandInput() {
      commandInput?.focus();
    },
  };
}
