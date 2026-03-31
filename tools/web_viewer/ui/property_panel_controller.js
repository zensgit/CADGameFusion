import { buildSelectionActionContext } from './selection_presenter.js';
import { renderNoSelectionSection } from './property_panel_section_shells.js';

function getBagFunction(bag, key) {
  return typeof bag?.[key] === 'function' ? bag[key] : null;
}

function resolveFunction(bag, legacyValue, key) {
  return getBagFunction(bag, key)
    || (typeof legacyValue === 'function' ? legacyValue : null);
}

export function createPropertyPanelController({
  documentState,
  commandBus,
  setStatus,
  controllerInputs = null,
  domBindings = null,
  getCurrentLayer = null,
  getCurrentSpaceContext = null,
  listPaperLayouts = null,
  setCurrentSpaceContext = null,
  updateCurrentLayer = null,
  addNote,
  addActionRow,
  appendFieldDescriptors,
  appendInfoRows,
}) {
  const resolvedControllerInputs = {
    getCurrentLayer: resolveFunction(controllerInputs, getCurrentLayer, 'getCurrentLayer'),
    getCurrentSpaceContext: resolveFunction(controllerInputs, getCurrentSpaceContext, 'getCurrentSpaceContext'),
    listPaperLayouts: resolveFunction(controllerInputs, listPaperLayouts, 'listPaperLayouts'),
    setCurrentSpaceContext: resolveFunction(controllerInputs, setCurrentSpaceContext, 'setCurrentSpaceContext'),
    updateCurrentLayer: resolveFunction(controllerInputs, updateCurrentLayer, 'updateCurrentLayer'),
  };
  const resolvedDomBindings = {
    addNote: resolveFunction(domBindings, addNote, 'addNote'),
    addActionRow: resolveFunction(domBindings, addActionRow, 'addActionRow'),
    appendFieldDescriptors: resolveFunction(domBindings, appendFieldDescriptors, 'appendFieldDescriptors'),
    appendInfoRows: resolveFunction(domBindings, appendInfoRows, 'appendInfoRows'),
  };

  function resolveSelectionActionContext(entity, selectionIds = []) {
    return buildSelectionActionContext(entity, selectionIds, {
      listEntities: () => (documentState ? documentState.listEntities() : []),
    });
  }

  function renderCurrentLayerDefaults() {
    renderNoSelectionSection(
      {
        currentLayer: typeof resolvedControllerInputs.getCurrentLayer === 'function' ? resolvedControllerInputs.getCurrentLayer() : null,
        currentSpaceContext: typeof resolvedControllerInputs.getCurrentSpaceContext === 'function' ? resolvedControllerInputs.getCurrentSpaceContext() : null,
        paperLayouts: typeof resolvedControllerInputs.listPaperLayouts === 'function' ? resolvedControllerInputs.listPaperLayouts() : [],
        setCurrentSpaceContext: resolvedControllerInputs.setCurrentSpaceContext,
        setStatus,
        updateCurrentLayer: resolvedControllerInputs.updateCurrentLayer,
      },
      {
        appendNote: (note) => resolvedDomBindings.addNote?.(note.text, note.key),
        appendInfoRows: resolvedDomBindings.appendInfoRows,
        appendActionRow: resolvedDomBindings.addActionRow,
        appendFieldDescriptors: resolvedDomBindings.appendFieldDescriptors,
      },
    );
  }

  function patchSelection(patch, message = 'Property updated') {
    const result = commandBus.execute('selection.propertyPatch', { patch });
    setStatus(result.ok ? message : (result.message || 'Property update failed'));
  }

  return {
    patchSelection,
    renderCurrentLayerDefaults,
    resolveSelectionActionContext,
  };
}
