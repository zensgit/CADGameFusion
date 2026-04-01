import { describeSelectionOrigin } from './selection_presenter.js';

function renderSelectionBadgeRow(doc, badges) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return null;
  }
  const badgeRow = doc.createElement('div');
  badgeRow.className = 'cad-selection-badges';
  for (const badge of badges) {
    const chip = doc.createElement('span');
    chip.className = `cad-selection-badge${badge.tone ? ` is-${badge.tone}` : ''}`;
    chip.dataset.selectionBadge = badge.key;
    chip.textContent = badge.value;
    badgeRow.appendChild(chip);
  }
  return badgeRow;
}

function renderSelectionFactList(doc, detailFacts) {
  if (!Array.isArray(detailFacts) || detailFacts.length === 0) {
    return null;
  }
  const facts = doc.createElement('div');
  facts.className = 'cad-selection-facts';
  for (const fact of detailFacts) {
    const row = doc.createElement('div');
    row.className = 'cad-selection-fact';
    row.dataset.selectionField = fact.key;

    const label = doc.createElement('span');
    label.textContent = fact.label;
    row.appendChild(label);

    if (fact.swatch) {
      const dot = doc.createElement('span');
      dot.className = 'cad-selection-fact__swatch';
      dot.style.background = fact.swatch;
      row.appendChild(dot);
    }

    const value = doc.createElement('strong');
    value.textContent = fact.value;
    row.appendChild(value);
    facts.appendChild(row);
  }
  return facts;
}

function appendSingleSelectionHero(doc, element, primary, detailFacts) {
  const hero = doc.createElement('div');
  hero.className = 'cad-selection-hero';

  const swatch = doc.createElement('div');
  swatch.className = 'cad-selection-hero__swatch';
  swatch.dataset.selectionField = 'effective-color-swatch';
  const effectiveColorFact = detailFacts.find((fact) => fact && fact.key === 'effective-color');
  const swatchColor = typeof effectiveColorFact?.swatch === 'string' && effectiveColorFact.swatch.trim()
    ? effectiveColorFact.swatch.trim()
    : (typeof primary.color === 'string' && primary.color.trim() ? primary.color.trim() : '#ffffff');
  swatch.dataset.selectionColor = swatchColor;
  swatch.style.background = swatchColor;
  hero.appendChild(swatch);

  const heroText = doc.createElement('div');
  heroText.className = 'cad-selection-hero__text';

  const title = doc.createElement('strong');
  title.className = 'cad-selection-hero__title';
  title.dataset.selectionField = 'type';
  title.textContent = primary.type || 'entity';
  heroText.appendChild(title);

  const caption = describeSelectionOrigin(primary, { separator: ' / ', includeReadOnly: true });
  if (caption) {
    const subtitle = doc.createElement('div');
    subtitle.className = 'cad-selection-hero__subtitle';
    subtitle.dataset.selectionField = 'origin-caption';
    subtitle.textContent = caption;
    heroText.appendChild(subtitle);
  }
  hero.appendChild(heroText);
  element.appendChild(hero);
}

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
