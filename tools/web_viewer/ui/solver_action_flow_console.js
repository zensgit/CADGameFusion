function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function coerceString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function formatRequestTarget(request) {
  if (!request || typeof request !== 'object') return '';
  const target = request.target && typeof request.target === 'object' ? request.target : null;
  const kind = coerceString(target?.kind || request.focusKind || request.kind);
  const value = coerceString(target?.value || request.focusValue || request.value);
  if (!kind || !value) return '';
  switch (kind) {
    case 'constraint':
      return `Constraint ${value}`;
    case 'basis-constraint':
      return `Basis ${value}`;
    case 'redundant-constraint':
      return `Redundant ${value}`;
    case 'variable':
      return `Variable ${value}`;
    case 'free-variable':
      return `Free variable ${value}`;
    default:
      return `${kind} ${value}`;
  }
}

function formatEventTarget(event) {
  if (!event || typeof event !== 'object') return '';
  const kind = coerceString(event.focusKind || event.kind);
  const value = coerceString(event.focusValue || event.value);
  if (!kind || !value) return '';
  switch (kind) {
    case 'constraint':
      return `Constraint ${value}`;
    case 'basis-constraint':
      return `Basis ${value}`;
    case 'redundant-constraint':
      return `Redundant ${value}`;
    case 'variable':
      return `Variable ${value}`;
    case 'free-variable':
      return `Free variable ${value}`;
    default:
      return `${kind} ${value}`;
  }
}

