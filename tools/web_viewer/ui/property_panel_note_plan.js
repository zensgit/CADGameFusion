import {
  isDirectEditableInsertTextProxyEntity,
  isDirectEditableSourceTextEntity,
} from '../insert_group.js';
import { isReadOnlySelectionEntity } from './selection_meta_helpers.js';
import {
  buildPropertyPanelReadOnlyNote,
  buildPropertyPanelReleasedArchiveNote,
  buildPropertyPanelLockedLayerNote,
} from './property_panel_note_helpers.js';
import {
  resolveLayer,
  supportsInsertTextPositionEditing,
} from './selection_editability_helpers.js';

export function buildPropertyPanelNotePlan(entities, primary, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  const getLayer = typeof options.getLayer === 'function' ? options.getLayer : null;
  const actionContext = options.actionContext || null;
  const primaryLayer = primary ? resolveLayer(getLayer, primary.layerId) : null;
  const readOnlyCount = list.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  const lockedCount = list.filter((entity) => resolveLayer(getLayer, entity?.layerId)?.locked === true).length;
  const readOnlyBlocksFurtherEditing = readOnlyCount > 0 && readOnlyCount === list.length;
  const lockedBlocksFurtherEditing = lockedCount > 0 && lockedCount === list.length;
  const allowDirectSourceTextEditing = readOnlyBlocksFurtherEditing
    && list.length === 1
    && isDirectEditableSourceTextEntity(primary)
    && primaryLayer?.locked !== true;
  const allowDirectInsertTextEditing = readOnlyBlocksFurtherEditing
    && list.length === 1
    && isDirectEditableInsertTextProxyEntity(primary)
    && primaryLayer?.locked !== true;
  const allowInsertTextPositionEditing = allowDirectInsertTextEditing
    && supportsInsertTextPositionEditing(primary);

  return {
    readOnly: {
      text: buildPropertyPanelReadOnlyNote(list, primary, actionContext),
      blocksFurtherEditing: readOnlyBlocksFurtherEditing,
      allowDirectSourceTextEditing,
      allowDirectInsertTextEditing,
      allowInsertTextPositionEditing,
    },
    releasedInsert: {
      text: buildPropertyPanelReleasedArchiveNote(primary?.releasedInsertArchive ?? primary?.released_insert_archive),
    },
    locked: {
      text: buildPropertyPanelLockedLayerNote(list, primary, getLayer),
      blocksFurtherEditing: lockedBlocksFurtherEditing,
    },
  };
}
