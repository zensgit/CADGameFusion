import { appendSingleSelectionHero } from './property_panel_selection_hero_renderer.js';
import { renderSelectionBadgeRow, renderSelectionFactList } from './property_panel_selection_row_renderers.js';

export function appendEmptySelectionShell(doc, element) {
  const empty = doc.createElement('div');
  empty.className = 'cad-selection-empty';
  empty.textContent = 'Select an entity to inspect provenance and effective style.';
  element.appendChild(empty);
}

export function appendMultipleSelectionShell(doc, element, badges, detailFacts) {
  const mixed = doc.createElement('div');
  mixed.className = 'cad-selection-empty';
  mixed.textContent = detailFacts.length > 0
    ? 'Multiple selection: common edit fields stay in Properties; shared provenance is summarized below.'
    : 'Multiple selection: common edit fields stay in Properties; provenance detail is shown for single selection only.';
  element.appendChild(mixed);

  const badgeRow = renderSelectionBadgeRow(doc, badges);
  if (badgeRow) {
    element.appendChild(badgeRow);
  }

  const facts = renderSelectionFactList(doc, detailFacts);
  if (facts) {
    element.appendChild(facts);
  }
}

export function appendSingleSelectionShell(doc, element, primary, badges, detailFacts) {
  appendSingleSelectionHero(doc, element, primary, detailFacts);

  const badgeRow = renderSelectionBadgeRow(doc, badges);
  if (badgeRow) {
    element.appendChild(badgeRow);
  }

  const facts = renderSelectionFactList(doc, detailFacts);
  if (facts) {
    element.appendChild(facts);
  }
}
