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

function formatFocusLabel(focus) {
  if (!focus || typeof focus !== 'object') return '';
  const kind = coerceString(focus.kind);
  const value = coerceString(focus.value);
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

function resolveRecentEvent(eventState) {
  const history = Array.isArray(eventState?.history) ? eventState.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];
    const panelId = coerceString(event?.panelId);
    if (!panelId) continue;
    return {
      historyIndex: Number.isFinite(event?.historyIndex) ? Math.trunc(Number(event.historyIndex)) : index,
      panelId,
      eventKind: coerceString(event?.eventKind),
      flowAction: coerceString(event?.flowAction),
      focusKind: coerceString(event?.focusKind),
      focusValue: coerceString(event?.focusValue),
      label: [coerceString(event?.eventKind), panelId, coerceString(event?.flowAction), formatFocusLabel(event)]
        .filter(Boolean)
        .join(' | '),
    };
  }
  return null;
}

function buildBannerState({ actionState, requestState, eventState } = {}) {
  const activePanel = actionState?.activePanel && typeof actionState.activePanel === 'object'
    ? actionState.activePanel
    : null;
  const activeFlow = actionState?.activeFlow && typeof actionState.activeFlow === 'object'
    ? actionState.activeFlow
    : null;
  const activeFocus = actionState?.activeFocus && typeof actionState.activeFocus === 'object'
    ? actionState.activeFocus
    : null;
  const recentEvent = resolveRecentEvent(eventState);
  const stepIndex = Number.isFinite(activeFlow?.stepIndex) ? Math.trunc(Number(activeFlow.stepIndex)) : -1;
  const stepCount = Number.isFinite(activeFlow?.stepCount) ? Math.trunc(Number(activeFlow.stepCount)) : 0;
  const flowSteps = Array.isArray(activeFlow?.steps)
    ? activeFlow.steps
      .map((step) => {
        const nextIndex = Number.isFinite(step?.stepIndex) ? Math.trunc(Number(step.stepIndex)) : -1;
        const label = coerceString(step?.label);
        if (nextIndex < 0 || !label) return null;
        return {
          stepIndex: nextIndex,
          label,
          current: nextIndex === stepIndex,
        };
      })
      .filter((step) => !!step)
    : [];
  return {
    activePanelId: coerceString(actionState?.activePanelId),
    activePanelTitle: coerceString(activePanel?.ui?.title || activePanel?.label || activePanel?.id),
    activePanelSubtitle: coerceString(activePanel?.ui?.subtitle || activePanel?.summary),
    activePanelDescription: coerceString(activePanel?.ui?.description || activePanel?.selectionExplanation || activePanel?.hint),
    activePanelSeverity: coerceString(activePanel?.ui?.severity) || 'neutral',
    activePanelBadgeLabel: coerceString(activePanel?.ui?.badgeLabel || activePanel?.tag),
    focusLabel: formatFocusLabel(activeFocus),
    focusKind: coerceString(activeFocus?.kind),
    focusValue: coerceString(activeFocus?.value),
    stepIndex,
    stepCount,
    progressLabel: stepCount > 0 && stepIndex >= 0 ? `${stepIndex + 1}/${stepCount}` : '',
    stepLabel: coerceString(activeFlow?.currentStep?.label),
    canPrev: stepCount > 0 && stepIndex > 0,
    canNext: stepCount > 0 && stepIndex >= 0 && stepIndex < (stepCount - 1),
    canRestart: stepCount > 0 && stepIndex > 0,
    flowSteps,
    requestCount: Number.isFinite(requestState?.requestCount) ? Math.trunc(Number(requestState.requestCount)) : 0,
    eventCount: Number.isFinite(eventState?.eventCount) ? Math.trunc(Number(eventState.eventCount)) : 0,
    recentEvent,
  };
}