function buildConsoleState({ actionState, requestState, eventState, normalized } = {}) {
  const activePanel = actionState?.activePanel && typeof actionState.activePanel === 'object'
    ? actionState.activePanel
    : null;
  const lastRequest = requestState?.lastRequest && typeof requestState.lastRequest === 'object'
    ? requestState.lastRequest
    : null;
  const lastEvent = eventState?.lastEvent && typeof eventState.lastEvent === 'object'
    ? eventState.lastEvent
    : null;
  const recentRequests = Array.isArray(requestState?.history)
    ? requestState.history.slice(-6)
    : [];
  const recentEvents = Array.isArray(eventState?.history)
    ? eventState.history.slice(-6)
    : [];
  const activeFlow = actionState?.activeFlow && typeof actionState.activeFlow === 'object'
    ? actionState.activeFlow
    : null;
  const activeFocus = actionState?.activeFocus && typeof actionState.activeFocus === 'object'
    ? actionState.activeFocus
    : null;
  const panelCount = Number.isFinite(normalized?.actionPanelCount)
    ? Math.trunc(Number(normalized.actionPanelCount))
    : (Array.isArray(normalized?.panels) ? normalized.panels.length : 0);
  return {
    panelCount,
    activePanelId: coerceString(actionState?.activePanelId),
    activePanelTitle: coerceString(activePanel?.ui?.title || activePanel?.label || activePanel?.id),
    activeFocusKind: coerceString(activeFocus?.kind),
    activeFocusValue: coerceString(activeFocus?.value),
    activeFocusLabel: activeFocus ? formatRequestTarget(activeFocus) : '',
    activeFlowStepIndex: Number.isFinite(activeFlow?.stepIndex) ? Math.trunc(Number(activeFlow.stepIndex)) : -1,
    activeFlowStepCount: Number.isFinite(activeFlow?.stepCount) ? Math.trunc(Number(activeFlow.stepCount)) : 0,
    activeFlowProgressLabel: activeFlow && Number.isFinite(activeFlow?.stepIndex) && Number.isFinite(activeFlow?.stepCount) && activeFlow.stepCount > 0
      ? `${Math.trunc(Number(activeFlow.stepIndex)) + 1}/${Math.trunc(Number(activeFlow.stepCount))}`
      : '',
    activeFlowStepLabel: coerceString(activeFlow?.currentStep?.label),
    requestCount: Number.isFinite(requestState?.requestCount) ? Math.trunc(Number(requestState.requestCount)) : 0,
    invokeRequestCount: Number.isFinite(requestState?.invokeRequestCount) ? Math.trunc(Number(requestState.invokeRequestCount)) : 0,
    focusRequestCount: Number.isFinite(requestState?.focusRequestCount) ? Math.trunc(Number(requestState.focusRequestCount)) : 0,
    flowRequestCount: Number.isFinite(requestState?.flowRequestCount) ? Math.trunc(Number(requestState.flowRequestCount)) : 0,
    replayRequestCount: Number.isFinite(requestState?.replayRequestCount) ? Math.trunc(Number(requestState.replayRequestCount)) : 0,
    eventCount: Number.isFinite(eventState?.eventCount) ? Math.trunc(Number(eventState.eventCount)) : 0,
    invokeEventCount: Number.isFinite(eventState?.invokeEventCount) ? Math.trunc(Number(eventState.invokeEventCount)) : 0,
    focusEventCount: Number.isFinite(eventState?.focusEventCount) ? Math.trunc(Number(eventState.focusEventCount)) : 0,
    flowEventCount: Number.isFinite(eventState?.flowEventCount) ? Math.trunc(Number(eventState.flowEventCount)) : 0,
    replayEventCount: Number.isFinite(eventState?.replayEventCount) ? Math.trunc(Number(eventState.replayEventCount)) : 0,
    lastRequestKind: coerceString(lastRequest?.requestKind),
    lastRequestHistoryIndex: Number.isFinite(lastRequest?.historyIndex) ? Math.trunc(Number(lastRequest.historyIndex)) : -1,
    lastRequestPanelId: coerceString(lastRequest?.panelId),
    lastRequestPanelTitle: coerceString(lastRequest?.ui?.title || lastRequest?.label || lastRequest?.panelId),
    lastRequestTargetLabel: formatRequestTarget(lastRequest),
    lastEventKind: coerceString(lastEvent?.eventKind),
    lastEventHistoryIndex: Number.isFinite(lastEvent?.historyIndex) ? Math.trunc(Number(lastEvent.historyIndex)) : -1,
    lastEventPanelId: coerceString(lastEvent?.panelId),
    lastEventTargetLabel: formatEventTarget(lastEvent),
    lastEventFlowAction: coerceString(lastEvent?.flowAction),
    recentRequests: recentRequests.map((request) => {
      const kind = coerceString(request?.requestKind) || 'request';
      const title = coerceString(request?.ui?.title || request?.label || request?.panelId);
      const targetLabel = formatRequestTarget(request);
      return {
        historyIndex: Number.isFinite(request?.historyIndex) ? Math.trunc(Number(request.historyIndex)) : -1,
        requestKind: kind,
        label: [kind, title, targetLabel].filter(Boolean).join(' | '),
      };
    }),
    recentEvents: recentEvents.map((event, index) => {
      const kind = coerceString(event?.eventKind) || 'event';
      const panelId = coerceString(event?.panelId);
      const flowAction = coerceString(event?.flowAction);
      const targetLabel = formatEventTarget(event);
      return {
        historyIndex: Number.isFinite(event?.historyIndex) ? Math.trunc(Number(event.historyIndex)) : index,
        eventKind: kind,
        panelId,
        focusKind: coerceString(event?.focusKind),
        focusValue: coerceString(event?.focusValue),
        flowAction,
        label: [kind, panelId, flowAction, targetLabel].filter(Boolean).join(' | '),
      };
    }),
  };
}

function renderMetric(container, label, value) {
  const item = document.createElement('div');
  item.className = 'cad-solver-flow-console__metric';
  const title = document.createElement('span');
  title.className = 'cad-solver-flow-console__metric-label';
  title.textContent = label;
  const body = document.createElement('strong');
  body.className = 'cad-solver-flow-console__metric-value';
  body.textContent = String(value);
  item.appendChild(title);
  item.appendChild(body);
  container.appendChild(item);
}

function renderInfo(container, label, value) {
  if (!value) return;
  const row = document.createElement('div');
  row.className = 'cad-solver-flow-console__info';
  const title = document.createElement('span');
  title.className = 'cad-solver-flow-console__info-label';
  title.textContent = label;
  const body = document.createElement('span');
  body.className = 'cad-solver-flow-console__info-value';
  body.textContent = String(value);
  row.appendChild(title);
  row.appendChild(body);
  container.appendChild(row);
}

