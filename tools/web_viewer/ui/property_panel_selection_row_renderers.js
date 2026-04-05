export function renderSelectionBadgeRow(doc, badges) {
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

export function renderSelectionFactList(doc, detailFacts) {
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
