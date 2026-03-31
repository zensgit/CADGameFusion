import {
  renderEditableSelectionBranch,
  renderLockedSelectionBranch,
  renderReadOnlySelectionBranch,
  renderReleasedInsertArchiveNote,
} from './property_panel_branch_renderers.js';

export function renderPropertyPanelSelectionBranches(context, handlers) {
  const readOnlyResult = renderReadOnlySelectionBranch(
    {
      entities: context?.entities,
      readOnlyCount: context?.readOnlyCount,
      notePlan: context?.notePlan,
    },
    handlers,
  );
  if (readOnlyResult.blocked) {
    return { blockedAt: 'readOnly' };
  }

  renderReleasedInsertArchiveNote(
    {
      releasedInsertArchive: context?.releasedInsertArchive,
      notePlan: context?.notePlan,
    },
    handlers,
  );

  const lockedResult = renderLockedSelectionBranch(
    {
      entities: context?.entities,
      lockedCount: context?.lockedCount,
      notePlan: context?.notePlan,
    },
    handlers,
  );
  if (lockedResult.blocked) {
    return { blockedAt: 'locked' };
  }

  renderEditableSelectionBranch(
    {
      entities: context?.entities,
    },
    handlers,
  );

  return { blockedAt: null };
}
