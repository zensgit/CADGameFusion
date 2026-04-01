import {
  buildEntityMetadataInfoRows,
  buildInsertGroupInfoRows,
  buildReleasedInsertArchiveSelectionInfoRows,
  buildSourceGroupInfoRows,
} from './property_panel_info_rows.js';

export function renderPropertyBranchContext(context, handlers) {
  const primary = context?.primary || null;
  if (!primary) {
    return { rendered: false };
  }

  handlers.appendInfoRows(buildEntityMetadataInfoRows(primary, {
    getLayer: context?.getLayer || null,
    listEntities: context?.listEntities || null,
  }));

  const entityCount = Number.isFinite(context?.entityCount) ? context.entityCount : 0;
  if (entityCount === 1) {
    handlers.appendLayerActions(context?.primaryLayer || null);
  } else {
    if (context?.insertGroupSummary) {
      handlers.appendInfoRows(buildInsertGroupInfoRows(primary, context.insertGroupSummary, {
        listEntities: context?.listEntities || null,
        peerSummary: context?.insertPeerSummary || null,
      }));
    } else if (context?.sourceGroupSummary || context?.preferSourceGroupFallback) {
      handlers.appendInfoRows(buildSourceGroupInfoRows(primary, context?.sourceGroupSummary || null, {
        listEntities: context?.listEntities || null,
      }));
    }
    if (context?.showReleasedSelectionInfo && context?.releasedInsertArchiveSelection) {
      handlers.appendInfoRows(buildReleasedInsertArchiveSelectionInfoRows(context.releasedInsertArchiveSelection));
    }
  }

  handlers.appendSourceGroupActions(primary, context?.actionContext || null);
  handlers.appendInsertGroupActions(primary, context?.actionContext || null);
  if (context?.showReleasedActions) {
    handlers.appendReleasedInsertArchiveActions(primary, context?.actionContext || null);
  }
  return { rendered: true };
}
