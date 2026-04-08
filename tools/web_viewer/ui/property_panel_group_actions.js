import { isInsertGroupEntity } from '../insert_group.js';
export { buildReleasedInsertArchiveActions } from './property_panel_released_insert_actions.js';

function pushAction(actions, {
  id,
  label,
  invoke,
  failureMessage,
  setStatus = null,
}) {
  if (typeof invoke !== 'function') return;
  actions.push({
    id,
    label,
    onClick: () => {
      const result = invoke();
      if (result === false && typeof setStatus === 'function') {
        setStatus(failureMessage);
      }
    },
  });
}

export function buildSourceGroupActions(entity, actionContext = null, deps = {}) {
  const sourceGroup = actionContext?.sourceGroup || null;
  if (!entity || !sourceGroup?.summary || isInsertGroupEntity(entity)) return [];
  const {
    setStatus = null,
    selectSourceGroup = null,
    selectSourceText = null,
    selectSourceAnchorDriver = null,
    flipDimensionTextSide = null,
    flipLeaderLandingSide = null,
    resetSourceTextPlacement = null,
    fitSourceAnchor = null,
    fitLeaderLanding = null,
    fitSourceGroup = null,
    editSourceGroupText = null,
    releaseSourceGroup = null,
  } = deps;
  const sourceGroupSummary = sourceGroup.summary;
  const sourceTextGuide = sourceGroup.sourceTextGuide;
  const actions = [];

  if (sourceGroupSummary.memberIds.length > 1 && !sourceGroup.selectionMatchesGroup) {
    pushAction(actions, {
      id: 'select-source-group',
      label: `Select Source Group (${sourceGroupSummary.memberIds.length})`,
      invoke: () => (typeof selectSourceGroup === 'function' ? selectSourceGroup(entity.id) : false),
      failureMessage: 'Select Source Group failed',
      setStatus,
    });
  }
  if (sourceGroup.textMemberCount > 0 && !sourceGroup.selectionMatchesText) {
    pushAction(actions, {
      id: 'select-source-text',
      label: `Select Source Text (${sourceGroup.textMemberCount})`,
      invoke: () => (typeof selectSourceText === 'function' ? selectSourceText(entity.id) : false),
      failureMessage: 'Select Source Text failed',
      setStatus,
    });
  }
  if (Number.isFinite(sourceTextGuide?.anchorDriverId)) {
    pushAction(actions, {
      id: 'select-source-anchor-driver',
      label: 'Select Anchor Driver',
      invoke: () => (typeof selectSourceAnchorDriver === 'function' ? selectSourceAnchorDriver(entity.id) : false),
      failureMessage: 'Select Anchor Driver failed',
      setStatus,
    });
  }
  if (sourceTextGuide?.anchor && sourceTextGuide?.sourceType === 'DIMENSION') {
    pushAction(actions, {
      id: 'flip-dimension-text-side',
      label: 'Use Opposite Text Side',
      invoke: () => (typeof flipDimensionTextSide === 'function' ? flipDimensionTextSide(entity.id) : false),
      failureMessage: 'Use Opposite Text Side failed',
      setStatus,
    });
  }
  if (sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.anchor && sourceTextGuide?.elbowPoint) {
    pushAction(actions, {
      id: 'flip-leader-landing-side',
      label: 'Use Opposite Landing Side',
      invoke: () => (typeof flipLeaderLandingSide === 'function' ? flipLeaderLandingSide(entity.id) : false),
      failureMessage: 'Use Opposite Landing Side failed',
      setStatus,
    });
  }
  if (sourceGroup.resettableTextMemberCount > 0) {
    pushAction(actions, {
      id: 'reset-source-text-placement',
      label: `Reset Source Text Placement (${sourceGroup.resettableTextMemberCount})`,
      invoke: () => (typeof resetSourceTextPlacement === 'function' ? resetSourceTextPlacement(entity.id) : false),
      failureMessage: 'Reset Source Text Placement failed',
      setStatus,
    });
  }
  if (sourceTextGuide?.anchor) {
    pushAction(actions, {
      id: 'fit-source-anchor',
      label: 'Fit Source Anchor',
      invoke: () => (typeof fitSourceAnchor === 'function' ? fitSourceAnchor(entity.id) : false),
      failureMessage: 'Fit Source Anchor failed',
      setStatus,
    });
  }
  if (sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.elbowPoint) {
    pushAction(actions, {
      id: 'fit-leader-landing',
      label: 'Fit Leader Landing',
      invoke: () => (typeof fitLeaderLanding === 'function' ? fitLeaderLanding(entity.id) : false),
      failureMessage: 'Fit Leader Landing failed',
      setStatus,
    });
  }
  if (sourceGroupSummary.memberIds.length > 0) {
    pushAction(actions, {
      id: 'fit-source-group',
      label: 'Fit Source Group',
      invoke: () => (typeof fitSourceGroup === 'function' ? fitSourceGroup(entity.id) : false),
      failureMessage: 'Fit Source Group failed',
      setStatus,
    });
  }
  if (sourceGroup.textMemberCount > 0) {
    pushAction(actions, {
      id: 'edit-source-text',
      label: `Release & Edit Source Text (${sourceGroup.textMemberCount})`,
      invoke: () => (typeof editSourceGroupText === 'function' ? editSourceGroupText(entity.id) : false),
      failureMessage: 'Release & Edit Source Text failed',
      setStatus,
    });
  }
  if (sourceGroupSummary.memberIds.length > 0) {
    pushAction(actions, {
      id: 'release-source-group',
      label: `Release Source Group (${sourceGroupSummary.memberIds.length})`,
      invoke: () => (typeof releaseSourceGroup === 'function' ? releaseSourceGroup(entity.id) : false),
      failureMessage: 'Release Source Group failed',
      setStatus,
    });
  }
  return actions;
}

