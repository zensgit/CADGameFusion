import { resolveEffectiveEntityColor } from '../line_style.js';
import { shouldPromoteImportedColorSource } from './property_panel_patch_helpers.js';
import {
  buildPropertyPanelNotePlan,
  isReadOnlySelectionEntity,
  summarizeReleasedInsertArchiveSelection,
} from './selection_presenter.js';

export function assemblePropertyPanelRenderState(entities, primary, deps = {}) {
  const documentState = deps?.documentState || null;
  const controller = deps?.controller || null;
  if (!Array.isArray(entities) || entities.length === 0 || !primary || !documentState) {
    return null;
  }

  const primaryLayer = documentState.getLayer(primary?.layerId);
  const displayedColor = resolveEffectiveEntityColor(primary, primaryLayer);
  const readOnlyCount = entities.filter((entity) => isReadOnlySelectionEntity(entity)).length;
  const lockedCount = entities.filter((entity) => documentState.getLayer(entity.layerId)?.locked === true).length;
  const promoteImportedColorSource = shouldPromoteImportedColorSource(entities);
  const selectionIds = entities.map((entity) => entity.id);
  const actionContext = controller
    ? controller.resolveSelectionActionContext(primary, selectionIds)
    : {
      selectionIds,
      sourceGroup: null,
      insertGroup: null,
      releasedInsert: null,
    };
  const getLayer = (layerId) => documentState.getLayer(layerId);
  const notePlan = buildPropertyPanelNotePlan(entities, primary, { getLayer, actionContext });
  const sourceGroupSummary = actionContext.sourceGroup?.summary || null;
  const insertGroupSummary = actionContext.insertGroup?.summary || null;
  const releasedInsertArchive = entities.length === 1 ? (actionContext.releasedInsert?.archive || null) : null;
  const releasedInsertArchiveSelection = entities.length > 1
    ? summarizeReleasedInsertArchiveSelection(entities, { listEntities: () => documentState.listEntities() })
    : null;

  return {
    actionContext,
    branchContext: {
      primary,
      primaryLayer,
      entityCount: entities.length,
      sourceGroupSummary,
      insertGroupSummary,
      releasedInsertArchiveSelection,
      actionContext,
    },
    displayedColor,
    insertGroupSummary,
    lockedCount,
    notePlan,
    primaryLayer,
    promoteImportedColorSource,
    readOnlyCount,
    releasedInsertArchive,
    releasedInsertArchiveSelection,
    selectionIds,
    sourceGroupSummary,
  };
}
