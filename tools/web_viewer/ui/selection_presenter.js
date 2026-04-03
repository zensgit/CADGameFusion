import {
  isDirectEditableInsertTextProxyEntity,
} from '../insert_group.js';
import { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';

export { formatSpaceLabel } from '../space_layout.js';
export { resolveReleasedInsertArchive } from '../insert_group.js';
export {
  describeReadOnlySelectionEntity,
  describeSelectionOrigin,
  formatSelectionLayer,
  formatSelectionLayerColor,
  formatSelectionLayerFlags,
  formatSelectionLayerState,
  isReadOnlySelectionEntity,
  listSelectionLayerFlags,
} from './selection_meta_helpers.js';
export { formatSelectionSummary, formatSelectionStatus } from './selection_overview.js';

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

export function supportsInsertTextPositionEditing(entity) {
  return isDirectEditableInsertTextProxyEntity(entity)
    && typeof entity?.attributeLockPosition === 'boolean'
    && entity.attributeLockPosition !== true;
}

export {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
  summarizeReleasedInsertArchiveSelection,
} from './selection_released_archive_helpers.js';

export { buildSelectionContract } from './selection_contract.js';

import { buildSelectionDetailFacts, buildMultiSelectionDetailFacts } from './selection_detail_facts.js';
export { buildSelectionDetailFacts } from './selection_detail_facts.js';

export { buildPropertyMetadataFacts } from './property_metadata_facts.js';

export { buildSelectionActionContext } from './selection_action_context.js';

export {
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildPropertyPanelLockedLayerNote,
} from './property_panel_note_helpers.js';

export { buildPropertyPanelNotePlan } from './property_panel_note_plan.js';

import { buildSelectionBadges } from './selection_badges.js';
export { buildSelectionBadges } from './selection_badges.js';

export function buildSelectionPresentation(entities, primaryId, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const primary = list.find((entity) => entity && entity.id === primaryId) || list[0] || null;
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const primaryLayer = primary ? resolveLayer(getLayer, primary.layerId) : null;
  return {
    mode: list.length === 0 ? 'empty' : (list.length === 1 ? 'single' : 'multiple'),
    entityCount: list.length,
    summaryText: formatSelectionSummary(list),
    statusText: formatSelectionStatus(list, primaryId),
    primary,
    primaryLayer,
    badges: buildSelectionBadges(list, primaryId, options),
    detailFacts: list.length === 1 ? buildSelectionDetailFacts(primary, options) : buildMultiSelectionDetailFacts(list, options),
  };
}
