import {
  appendEmptySelectionShell,
  appendMultipleSelectionShell,
  appendSingleSelectionShell,
} from './property_panel_selection_shell_renderers.js';
import { buildPropertyPanelSelectionShellState } from './property_panel_selection_shell_state.js';

function resolveDocument(element) {
  if (element?.ownerDocument && typeof element.ownerDocument.createElement === 'function') {
    return element.ownerDocument;
  }
  return document;
}

export function setPropertySelectionSummary(element, text) {
  if (element) {
    element.textContent = text;
  }
}

export function renderPropertySelectionShells(summaryElement, detailsElement, presentation) {
  setPropertySelectionSummary(summaryElement, presentation?.summaryText || '');
  setPropertySelectionDetails(detailsElement, presentation);
}

export function setPropertySelectionDetails(element, presentation) {
  if (!element) return;
  const doc = resolveDocument(element);
  element.innerHTML = '';

  const state = buildPropertyPanelSelectionShellState(presentation);

  for (const [key, value] of Object.entries(state.dataset)) {
    element.dataset[key] = value;
  }

  if (!presentation || presentation.mode === 'empty' || !state.primary) {
    appendEmptySelectionShell(doc, element);
    return;
  }

  if (presentation.mode === 'multiple') {
    appendMultipleSelectionShell(doc, element, state.badges, state.detailFacts);
    return;
  }

  appendSingleSelectionShell(doc, element, state.primary, state.badges, state.detailFacts);
}
