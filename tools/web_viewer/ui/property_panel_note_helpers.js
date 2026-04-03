import {
  isDirectEditableInsertTextProxyEntity,
  isDirectEditableSourceTextEntity,
  isInsertTextProxyEntity,
  resolveReleasedInsertArchive,
} from '../insert_group.js';
import {
  describeReadOnlySelectionEntity,
  formatSelectionLayer,
  isReadOnlySelectionEntity,
} from './selection_meta_helpers.js';
import {
  formatReleasedInsertArchiveOrigin,
} from './selection_released_archive_helpers.js';

function resolveLayer(getLayer, layerId) {
  if (typeof getLayer !== 'function' || !Number.isFinite(layerId)) return null;
  const layer = getLayer(Math.trunc(layerId));
  return layer && typeof layer === 'object' ? layer : null;
}

function supportsInsertTextPositionEditing(entity) {
  return isDirectEditableInsertTextProxyEntity(entity)
    && typeof entity?.attributeLockPosition === 'boolean'
    && entity.attributeLockPosition !== true;
}

export function buildPropertyPanelReadOnlyNote(entities, primary, actionContext = null) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0 || !primary) return '';
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  if (readOnlyCount <= 0) return '';

  const insertGroupSummary = actionContext?.insertGroup?.summary || null;
  const sourceGroupSummary = actionContext?.sourceGroup?.summary || null;
  const fullInsertGroupSelected = !!insertGroupSummary
    && insertGroupSummary.readOnlyIds.length > 0
    && actionContext?.insertGroup?.selectionMatchesGroup === true;
  const fullSourceGroupSelected = !insertGroupSummary
    && !!sourceGroupSummary
    && sourceGroupSummary.readOnlyIds.length > 0
    && actionContext?.sourceGroup?.selectionMatchesGroup === true;

  if (readOnlyCount === list.length) {
    if (list.length === 1) {
      if (isDirectEditableSourceTextEntity(primary)) {
        return `Selected entity is a read-only source text proxy (${describeReadOnlySelectionEntity(primary)}); text overrides stay editable while geometry remains proxy-only.`;
      }
      if (isDirectEditableInsertTextProxyEntity(primary)) {
        const positionClause = supportsInsertTextPositionEditing(primary)
          ? 'text position stays editable while instance geometry remains proxy-only'
          : (primary?.attributeLockPosition === true
          ? 'position stays lock-positioned until release'
          : 'instance geometry remains proxy-only');
        return String(primary?.textKind || '').trim().toLowerCase() === 'attdef'
          ? `Selected entity is a read-only INSERT ATTDEF text proxy (${describeReadOnlySelectionEntity(primary)}); default text stays editable while prompt remains read-only, ${positionClause}${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden until focused through insert text selection' : ''}.`
          : `Selected entity is a read-only INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); text value stays editable, ${positionClause}${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden until focused through insert text selection' : ''}.`;
      }
      if (isInsertTextProxyEntity(primary) && primary?.attributeConstant === true) {
        return `Selected entity is a read-only constant INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); constant attribute values stay importer-authored until release, instance geometry remains proxy-only${primary?.attributeInvisible === true ? ', and invisible attributes stay hidden by default' : ''}.`;
      }
      if (isInsertTextProxyEntity(primary) && primary?.attributeInvisible === true) {
        return `Selected entity is a read-only invisible INSERT text proxy (${describeReadOnlySelectionEntity(primary)}); hidden attribute text is inspectable through insert text focus, but geometry remains proxy-only.`;
      }
      return `Selected entity is read-only (${describeReadOnlySelectionEntity(primary)}); editing disabled.`;
    }
    return fullInsertGroupSelected
      ? 'Selected entities are a read-only imported insert group; full-group move/rotate/scale/copy/delete stay instance-level until release.'
      : (fullSourceGroupSelected
          ? 'Selected entities are a read-only source group; full-group move/rotate/scale/copy/delete stay bundle-level until release while source-text edit stays available when the bundle has text.'
          : 'Selected entities are read-only proxies; editing disabled.');
  }

  return fullInsertGroupSelected
    ? `Contains ${readOnlyCount} read-only derived/proxy entities; property edits skip them, full-group move/rotate/scale/copy/delete stay instance-level, and release detaches the group to editable geometry.`
    : (fullSourceGroupSelected
        ? `Contains ${readOnlyCount} read-only derived/proxy entities; full-group move/rotate/scale/copy/delete stay bundle-level, source-group selection/fit/release stay available, and source-text edit can release straight into editable text when present.`
        : `Contains ${readOnlyCount} read-only derived/proxy entities; property edits skip them.`);
}

export function buildPropertyPanelReleasedArchiveNote(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  if (!archive) return '';
  const archiveOrigin = formatReleasedInsertArchiveOrigin(archive) || 'INSERT / text / proxy';
  const archiveTextKind = String(archive?.textKind || '').trim().toLowerCase();
  return archiveTextKind === 'attdef'
    ? `Selected entity was released from imported ${archiveOrigin}; archived ATTDEF provenance remains visible as read-only context while the detached text now edits like plain text.`
    : `Selected entity was released from imported ${archiveOrigin}; archived insert provenance remains visible as read-only context while the detached text now edits like plain text.`;
}

export function buildPropertyPanelLockedLayerNote(entities, primary, getLayer = null) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0 || !primary) return '';
  const lockedCount = list.filter((entity) => resolveLayer(getLayer, entity?.layerId)?.locked === true).length;
  if (lockedCount <= 0) return '';
  if (lockedCount === list.length) {
    const layerSummary = formatSelectionLayer(primary, getLayer);
    return list.length === 1
      ? `Selected entity is on locked layer ${layerSummary}; editing disabled until the layer is unlocked.`
      : 'Selected entities are on locked layers; editing disabled.';
  }
  return `Contains ${lockedCount} entities on locked layers; edits skip them.`;
}