function appendInfo(root, label, value, options = {}) {
  if (!value) return;
  const actionable = options.actionable === true && typeof options.onClick === 'function';
  const row = document.createElement(actionable ? 'button' : 'div');
  row.className = 'cad-solver-flow-banner__info';
  if (actionable) {
    row.type = 'button';
    row.classList.add('is-actionable');
    row.dataset.bannerAction = coerceString(options.action || '');
    row.dataset.panelId = coerceString(options.panelId || '');
    row.dataset.focusKind = coerceString(options.focusKind || '');
    row.dataset.focusValue = coerceString(options.focusValue || '');
    row.addEventListener('click', options.onClick);
  }
  const title = document.createElement('span');
  title.className = 'cad-solver-flow-banner__info-label';
  title.textContent = label;
  const body = document.createElement('strong');
  body.className = 'cad-solver-flow-banner__info-value';
  body.textContent = String(value);
  row.appendChild(title);
  row.appendChild(body);
  root.appendChild(row);
}

export function createSolverActionFlowBanner({ onPrev, onNext, onRestart, onJump, onEventFocus, onFocusCurrent } = {}) {
  const root = document.getElementById('cad-solver-action-flow-banner');
  let state = buildBannerState();

  function runKeyboardAction(action) {
    switch (action) {
      case 'prev':
        if (state.canPrev) return onPrev?.() === true;
        return false;
      case 'next':
        if (state.canNext) return onNext?.() === true;
        return false;
      case 'restart':
        if (state.canRestart) return onRestart?.() === true;
        return false;
      case 'event-focus':
        if (state.recentEvent && typeof onEventFocus === 'function') {
          return onEventFocus(state.recentEvent) === true;
        }
        return false;
      default:
        return false;
    }
  }

  function onRootKeyDown(event) {
    if (!root) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && target !== root && (target.closest('button, input, textarea, select, [contenteditable="true"]'))) {
      return;
    }
    let action = '';
    switch (event.key) {
      case 'ArrowLeft':
        action = 'prev';
        break;
      case 'ArrowRight':
        action = 'next';
        break;
      case 'Home':
        action = 'restart';
        break;
      case 'End':
        action = 'event-focus';
        break;
      default:
        return;
    }
    const ok = runKeyboardAction(action);
    if (ok) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  if (root) {
    root.tabIndex = 0;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Solver action flow banner');
    root.addEventListener('keydown', onRootKeyDown);
  }

  function render() {
    if (!root) return state;
    root.innerHTML = '';
    root.dataset.activePanelId = state.activePanelId || '';
    root.dataset.focusKind = state.focusKind || '';
    root.dataset.focusValue = state.focusValue || '';
    root.dataset.stepIndex = String(state.stepIndex ?? -1);
    root.dataset.stepCount = String(state.stepCount ?? 0);
    root.dataset.canPrev = state.canPrev ? 'true' : 'false';
    root.dataset.canNext = state.canNext ? 'true' : 'false';
    root.dataset.canRestart = state.canRestart ? 'true' : 'false';
    root.dataset.hasRecentEvent = state.recentEvent ? 'true' : 'false';

    if (!state.activePanelId) {
      const empty = document.createElement('div');
      empty.className = 'cad-solver-flow-banner__empty';
      empty.textContent = state.recentEvent ? 'No active flow. Recent event available below.' : 'No active solver flow.';
      root.appendChild(empty);
    } else {
      const header = document.createElement('div');
      header.className = 'cad-solver-flow-banner__header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'cad-solver-flow-banner__title-wrap';
      const title = document.createElement('div');
      title.className = 'cad-solver-flow-banner__title';
      title.textContent = state.activePanelTitle || 'Solver flow';
      titleWrap.appendChild(title);
      if (state.activePanelSubtitle) {
        const subtitle = document.createElement('div');
        subtitle.className = 'cad-solver-flow-banner__subtitle';
        subtitle.textContent = state.activePanelSubtitle;
        titleWrap.appendChild(subtitle);
      }
      header.appendChild(titleWrap);

      if (state.activePanelBadgeLabel) {
        const badge = document.createElement('span');
        badge.className = `cad-solver-flow-banner__badge is-${state.activePanelSeverity || 'neutral'}`;
        badge.textContent = state.activePanelBadgeLabel;
        header.appendChild(badge);
      }
      root.appendChild(header);

      if (state.activePanelDescription) {
        const desc = document.createElement('div');
        desc.className = 'cad-solver-flow-banner__description';
        desc.textContent = state.activePanelDescription;
        root.appendChild(desc);
      }

      const info = document.createElement('div');
      info.className = 'cad-solver-flow-banner__info-grid';
      appendInfo(info, 'Focus', state.focusLabel, {
        actionable: !!(state.activePanelId && state.focusKind && state.focusValue && typeof onFocusCurrent === 'function'),
        action: 'focus-current',
        panelId: state.activePanelId,
        focusKind: state.focusKind,
        focusValue: state.focusValue,
        onClick: () => onFocusCurrent?.({
          panelId: state.activePanelId,
          focusKind: state.focusKind,
          focusValue: state.focusValue,
        }),
      });
      appendInfo(info, 'Step', state.progressLabel);
      appendInfo(info, 'Step Label', state.stepLabel);
      appendInfo(info, 'Requests', state.requestCount);
      appendInfo(info, 'Events', state.eventCount);
      root.appendChild(info);

      if (Array.isArray(state.flowSteps) && state.flowSteps.length) {
        const steps = document.createElement('div');
        steps.className = 'cad-solver-flow-banner__steps';
        const stepsLabel = document.createElement('div');
        stepsLabel.className = 'cad-solver-flow-banner__recent-label';
        stepsLabel.textContent = 'Flow Steps';
        steps.appendChild(stepsLabel);
        const stepsRow = document.createElement('div');
        stepsRow.className = 'cad-solver-flow-banner__step-row';
        for (const step of state.flowSteps) {
          const chip = document.createElement(typeof onJump === 'function' ? 'button' : 'span');
          chip.className = 'cad-solver-flow-banner__step';
          if (step.current) {
            chip.classList.add('is-active');
          }
          chip.dataset.bannerAction = 'jump';
          chip.dataset.panelId = state.activePanelId || '';
          chip.dataset.flowStepIndex = String(step.stepIndex);
          chip.textContent = `${step.stepIndex + 1}. ${step.label}`;
          if (typeof onJump === 'function') {
            chip.type = 'button';
            chip.addEventListener('click', () => onJump(state.activePanelId, step.stepIndex));
          }
          stepsRow.appendChild(chip);
        }
        steps.appendChild(stepsRow);
        root.appendChild(steps);
      }

      const controls = document.createElement('div');
      controls.className = 'cad-solver-flow-banner__controls';
      const addButton = (label, action, enabled, handler) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cad-solver-flow-banner__button';
        button.dataset.bannerAction = action;
        button.dataset.panelId = state.activePanelId || '';
        button.textContent = label;
        button.disabled = !enabled;
        if (enabled && typeof handler === 'function') {
          button.addEventListener('click', handler);
        }
        controls.appendChild(button);
      };
      addButton('Prev', 'prev', state.canPrev, () => onPrev?.());
      addButton('Next', 'next', state.canNext, () => onNext?.());
      addButton('Restart', 'restart', state.canRestart, () => onRestart?.());
      root.appendChild(controls);
    }

    if (state.recentEvent) {
      const recent = document.createElement('div');
      recent.className = 'cad-solver-flow-banner__recent';
      const label = document.createElement('div');
      label.className = 'cad-solver-flow-banner__recent-label';
      label.textContent = 'Recent Event';
      recent.appendChild(label);
      const button = document.createElement(typeof onEventFocus === 'function' ? 'button' : 'div');
      button.className = 'cad-solver-flow-banner__recent-button';
      button.dataset.bannerAction = 'event-focus';
      button.dataset.eventHistoryIndex = String(state.recentEvent.historyIndex);
      button.dataset.panelId = state.recentEvent.panelId;
      button.dataset.focusKind = state.recentEvent.focusKind || '';
      button.dataset.focusValue = state.recentEvent.focusValue || '';
      button.textContent = state.recentEvent.label || 'Focus recent event';
      if (typeof onEventFocus === 'function') {
        button.type = 'button';
        button.classList.add('is-actionable');
        button.addEventListener('click', () => onEventFocus(state.recentEvent));
      }
      recent.appendChild(button);
      root.appendChild(recent);
    }

    return state;
  }

  function setState(next) {
    state = buildBannerState(next);
    return render();
  }

  render();

  return {
    setState,
    getState() {
      return cloneJson(state);
    },
    render,
  };
}
