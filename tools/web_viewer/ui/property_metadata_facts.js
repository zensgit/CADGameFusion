import { buildSelectionDetailFacts } from './selection_detail_facts.js';
import { normalizeText, formatCompactNumber, formatPoint } from './selection_display_helpers.js';

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
