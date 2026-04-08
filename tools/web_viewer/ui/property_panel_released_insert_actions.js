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

export function buildReleasedInsertArchiveActions(entity, actionContext = null, deps = {}) {
  const releasedInsert = actionContext?.releasedInsert || null;
  if (!entity || !releasedInsert?.archive) return [];
  const {
    setStatus = null,
    openReleasedInsertPeer = null,
    selectReleasedInsertGroup = null,
    fitReleasedInsertGroup = null,
  } = deps;
  const releasedInsertGroupSummary = releasedInsert.groupSummary;
  const releasedInsertPeerTargets = Array.isArray(releasedInsert.peerTargets) ? releasedInsert.peerTargets : [];
  const actions = [];

  if (releasedInsertPeerTargets.length > 1) {
    for (const peerTarget of releasedInsertPeerTargets) {
      if (peerTarget.isCurrent) continue;
      pushAction(actions, {
        id: `open-released-insert-peer-${peerTarget.index + 1}`,
        label: `Open ${peerTarget.target}`,
        invoke: () => (typeof openReleasedInsertPeer === 'function'
          ? openReleasedInsertPeer(entity.id, { peerIndex: peerTarget.index })
          : false),
        failureMessage: `Open ${peerTarget.target} failed`,
        setStatus,
      });
    }
    pushAction(actions, {
      id: 'previous-released-insert-peer',
      label: 'Previous Released Peer',
      invoke: () => (typeof openReleasedInsertPeer === 'function'
        ? openReleasedInsertPeer(entity.id, { direction: -1 })
        : false),
      failureMessage: 'Previous Released Peer failed',
      setStatus,
    });
    pushAction(actions, {
      id: 'next-released-insert-peer',
      label: 'Next Released Peer',
      invoke: () => (typeof openReleasedInsertPeer === 'function'
        ? openReleasedInsertPeer(entity.id, { direction: 1 })
        : false),
      failureMessage: 'Next Released Peer failed',
      setStatus,
    });
  }
  if (releasedInsertGroupSummary && releasedInsertGroupSummary.memberIds.length > 0 && !releasedInsert.selectionMatchesGroup) {
    pushAction(actions, {
      id: 'select-released-insert-group',
      label: `Select Released Insert Group (${releasedInsertGroupSummary.memberIds.length})`,
      invoke: () => (typeof selectReleasedInsertGroup === 'function' ? selectReleasedInsertGroup(entity.id) : false),
      failureMessage: 'Select Released Insert Group failed',
      setStatus,
    });
  }
  if (releasedInsertGroupSummary && releasedInsertGroupSummary.memberIds.length > 0) {
    pushAction(actions, {
      id: 'fit-released-insert-group',
      label: 'Fit Released Insert Group',
      invoke: () => (typeof fitReleasedInsertGroup === 'function' ? fitReleasedInsertGroup(entity.id) : false),
      failureMessage: 'Fit Released Insert Group failed',
      setStatus,
    });
  }
  return actions;
}
