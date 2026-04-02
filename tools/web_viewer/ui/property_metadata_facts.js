import { buildSelectionDetailFacts } from './selection_detail_facts.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushFact(facts, key, label, value, extra = {}) {
  if (value === null || value === undefined || value === '') return;
  facts.push({
    key,
    label,
    value: String(value),
    ...extra,
  });
}

function insertFactsAfterFirstKey(facts, keys, extraFacts) {
  if (!Array.isArray(facts) || !Array.isArray(extraFacts) || extraFacts.length === 0) return facts;
  const anchors = Array.isArray(keys) ? keys : [keys];
  const index = anchors.reduce((found, key) => {
    if (found >= 0) return found;
    return facts.findIndex((fact) => fact?.key === key);
  }, -1);
  if (index < 0) {
    facts.push(...extraFacts);
    return facts;
  }
  facts.splice(index + 1, 0, ...extraFacts);
  return facts;
}

function formatCompactNumber(value) {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.abs(value) < 1e-9 ? 0 : value;
  const text = Number(rounded).toFixed(3).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
}

function formatPoint(value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return '';
  return `${formatCompactNumber(value.x)}, ${formatCompactNumber(value.y)}`;
}

export function buildPropertyMetadataFacts(entity, options = {}) {
  if (!entity) return [];
  const facts = [...buildSelectionDetailFacts(entity, options)];

  const provenanceFacts = [];
  pushFact(provenanceFacts, 'source-type', 'Source Type', normalizeText(entity.sourceType));
  pushFact(provenanceFacts, 'edit-mode', 'Edit Mode', normalizeText(entity.editMode));
  pushFact(provenanceFacts, 'proxy-kind', 'Proxy Kind', normalizeText(entity.proxyKind));
  insertFactsAfterFirstKey(facts, 'entity-visibility', provenanceFacts);

  const hatchFacts = [];
  if (Number.isFinite(entity.hatchId)) {
    pushFact(hatchFacts, 'hatch-id', 'Hatch ID', String(Math.trunc(entity.hatchId)));
  }
  pushFact(hatchFacts, 'hatch-pattern', 'Hatch Pattern', normalizeText(entity.hatchPattern));
  insertFactsAfterFirstKey(facts, 'line-type-scale-source', hatchFacts);

  const dimFacts = [];
  if (Number.isFinite(entity.dimType)) {
    pushFact(dimFacts, 'dim-type', 'Dim Type', String(entity.dimType));
  }
  pushFact(dimFacts, 'dim-style', 'Dim Style', normalizeText(entity.dimStyle));
  insertFactsAfterFirstKey(facts, ['attribute-modes', 'released-attribute-modes'], dimFacts);

  const dimTextFacts = [];
  if (entity.dimTextPos && Number.isFinite(entity.dimTextPos.x) && Number.isFinite(entity.dimTextPos.y)) {
    pushFact(dimTextFacts, 'dim-text-pos', 'Dim Text Pos', formatPoint(entity.dimTextPos));
  }
  if (Number.isFinite(entity.dimTextRotation)) {
    pushFact(dimTextFacts, 'dim-text-rotation', 'Dim Text Rotation', formatCompactNumber(entity.dimTextRotation));
  }
  insertFactsAfterFirstKey(facts, ['current-offset', 'source-text-rotation', 'source-text-pos'], dimTextFacts);

  return facts;
}
