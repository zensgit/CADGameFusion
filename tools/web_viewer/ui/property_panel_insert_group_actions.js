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
