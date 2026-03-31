import { buildCurrentSpaceActions } from './property_panel_layer_actions.js';
import {
  buildCurrentLayerDefaultContent,
  buildCurrentLayerFieldDescriptors,
} from './property_panel_current_layer_defaults.js';
import {
  buildEntityMetadataInfoRows,
  buildInsertGroupInfoRows,
  buildReleasedInsertArchiveSelectionInfoRows,
  buildSourceGroupInfoRows,
} from './property_panel_info_rows.js';

export function renderNoSelectionSection(context, handlers) {
  const currentLayer = context?.currentLayer || null;
  if (!currentLayer || !Number.isFinite(currentLayer.id)) {
    return { rendered: false };
  }

  const currentLayerContent = buildCurrentLayerDefaultContent(
    currentLayer,
    context?.currentSpaceContext || null,
  );
  if (currentLayerContent.note) {
    handlers.appendNote(currentLayerContent.note);
  }
  handlers.appendInfoRows(currentLayerContent.infos || []);
  handlers.appendActionRow(buildCurrentSpaceActions(
    context?.currentSpaceContext || null,
    context?.paperLayouts || [],
    {
      setCurrentSpaceContext: context?.setCurrentSpaceContext || null,
      setStatus: context?.setStatus || null,
    },
  ));
  handlers.appendFieldDescriptors(buildCurrentLayerFieldDescriptors(currentLayer, {
    updateCurrentLayer: context?.updateCurrentLayer || null,
    setStatus: context?.setStatus || null,
  }));
  return { rendered: true };
}

export function renderSingleSelectionSection(context, handlers) {
  const primary = context?.primary || null;
  if (!primary) {
    return { rendered: false };
  }

  handlers.appendInfoRows(buildEntityMetadataInfoRows(primary, {
    getLayer: context?.getLayer || null,
    listEntities: context?.listEntities || null,
  }));
  handlers.appendLayerActions(context?.primaryLayer || null);
  return { rendered: true };
}

export function renderGroupedSelectionSection(context, handlers) {
  const primary = context?.primary || null;
  if (!primary) {
    return { rendered: false };
  }

  if (context?.insertGroupSummary) {
    handlers.appendInfoRows(buildInsertGroupInfoRows(primary, context.insertGroupSummary, {
      listEntities: context?.listEntities || null,
      peerSummary: context?.insertPeerSummary || null,
    }));
  } else if (context?.sourceGroupSummary) {
    handlers.appendInfoRows(buildSourceGroupInfoRows(primary, context.sourceGroupSummary, {
      listEntities: context?.listEntities || null,
    }));
  }
  if (context?.releasedInsertArchiveSelection) {
    handlers.appendInfoRows(buildReleasedInsertArchiveSelectionInfoRows(context.releasedInsertArchiveSelection));
  }
  return { rendered: true };
}