function renderActionInfo(container, { label, value, action, onAction, dataset = {} } = {}) {
  if (!value) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cad-solver-flow-console__info-action';
  if (action) {
    button.dataset.consoleAction = String(action);
  }
  for (const [key, rawValue] of Object.entries(dataset || {})) {
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    button.dataset[key] = String(rawValue);
  }
  const title = document.createElement('span');
  title.className = 'cad-solver-flow-console__info-label';
  title.textContent = label;
  const body = document.createElement('span');
  body.className = 'cad-solver-flow-console__info-value';
  body.textContent = String(value);
  button.appendChild(title);
  button.appendChild(body);
  if (typeof onAction === 'function') {
    button.addEventListener('click', onAction);
  } else {
    button.disabled = true;
  }
  container.appendChild(button);
}

export function createSolverActionFlowConsole({ onPrev, onNext, onRestart, onReplayRequest, onFocusEvent, onFocusCurrent } = {}) {
  const root = document.getElementById('cad-solver-action-flow');
  let state = buildConsoleState();
  let selectedRecentKind = '';
  let selectedRequestHistoryIndex = -1;
  let selectedEventHistoryIndex = -1;

  function selectRecentRequest(historyIndex) {
    selectedRecentKind = 'request';
    selectedRequestHistoryIndex = Number.isFinite(historyIndex) ? Math.trunc(Number(historyIndex)) : -1;
    selectedEventHistoryIndex = -1;
  }

  function selectRecentEvent(historyIndex) {
    selectedRecentKind = 'event';
    selectedEventHistoryIndex = Number.isFinite(historyIndex) ? Math.trunc(Number(historyIndex)) : -1;
    selectedRequestHistoryIndex = -1;
  }

  function syncSelectedState() {
    const requestExists = Array.isArray(state.recentRequests)
      && state.recentRequests.some((request) => Number(request?.historyIndex) === selectedRequestHistoryIndex);
    const eventExists = Array.isArray(state.recentEvents)
      && state.recentEvents.some((event) => Number(event?.historyIndex) === selectedEventHistoryIndex);
    if (selectedRecentKind === 'request' && !requestExists) {
      selectedRecentKind = '';
      selectedRequestHistoryIndex = -1;
    } else if (selectedRecentKind === 'event' && !eventExists) {
      selectedRecentKind = '';
      selectedEventHistoryIndex = -1;
    }
  }

  function runAction(action) {
    switch (action) {
      case 'prev':
        if (typeof onPrev === 'function' && state.activeFlowStepIndex > 0) {
          return onPrev() === true;
        }
        return false;
      case 'next':
        if (typeof onNext === 'function'
          && state.activeFlowStepCount > 0
          && state.activeFlowStepIndex >= 0
          && state.activeFlowStepIndex < (state.activeFlowStepCount - 1)) {
          return onNext() === true;
        }
        return false;
      case 'restart':
        if (typeof onRestart === 'function'
          && state.activeFlowStepCount > 0
          && state.activeFlowStepIndex > 0) {
          return onRestart() === true;
        }
        return false;
      case 'event-focus':
        if (typeof onFocusEvent === 'function' && Array.isArray(state.recentEvents) && state.recentEvents.length > 0) {
          const target = state.recentEvents[state.recentEvents.length - 1];
          selectRecentEvent(target?.historyIndex);
          return onFocusEvent(target) === true;
        }
        return false;
      case 'focus-current':
        if (typeof onFocusCurrent === 'function'
          && state.activePanelId
          && state.activeFocusKind
          && state.activeFocusValue) {
          return onFocusCurrent({
            panelId: state.activePanelId,
            focusKind: state.activeFocusKind,
            focusValue: state.activeFocusValue,
          }) === true;
        }
        return false;
      default:
        return false;
    }
  }

  function render() {
    if (!root) return state;
    root.innerHTML = '';
    root.dataset.requestCount = String(state.requestCount || 0);
    root.dataset.eventCount = String(state.eventCount || 0);
    root.dataset.activePanelId = state.activePanelId || '';
    root.dataset.lastRequestKind = state.lastRequestKind || '';
    root.dataset.lastEventKind = state.lastEventKind || '';

    if (!state.panelCount && !state.requestCount && !state.eventCount && !state.activePanelId) {
      const empty = document.createElement('div');
      empty.className = 'cad-solver-flow-console__empty';
      empty.textContent = 'No solver action flow yet.';
      root.appendChild(empty);
      return state;
    }

    const metrics = document.createElement('div');
    metrics.className = 'cad-solver-flow-console__metrics';
    renderMetric(metrics, 'Requests', state.requestCount);
    renderMetric(metrics, 'Invoke', state.invokeRequestCount);
    renderMetric(metrics, 'Focus', state.focusRequestCount);
    renderMetric(metrics, 'Flow', state.flowRequestCount);
    renderMetric(metrics, 'Replay', state.replayRequestCount);
    renderMetric(metrics, 'Events', state.eventCount);
    renderMetric(metrics, 'Event Invoke', state.invokeEventCount);
    renderMetric(metrics, 'Event Focus', state.focusEventCount);
    renderMetric(metrics, 'Event Flow', state.flowEventCount);
    renderMetric(metrics, 'Event Replay', state.replayEventCount);
    root.appendChild(metrics);

    const activeCard = document.createElement('div');
    activeCard.className = 'cad-solver-flow-console__card';
    activeCard.dataset.kind = 'active';
    renderInfo(activeCard, 'Panel', state.activePanelTitle);
    if (state.activeFocusLabel) {
      renderActionInfo(activeCard, {
        label: 'Focus',
        value: state.activeFocusLabel,
        action: 'focus-current',
        dataset: {
          panelId: state.activePanelId,
          focusKind: state.activeFocusKind,
          focusValue: state.activeFocusValue,
        },
        onAction: () => runAction('focus-current'),
      });
    }
    renderInfo(activeCard, 'Step', state.activeFlowProgressLabel);
    renderInfo(activeCard, 'Step Label', state.activeFlowStepLabel);
    if (activeCard.childElementCount > 0) {
      root.appendChild(activeCard);
    }

    if (state.activePanelId) {
      const controls = document.createElement('div');
      controls.className = 'cad-solver-flow-console__controls';
      const actions = [
        {
          key: 'prev',
          label: 'Prev',
          disabled: !(state.activeFlowStepIndex > 0),
        },
        {
          key: 'next',
          label: 'Next',
          disabled: !(state.activeFlowStepCount > 0 && state.activeFlowStepIndex >= 0 && state.activeFlowStepIndex < (state.activeFlowStepCount - 1)),
        },
        {
          key: 'restart',
          label: 'Restart',
          disabled: !(state.activeFlowStepCount > 0 && state.activeFlowStepIndex > 0),
        },
        {
          key: 'event-focus',
          label: 'Recent Event',
          disabled: !Array.isArray(state.recentEvents) || state.recentEvents.length === 0,
        },
      ];
      for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cad-solver-flow-console__control';
        button.dataset.consoleAction = action.key;
        button.textContent = action.label;
        button.disabled = action.disabled;
        if (!action.disabled) {
          button.addEventListener('click', () => runAction(action.key));
        }
        controls.appendChild(button);
      }
      root.appendChild(controls);
    }

    const requestCard = document.createElement('div');
    requestCard.className = 'cad-solver-flow-console__card';
    requestCard.dataset.kind = 'request';
    requestCard.dataset.requestKind = state.lastRequestKind || '';
    renderInfo(requestCard, 'Last Request', state.lastRequestKind);
    renderInfo(requestCard, 'Request Panel', state.lastRequestPanelTitle);
    renderInfo(requestCard, 'Request Target', state.lastRequestTargetLabel);
    if (requestCard.childElementCount > 0) {
      root.appendChild(requestCard);
    }

    const eventCard = document.createElement('div');
    eventCard.className = 'cad-solver-flow-console__card';
    eventCard.dataset.kind = 'event';
    eventCard.dataset.eventKind = state.lastEventKind || '';
    renderInfo(eventCard, 'Last Event', state.lastEventKind);
    renderInfo(eventCard, 'Event Panel', state.lastEventPanelId);
    renderInfo(eventCard, 'Event Flow', state.lastEventFlowAction);
    renderInfo(eventCard, 'Event Target', state.lastEventTargetLabel);
    if (eventCard.childElementCount > 0) {
      root.appendChild(eventCard);
    }

    if (Array.isArray(state.recentRequests) && state.recentRequests.length > 0) {
      const recent = document.createElement('div');
      recent.className = 'cad-solver-flow-console__recent';
      const heading = document.createElement('div');
      heading.className = 'cad-solver-flow-console__recent-label';
      heading.textContent = 'Recent';
      recent.appendChild(heading);
      for (const request of state.recentRequests) {
        const actionable = typeof onReplayRequest === 'function' && request.historyIndex >= 0;
        const item = document.createElement(actionable ? 'button' : 'div');
        item.className = 'cad-solver-flow-console__recent-item';
        if (actionable) {
          item.type = 'button';
          item.classList.add('is-actionable');
          item.dataset.requestHistoryIndex = String(request.historyIndex);
          item.dataset.requestKind = request.requestKind;
          item.addEventListener('click', () => {
            selectRecentRequest(request.historyIndex);
            render();
            onReplayRequest(request.historyIndex);
          });
        }
        if (selectedRecentKind === 'request' && Number(request.historyIndex) === selectedRequestHistoryIndex) {
          item.classList.add('is-selected');
          item.dataset.selected = 'true';
        }
        item.textContent = request.label;
        recent.appendChild(item);
      }
      root.appendChild(recent);
    }

    if (Array.isArray(state.recentEvents) && state.recentEvents.length > 0) {
      const recent = document.createElement('div');
      recent.className = 'cad-solver-flow-console__recent';
      const heading = document.createElement('div');
      heading.className = 'cad-solver-flow-console__recent-label';
      heading.textContent = 'Recent Events';
      recent.appendChild(heading);
      for (const event of state.recentEvents) {
        const actionable = typeof onFocusEvent === 'function'
          && event.historyIndex >= 0
          && !!event.panelId;
        const item = document.createElement(actionable ? 'button' : 'div');
        item.className = 'cad-solver-flow-console__recent-item';
        item.dataset.eventKind = event.eventKind;
        if (actionable) {
          item.type = 'button';
          item.classList.add('is-actionable');
          item.dataset.eventHistoryIndex = String(event.historyIndex);
          item.dataset.panelId = event.panelId;
          item.dataset.focusKind = event.focusKind || '';
          item.dataset.focusValue = event.focusValue || '';
          item.dataset.flowAction = event.flowAction || '';
          item.addEventListener('click', () => {
            selectRecentEvent(event.historyIndex);
            render();
            onFocusEvent(event);
          });
        }
        if (selectedRecentKind === 'event' && Number(event.historyIndex) === selectedEventHistoryIndex) {
          item.classList.add('is-selected');
          item.dataset.selected = 'true';
        }
        item.textContent = event.label;
        recent.appendChild(item);
      }
      root.appendChild(recent);
    }

    return state;
  }

  function setState(next) {
    state = buildConsoleState(next);
    if (state.lastRequestKind === 'replay' && state.lastRequestHistoryIndex >= 0) {
      selectRecentRequest(state.lastRequestHistoryIndex);
    }
    if (state.lastEventKind === 'focus' && state.lastEventHistoryIndex >= 0) {
      selectRecentEvent(state.lastEventHistoryIndex);
    }
    syncSelectedState();
    return render();
  }

  render();

  return {
    setState,
    getState() {
      return cloneJson({
        ...state,
        selectedRecentKind,
        selectedRequestHistoryIndex,
        selectedEventHistoryIndex,
      });
    },
    render,
  };
}
