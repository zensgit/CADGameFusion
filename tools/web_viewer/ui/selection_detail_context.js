import { resolveEffectiveEntityColor, resolveEffectiveEntityStyle, resolveEntityStyleSources } from '../line_style.js';
import {
  isInsertGroupEntity,
  resolveReleasedInsertArchive,
  resolveSourceTextGuide,
  summarizeInsertGroupMembers,
  summarizeInsertPeerInstances,
  summarizeReleasedInsertPeerInstances,
  summarizeSourceGroupMembers,
} from '../insert_group.js';
import { resolveLayer } from './selection_layer_helpers.js';
import { isReadOnlySelectionEntity } from './selection_meta_helpers.js';

export function buildSelectionDetailContext(entity, options = {}) {
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const listEntities = typeof options.listEntities === 'function' ? options.listEntities : null;
  const layer = resolveLayer(getLayer, entity?.layerId);
  const effectiveStyle = resolveEffectiveEntityStyle(entity, layer);
  const effectiveColor = resolveEffectiveEntityColor(entity, layer);
  const styleSources = resolveEntityStyleSources(entity);
  const entities = listEntities ? listEntities() : null;
  const summaryOptions = { isReadOnly: isReadOnlySelectionEntity };
  const releasedInsertArchive = resolveReleasedInsertArchive(entity);

  return {
    getLayer,
    listEntities,
    layer,
    effectiveStyle,
    effectiveColor,
    styleSources,
    entities,
    sourceGroupSummary: entities ? summarizeSourceGroupMembers(entities, entity, summaryOptions) : null,
    insertGroupSummary: isInsertGroupEntity(entity)
      ? summarizeInsertGroupMembers(entities, entity, summaryOptions)
      : null,
    insertPeerSummary: isInsertGroupEntity(entity)
      ? summarizeInsertPeerInstances(entities, entity, summaryOptions)
      : null,
    releasedInsertArchive,
    releasedInsertPeerSummary: releasedInsertArchive
      ? summarizeReleasedInsertPeerInstances(entities, entity, summaryOptions)
      : null,
    sourceTextGuide: entities ? resolveSourceTextGuide(entities, entity) : null,
  };
}
