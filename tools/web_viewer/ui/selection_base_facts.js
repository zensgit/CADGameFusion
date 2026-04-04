import { isSourceGroupEntity } from '../insert_group.js';
import { formatSpaceLabel } from '../space_layout.js';
import {
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerState,
} from './selection_meta_helpers.js';
import { normalizeText } from './selection_display_helpers.js';
import { formatSelectionAttributeModes } from './selection_attribute_mode_helpers.js';

function pushFact(facts, key, label, value, extra = {}) {
  if (value === null || value === undefined || value === '') return;
  facts.push({
    key,
    label,
    value: String(value),
    ...extra,
  });
}

function formatSourceGroup(entity) {
  const sourceType = normalizeText(entity?.sourceType);
  const proxyKind = normalizeText(entity?.proxyKind);
  return [sourceType, proxyKind].filter(Boolean).join(' / ');
}

export function appendSelectionBaseFacts(facts, entity, { getLayer = null, effectiveColor = null } = {}) {
  pushFact(facts, 'origin', 'Origin', describeSelectionOrigin(entity, { separator: ' / ', includeReadOnly: true }));
  pushFact(facts, 'layer', 'Layer', formatSelectionLayer(entity, getLayer));
  const layerColor = formatSelectionLayerColor(entity, getLayer);
  pushFact(facts, 'layer-color', 'Layer Color', layerColor, { swatch: layerColor || undefined });
  pushFact(facts, 'layer-state', 'Layer State', formatSelectionLayerState(entity, getLayer));
  pushFact(facts, 'entity-visibility', 'Entity Visibility', entity?.visible === false ? 'Hidden' : 'Shown');
  const normalizedEffectiveColor = normalizeText(effectiveColor);
  pushFact(facts, 'effective-color', 'Effective Color', normalizedEffectiveColor, { swatch: normalizedEffectiveColor || undefined });
  pushFact(facts, 'color-source', 'Color Source', normalizeText(entity?.colorSource));
  if (Number.isFinite(entity?.colorAci)) {
    pushFact(facts, 'color-aci', 'Color ACI', String(entity.colorAci));
  }
  pushFact(facts, 'space', 'Space', formatSpaceLabel(entity?.space));
  pushFact(facts, 'layout', 'Layout', normalizeText(entity?.layout));
  if (Number.isFinite(entity?.groupId)) {
    pushFact(facts, 'group-id', 'Group ID', String(Math.trunc(entity.groupId)));
  }
  if (isSourceGroupEntity(entity)) {
    pushFact(facts, 'group-source', 'Group Source', formatSourceGroup(entity));
  }
  if (Number.isFinite(entity?.sourceBundleId) && (!Number.isFinite(entity?.groupId) || Math.trunc(entity.sourceBundleId) !== Math.trunc(entity.groupId))) {
    pushFact(facts, 'source-bundle-id', 'Source Bundle ID', String(Math.trunc(entity.sourceBundleId)));
  }
  pushFact(facts, 'block-name', 'Block Name', normalizeText(entity?.blockName));
  pushFact(facts, 'text-kind', 'Text Kind', normalizeText(entity?.textKind));
  pushFact(facts, 'attribute-tag', 'Attribute Tag', normalizeText(entity?.attributeTag));
  pushFact(facts, 'attribute-default', 'Attribute Default', normalizeText(entity?.attributeDefault));
  pushFact(facts, 'attribute-prompt', 'Attribute Prompt', normalizeText(entity?.attributePrompt));
  if (Number.isFinite(entity?.attributeFlags)) {
    pushFact(facts, 'attribute-flags', 'Attribute Flags', String(Math.trunc(entity.attributeFlags)));
  }
  pushFact(facts, 'attribute-modes', 'Attribute Modes', formatSelectionAttributeModes(entity));
}
