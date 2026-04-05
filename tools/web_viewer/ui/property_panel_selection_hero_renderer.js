import { describeSelectionOrigin } from './selection_meta_helpers.js';

export function appendSingleSelectionHero(doc, element, primary, detailFacts) {
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