export function buildInsertGroupActions(entity, actionContext = null, deps = {}) {
  const insertGroup = actionContext?.insertGroup || null;
  if (!entity || !insertGroup?.summary) return [];
  const {
    setStatus = null,
    openInsertPeer = null,
    selectInsertGroup = null,
    selectInsertText = null,
    selectEditableInsertText = null,
    selectEditableInsertGroup = null,
    fitInsertGroup = null,
    editInsertText = null,
    releaseInsertGroup = null,
  } = deps;
  const insertGroupSummary = insertGroup.summary;
  const insertPeerTargets = Array.isArray(insertGroup.peerTargets) ? insertGroup.peerTargets : [];
  const actions = [];

  if (insertPeerTargets.length > 1 && insertGroup.peerNavigableSelection) {
    for (const peerTarget of insertPeerTargets) {
      if (peerTarget.isCurrent) continue;
      pushAction(actions, {
        id: `open-insert-peer-${peerTarget.index + 1}`,
        label: `Open ${peerTarget.target}`,
        invoke: () => (typeof openInsertPeer === 'function' ? openInsertPeer(entity.id, { peerIndex: peerTarget.index }) : false),
        failureMessage: `Open ${peerTarget.target} failed`,
        setStatus,
      });
    }
    pushAction(actions, {
      id: 'previous-insert-peer',
      label: 'Previous Peer Instance',
      invoke: () => (typeof openInsertPeer === 'function' ? openInsertPeer(entity.id, { direction: -1 }) : false),
      failureMessage: 'Previous Peer Instance failed',
      setStatus,
    });
    pushAction(actions, {
      id: 'next-insert-peer',
      label: 'Next Peer Instance',
      invoke: () => (typeof openInsertPeer === 'function' ? openInsertPeer(entity.id, { direction: 1 }) : false),
      failureMessage: 'Next Peer Instance failed',
      setStatus,
    });
  }
  if (insertGroupSummary.memberIds.length > 1 && !insertGroup.selectionMatchesGroup) {
    pushAction(actions, {
      id: 'select-insert-group',
      label: `Select Insert Group (${insertGroupSummary.memberIds.length})`,
      invoke: () => (typeof selectInsertGroup === 'function' ? selectInsertGroup(entity.id) : false),
      failureMessage: 'Select Insert Group failed',
      setStatus,
    });
  }
  if (insertGroup.textMemberCount > 0 && !insertGroup.selectionMatchesText) {
    pushAction(actions, {
      id: 'select-insert-text',
      label: `Select Insert Text (${insertGroup.textMemberCount})`,
      invoke: () => (typeof selectInsertText === 'function' ? selectInsertText(entity.id) : false),
      failureMessage: 'Select Insert Text failed',
      setStatus,
    });
  }
  if (insertGroup.editableTextMemberCount > 0 && !insertGroup.selectionMatchesEditableText) {
    pushAction(actions, {
      id: 'select-editable-insert-text',
      label: `Select Editable Insert Text (${insertGroup.editableTextMemberCount})`,
      invoke: () => (typeof selectEditableInsertText === 'function' ? selectEditableInsertText(entity.id) : false),
      failureMessage: 'Select Editable Insert Text failed',
      setStatus,
    });
  }
  if (
    insertGroupSummary.readOnlyIds.length > 0
    && insertGroupSummary.editableIds.length > 0
    && !insertGroup.selectionMatchesEditableMembers
  ) {
    pushAction(actions, {
      id: 'select-insert-editable',
      label: `Select Editable Members (${insertGroupSummary.editableIds.length})`,
      invoke: () => (typeof selectEditableInsertGroup === 'function' ? selectEditableInsertGroup(entity.id) : false),
      failureMessage: 'Select Editable Members failed',
      setStatus,
    });
  }
  if (insertGroupSummary.memberIds.length > 0) {
    pushAction(actions, {
      id: 'fit-insert-group',
      label: 'Fit Insert Group',
      invoke: () => (typeof fitInsertGroup === 'function' ? fitInsertGroup(entity.id) : false),
      failureMessage: 'Fit Insert Group failed',
      setStatus,
    });
  }
  if (insertGroup.textMemberCount > 0) {
    pushAction(actions, {
      id: 'edit-insert-text',
      label: `Release & Edit Insert Text (${insertGroup.textMemberCount})`,
      invoke: () => (typeof editInsertText === 'function' ? editInsertText(entity.id) : false),
      failureMessage: 'Release & Edit Insert Text failed',
      setStatus,
    });
  }
  if (insertGroupSummary.memberIds.length > 0) {
    pushAction(actions, {
      id: 'release-insert-group',
      label: `Release Insert Group (${insertGroupSummary.memberIds.length})`,
      invoke: () => (typeof releaseInsertGroup === 'function' ? releaseInsertGroup(entity.id) : false),
      failureMessage: 'Release Insert Group failed',
      setStatus,
    });
  }
  return actions;
}
