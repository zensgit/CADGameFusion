function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function coerceString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function coerceNumber(value, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function coerceStringList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => coerceString(value))
    .filter((value) => value.length > 0);
}

function coerceNumberList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.trunc(Number(value)));
}

function normalizeStepValue(value) {
  if (typeof value === 'string') return value.trim();
  if (Number.isFinite(value)) return Math.trunc(Number(value));
  return String(value ?? '').trim();
}

function stepLabel(kind, value, { anchor = false } = {}) {
  const normalized = normalizeStepValue(value);
  switch (kind) {
    case 'constraint':
      return anchor ? `Anchor constraint ${normalized}` : `Constraint ${normalized}`;
    case 'basis-constraint':
      return `Basis constraint ${normalized}`;
    case 'redundant-constraint':
      return `Redundant constraint ${normalized}`;
    case 'variable':
      return `Variable ${normalized}`;
    case 'free-variable':
      return `Free variable ${normalized}`;
    default:
      return `${kind}: ${normalized}`;
  }
}

export function buildActionFlowSteps(panel) {
  if (!panel || typeof panel !== 'object') return [];
  const steps = [];
  const seenKeys = new Set();
  const coveredConstraintValues = new Set();
  const pushStep = (kind, value, options = {}) => {
    const normalized = normalizeStepValue(value);
    if (normalized === '') return;
    const key = `${kind}:${normalized}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    if (kind === 'constraint' || kind === 'basis-constraint' || kind === 'redundant-constraint') {
      coveredConstraintValues.add(String(normalized));
    }
    steps.push({
      kind,
      value: normalized,
      label: stepLabel(kind, normalized, options),
    });
  };

  if (Number.isFinite(panel.anchorConstraintIndex) && panel.anchorConstraintIndex >= 0) {
    pushStep('constraint', panel.anchorConstraintIndex, { anchor: true });
  }
  for (const value of panel.variableKeys || []) {
    pushStep('variable', value);
  }
  for (const value of panel.freeVariableKeys || []) {
    pushStep('free-variable', value);
  }
  for (const value of panel.basisConstraintIndices || []) {
    pushStep('basis-constraint', value);
  }
  for (const value of panel.redundantConstraintIndices || []) {
    pushStep('redundant-constraint', value);
  }
  for (const value of panel.constraintIndices || []) {
    const normalized = normalizeStepValue(value);
    if (coveredConstraintValues.has(String(normalized))) continue;
    pushStep('constraint', normalized);
  }
  return steps;
}

function classifyRequestKind(context = {}) {
  const flowAction = coerceString(context?.flowAction);
  const focusKind = coerceString(context?.focusKind);
  if (flowAction === 'replay') {
    return 'replay';
  }
  if (flowAction === 'start') {
    return 'invoke';
  }
  if (flowAction === 'focus') {
    return 'focus';
  }
  if (flowAction) {
    return 'flow';
  }
  if (focusKind) {
    return 'focus';
  }
  return 'invoke';
}

function buildRequestTarget(focusKind, focusValue) {
  const kind = coerceString(focusKind);
  const normalized = normalizeStepValue(focusValue);
  if (!kind) {
    return {
      kind: '',
      constraintIndex: null,
      variableKey: '',
      value: '',
    };
  }
  if (kind === 'constraint' || kind === 'basis-constraint' || kind === 'redundant-constraint') {
    return {
      kind,
      constraintIndex: Number.isFinite(Number(normalized)) ? Math.trunc(Number(normalized)) : null,
      variableKey: '',
      value: String(normalized),
    };
  }
  return {
    kind,
    constraintIndex: null,
    variableKey: String(normalized),
    value: String(normalized),
  };
}

export function buildSolverActionRequest(panel, context = {}, invocationCount = 0) {
  if (!panel || typeof panel !== 'object') return null;
  const requestKind = classifyRequestKind(context);
  const flowAction = coerceString(context?.flowAction);
  const focusKind = coerceString(context?.focusKind);
  const focusValue = normalizeStepValue(context?.focusValue ?? '');
  return {
    requestKind,
    panelId: coerceString(panel.id),
    category: coerceString(panel.category),
    scope: coerceString(panel.scope),
    tag: coerceString(panel.tag),
    invocationCount: coerceNumber(invocationCount, 0),
    label: coerceString(panel.label),
    hint: coerceString(panel.hint),
    summary: coerceString(panel.summary),
    selectionExplanation: coerceString(panel.selectionExplanation),
    anchorConstraintIndex: Number.isFinite(panel.anchorConstraintIndex) && panel.anchorConstraintIndex >= 0
      ? Math.trunc(Number(panel.anchorConstraintIndex))
      : null,
    priorityScore: coerceNumber(panel.priorityScore, 0),
    focusKind,
    focusValue: String(focusValue),
    flowAction,
    flowStepIndex: Number.isFinite(context?.flowStepIndex) ? Math.trunc(Number(context.flowStepIndex)) : -1,
    flowStepCount: Number.isFinite(context?.flowStepCount) ? Math.trunc(Number(context.flowStepCount)) : 0,
    target: buildRequestTarget(focusKind, focusValue),
    ui: {
      title: coerceString(panel.ui?.title),
      subtitle: coerceString(panel.ui?.subtitle),
      description: coerceString(panel.ui?.description),
      badgeLabel: coerceString(panel.ui?.badgeLabel),
      severity: coerceString(panel.ui?.severity),
      ctaLabel: coerceString(panel.ui?.ctaLabel),
      recommended: panel.ui?.recommended === true,
      displayOrder: coerceNumber(panel.ui?.displayOrder, 99),
    },
  };
}

function normalizePanelUi(ui, panel) {
  const title = coerceString(ui?.title) || coerceString(panel?.label) || coerceString(panel?.id);
  const subtitle = coerceString(ui?.subtitle) || coerceString(panel?.summary);
  const description = coerceString(ui?.description) || coerceString(panel?.hint);
  const badgeLabel = coerceString(ui?.badge_label) || (coerceString(panel?.category) === 'redundancy' ? 'Redundancy' : 'Conflict');
  const severity = coerceString(ui?.severity) || 'neutral';
  const ctaLabel = coerceString(ui?.cta_label) || title;
  return {
    title,
    subtitle,
    description,
    badgeLabel,
    severity,
    ctaLabel,
    recommended: ui?.recommended === true,
    displayOrder: coerceNumber(ui?.display_order, 99),
  };
}

export function extractSolverActionPanels(payload) {
  const sections = [
    { source: 'analysis', payload: payload?.analysis },
    { source: 'structural_summary', payload: payload?.structural_summary },
    { source: 'root', payload },
  ];

  for (const section of sections) {
    const rawPanels = section?.payload?.action_panels;
    if (!Array.isArray(rawPanels)) continue;
    const panels = rawPanels.map((panel, index) => {
      const normalized = {
        id: coerceString(panel?.id) || `panel-${index + 1}`,
        category: coerceString(panel?.category),
        scope: coerceString(panel?.scope),
        enabled: panel?.enabled === true,
        label: coerceString(panel?.label),
        hint: coerceString(panel?.hint),
        tag: coerceString(panel?.tag),
        summary: coerceString(panel?.summary),
        selectionExplanation: coerceString(panel?.selection_explanation),
        anchorConstraintIndex: Number.isFinite(panel?.anchor_constraint_index)
          ? Math.trunc(Number(panel.anchor_constraint_index))
          : -1,
        priorityScore: coerceNumber(panel?.priority_score, 0),
        constraintIndices: coerceNumberList(panel?.constraint_indices),
        basisConstraintIndices: coerceNumberList(panel?.basis_constraint_indices),
        redundantConstraintIndices: coerceNumberList(panel?.redundant_constraint_indices),
        variableKeys: coerceStringList(panel?.variable_keys),
        freeVariableKeys: coerceStringList(panel?.free_variable_keys),
        selectionPolicy: coerceStringList(panel?.selection_policy),
      };
      normalized.ui = normalizePanelUi(panel?.ui, normalized);
      return normalized;
    }).sort((a, b) => {
      const order = a.ui.displayOrder - b.ui.displayOrder;
      if (order !== 0) return order;
      return a.id.localeCompare(b.id);
    });
    return {
      source: section.source,
      actionPanelCount: Number.isFinite(section.payload?.action_panel_count)
        ? Math.trunc(Number(section.payload.action_panel_count))
        : panels.length,
      panels,
    };
  }

  return {
    source: 'none',
    actionPanelCount: 0,
    panels: [],
  };
}

function renderMetaRow(container, label, value) {
  if (!value) return;
  const row = document.createElement('div');
  row.className = 'cad-solver-panel__meta';
  row.textContent = `${label}: ${value}`;
  container.appendChild(row);
}

function renderChipList(container, label, values, { panel, kind = '', activeFocus = null, onChipClick } = {}) {
  if (!Array.isArray(values) || values.length === 0) return;
  const row = document.createElement('div');
  row.className = 'cad-solver-panel__chips';
  const heading = document.createElement('div');
  heading.className = 'cad-solver-panel__chip-label';
  heading.textContent = label;
  row.appendChild(heading);
  for (const value of values) {
    const isInteractive = typeof onChipClick === 'function' && panel && kind;
    const chip = document.createElement(isInteractive ? 'button' : 'span');
    chip.className = 'cad-solver-panel__chip';
    if (isInteractive) {
      chip.type = 'button';
      chip.dataset.panelId = panel.id;
      chip.dataset.focusKind = kind;
      chip.dataset.focusValue = String(value);
      chip.classList.add('is-actionable');
      if (activeFocus?.panelId === panel.id && activeFocus?.kind === kind && String(activeFocus?.value) === String(value)) {
        chip.classList.add('is-active');
      }
      chip.addEventListener('click', () => onChipClick(panel, kind, value));
    }
    chip.textContent = String(value);
    row.appendChild(chip);
  }
  container.appendChild(row);
}

function renderFocusSummary(root, activeFocus, activePanel) {
  if (!activeFocus || !activePanel) return;
  const summary = document.createElement('div');
  summary.className = 'cad-solver-panel__focus';
  summary.dataset.panelId = activePanel.id;
  summary.dataset.focusKind = activeFocus.kind || '';
  summary.dataset.focusValue = String(activeFocus.value ?? '');

  const title = document.createElement('div');
  title.className = 'cad-solver-panel__focus-title';
  title.textContent = activePanel.ui?.ctaLabel || activePanel.label || activePanel.id;
  summary.appendChild(title);

  const body = document.createElement('div');
  body.className = 'cad-solver-panel__focus-body';
  body.textContent = `Focused ${activeFocus.kind}: ${activeFocus.value}`;
  summary.appendChild(body);

  root.appendChild(summary);
}

function buildActionState(panel, invocationCount = 0) {
  if (!panel || typeof panel !== 'object') {
    return {
      activePanelId: '',
      lastInvokedPanelId: '',
      invocationCount,
      activePanel: null,
      lastInvokedPanel: null,
      availablePanelIds: [],
      activeFocus: null,
      activeFlow: null,
    };
  }
  return {
    activePanelId: panel.id || '',
    lastInvokedPanelId: panel.id || '',
    invocationCount,
    activePanel: cloneJson(panel),
    lastInvokedPanel: cloneJson(panel),
    availablePanelIds: [],
    activeFocus: null,
    activeFlow: null,
  };
}

function renderFlowSummary(root, activeFlow, activePanel) {
  if (!activeFlow || !activePanel || !Array.isArray(activeFlow.steps) || !activeFlow.steps.length) return;
  const summary = document.createElement('div');
  summary.className = 'cad-solver-panel__flow';
  summary.dataset.panelId = activePanel.id;
  summary.dataset.stepIndex = String(activeFlow.stepIndex ?? -1);
  summary.dataset.stepCount = String(activeFlow.stepCount ?? activeFlow.steps.length);

  const title = document.createElement('div');
  title.className = 'cad-solver-panel__flow-title';
  title.textContent = `Action flow (${Math.max(0, (activeFlow.stepIndex ?? -1) + 1)}/${activeFlow.stepCount || activeFlow.steps.length})`;
  summary.appendChild(title);

  const body = document.createElement('div');
  body.className = 'cad-solver-panel__flow-body';
  body.textContent = activeFlow.currentStep?.label || 'No active step';
  summary.appendChild(body);

  root.appendChild(summary);
}

function renderFlowSteps(container, panel, activeFlow, { onJump } = {}) {
  if (!activeFlow || !Array.isArray(activeFlow.steps) || !activeFlow.steps.length) return;
  const row = document.createElement('div');
  row.className = 'cad-solver-panel__chips cad-solver-panel__flow-steps';
  const heading = document.createElement('div');
  heading.className = 'cad-solver-panel__chip-label';
  heading.textContent = 'Flow Steps';
  row.appendChild(heading);
  for (const step of activeFlow.steps) {
    const index = Number.isFinite(step?.stepIndex) ? Math.trunc(Number(step.stepIndex)) : -1;
    const current = index >= 0 && index === (activeFlow.stepIndex ?? -1);
    const chip = document.createElement(typeof onJump === 'function' ? 'button' : 'span');
    chip.className = 'cad-solver-panel__chip';
    if (typeof onJump === 'function') {
      chip.type = 'button';
      chip.classList.add('is-actionable');
      chip.dataset.panelId = panel.id;
      chip.dataset.flowAction = 'jump';
      chip.dataset.flowStepIndex = String(index);
      chip.addEventListener('click', () => onJump(panel, index));
    }
    if (current) {
      chip.classList.add('is-active');
    }
    chip.textContent = `${Math.max(0, index + 1)}. ${step.label}`;
    row.appendChild(chip);
  }
  container.appendChild(row);
}

function renderFlowControls(container, panel, activeFlow, { onPrev, onNext, onRestart, onJump } = {}) {
  if (!activeFlow || !Array.isArray(activeFlow.steps) || !activeFlow.steps.length) return;
  renderFlowSteps(container, panel, activeFlow, { onJump });
  const controls = document.createElement('div');
  controls.className = 'cad-solver-panel__flow-controls';

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'cad-solver-panel__flow-button';
  prev.dataset.panelId = panel.id;
  prev.dataset.flowAction = 'prev';
  prev.textContent = 'Prev';
  prev.disabled = (activeFlow.stepIndex ?? 0) <= 0;
  if (typeof onPrev === 'function') {
    prev.addEventListener('click', () => onPrev(panel));
  }
  controls.appendChild(prev);

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cad-solver-panel__flow-button';
  next.dataset.panelId = panel.id;
  next.dataset.flowAction = 'next';
  next.textContent = 'Next';
  next.disabled = (activeFlow.stepIndex ?? -1) >= ((activeFlow.stepCount || activeFlow.steps.length) - 1);
  if (typeof onNext === 'function') {
    next.addEventListener('click', () => onNext(panel));
  }
  controls.appendChild(next);

  const restart = document.createElement('button');
  restart.type = 'button';
  restart.className = 'cad-solver-panel__flow-button';
  restart.dataset.panelId = panel.id;
  restart.dataset.flowAction = 'restart';
  restart.textContent = 'Restart';
  restart.disabled = (activeFlow.stepIndex ?? 0) <= 0;
  if (typeof onRestart === 'function') {
    restart.addEventListener('click', () => onRestart(panel));
  }
  controls.appendChild(restart);

  container.appendChild(controls);
}

function renderPanel(root, panel, {
  active = false,
  activeFocus = null,
  activeFlow = null,
  onInvoke,
  onChipFocus,
  onFlowPrev,
  onFlowNext,
  onFlowRestart,
  onFlowJump,
  onCardKeydown,
} = {}) {
  const card = document.createElement('article');
  card.className = 'cad-solver-panel';
  if (!panel.enabled) {
    card.classList.add('is-disabled');
  }
  if (active) {
    card.classList.add('is-active');
  }
  card.dataset.panelId = panel.id;
  card.dataset.panelTag = panel.tag || '';
  card.dataset.panelSeverity = panel.ui.severity || 'neutral';
  card.dataset.panelCard = 'true';
  card.tabIndex = panel.enabled === true ? 0 : -1;
  card.setAttribute('aria-disabled', panel.enabled === true ? 'false' : 'true');
  card.setAttribute('aria-pressed', active ? 'true' : 'false');
  if (typeof onCardKeydown === 'function') {
    card.addEventListener('keydown', (event) => onCardKeydown(panel, event));
  }

  const header = document.createElement('div');
  header.className = 'cad-solver-panel__header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'cad-solver-panel__title-wrap';

  const title = document.createElement('div');
  title.className = 'cad-solver-panel__title';
  title.textContent = panel.ui.title || panel.label || panel.id;
  titleWrap.appendChild(title);

  if (panel.ui.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'cad-solver-panel__subtitle';
    subtitle.textContent = panel.ui.subtitle;
    titleWrap.appendChild(subtitle);
  }

  const badge = document.createElement('span');
  badge.className = `cad-solver-panel__badge is-${panel.ui.severity || 'neutral'}`;
  badge.textContent = panel.ui.badgeLabel || 'Diagnostic';

  header.appendChild(titleWrap);
  header.appendChild(badge);
  card.appendChild(header);

  if (panel.ui.description) {
    const description = document.createElement('div');
    description.className = 'cad-solver-panel__description';
    description.textContent = panel.ui.description;
    card.appendChild(description);
  }

  renderMetaRow(card, 'Action', panel.ui.ctaLabel);
  renderMetaRow(card, 'Tag', panel.tag);
  renderMetaRow(card, 'Selection', panel.selectionExplanation);
  if (panel.anchorConstraintIndex >= 0) {
    renderMetaRow(card, 'Anchor', String(panel.anchorConstraintIndex));
  }
  if (panel.priorityScore > 0) {
    renderMetaRow(card, 'Priority', String(panel.priorityScore));
  }

  renderChipList(card, 'Constraints', panel.constraintIndices, {
    panel,
    kind: 'constraint',
    activeFocus,
    onChipClick: onChipFocus,
  });
  renderChipList(card, 'Basis', panel.basisConstraintIndices, {
    panel,
    kind: 'basis-constraint',
    activeFocus,
    onChipClick: onChipFocus,
  });
  renderChipList(card, 'Redundant', panel.redundantConstraintIndices, {
    panel,
    kind: 'redundant-constraint',
    activeFocus,
    onChipClick: onChipFocus,
  });
  renderChipList(card, 'Variables', panel.variableKeys, {
    panel,
    kind: 'variable',
    activeFocus,
    onChipClick: onChipFocus,
  });
  renderChipList(card, 'Free Variables', panel.freeVariableKeys, {
    panel,
    kind: 'free-variable',
    activeFocus,
    onChipClick: onChipFocus,
  });

  const actions = document.createElement('div');
  actions.className = 'cad-solver-panel__actions';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cad-solver-panel__cta';
  if (active) {
    button.classList.add('is-active');
  }
  button.disabled = panel.enabled !== true;
  button.dataset.panelId = panel.id;
  button.textContent = panel.ui.ctaLabel || panel.label || panel.id;
  if (typeof onInvoke === 'function') {
    button.addEventListener('click', () => onInvoke(panel));
  }
  actions.appendChild(button);
  card.appendChild(actions);

  if (active) {
    renderFlowControls(card, panel, activeFlow, {
      onPrev: onFlowPrev,
      onNext: onFlowNext,
      onRestart: onFlowRestart,
      onJump: onFlowJump,
    });
  }

  root.appendChild(card);
}

export function createSolverActionPanel({ getDiagnostics, onAction } = {}) {
  const root = document.getElementById('cad-solver-actions');
  if (!root) {
    return {
      render() {},
      setDiagnostics() {},
      getDiagnostics() { return null; },
      getNormalized() { return extractSolverActionPanels(null); },
      getState() { return buildActionState(null, 0); },
      getRequestState() {
        return {
          requestCount: 0,
          invokeRequestCount: 0,
          focusRequestCount: 0,
          flowRequestCount: 0,
          replayRequestCount: 0,
          lastRequest: null,
          history: [],
        };
      },
      getEventState() {
        return {
          eventCount: 0,
          invokeEventCount: 0,
          focusEventCount: 0,
          flowEventCount: 0,
          replayEventCount: 0,
          lastEvent: null,
          history: [],
        };
      },
      invoke() { return false; },
      invokeFocus() { return false; },
      advanceFlow() { return false; },
      rewindFlow() { return false; },
      restartFlow() { return false; },
      replayRequestHistoryIndex() { return false; },
      clearActiveAction() { return buildActionState(null, 0); },
      clearActiveFocus() { return buildActionState(null, 0); },
      clearRequestHistory() {
        return {
          requestCount: 0,
          invokeRequestCount: 0,
          focusRequestCount: 0,
          flowRequestCount: 0,
          replayRequestCount: 0,
          lastRequest: null,
          history: [],
        };
      },
      clearEventHistory() {
        return {
          eventCount: 0,
          invokeEventCount: 0,
          focusEventCount: 0,
          flowEventCount: 0,
          replayEventCount: 0,
          lastEvent: null,
          history: [],
        };
      },
    };
  }

  let payload = null;
  let activePanelId = '';
  let lastInvokedPanel = null;
  let invocationCount = 0;
  let activeFocus = null;
  let activeFlow = null;
  let requestHistory = [];
  let eventHistory = [];
  let pendingPanelCardFocusId = '';

  function resolvePayload() {
    if (typeof getDiagnostics === 'function') {
      return getDiagnostics() ?? payload;
    }
    return payload;
  }

  function getNormalized() {
    return extractSolverActionPanels(resolvePayload());
  }

  function getCurrentPanel(panelId) {
    const normalized = getNormalized();
    return normalized.panels.find((panel) => panel.id === panelId) || null;
  }

  function buildFlow(panel, stepIndex = 0) {
    const steps = buildActionFlowSteps(panel);
    if (!steps.length) return null;
    steps.forEach((step, index) => {
      step.stepIndex = index;
    });
    const boundedIndex = Math.min(Math.max(0, stepIndex), steps.length - 1);
    return {
      panelId: panel.id,
      stepIndex: boundedIndex,
      stepCount: steps.length,
      steps,
      currentStep: cloneJson(steps[boundedIndex]),
    };
  }

  function setFocusFromFlow(flow) {
    if (!flow || !flow.currentStep) {
      activeFocus = null;
      return;
    }
    activeFocus = {
      panelId: flow.panelId,
      kind: flow.currentStep.kind,
      value: String(flow.currentStep.value),
    };
  }

  function getRequestState() {
    const history = requestHistory.map((request) => cloneJson(request)).filter(Boolean);
    const invokeRequestCount = history.filter((request) => request.requestKind === 'invoke').length;
    const focusRequestCount = history.filter((request) => request.requestKind === 'focus').length;
    const flowRequestCount = history.filter((request) => request.requestKind === 'flow').length;
    const replayRequestCount = history.filter((request) => request.requestKind === 'replay').length;
    return {
      requestCount: history.length,
      invokeRequestCount,
      focusRequestCount,
      flowRequestCount,
      replayRequestCount,
      lastRequest: history.length > 0 ? history[history.length - 1] : null,
      history,
    };
  }

  function clearRequestHistory() {
    requestHistory = [];
    root.dataset.requestCount = '0';
    return getRequestState();
  }

  function getEventState() {
    const history = eventHistory.map((event) => cloneJson(event)).filter(Boolean);
    const invokeEventCount = history.filter((event) => event.eventKind === 'invoke').length;
    const focusEventCount = history.filter((event) => event.eventKind === 'focus').length;
    const flowEventCount = history.filter((event) => event.eventKind === 'flow').length;
    const replayEventCount = history.filter((event) => event.eventKind === 'replay').length;
    return {
      eventCount: history.length,
      invokeEventCount,
      focusEventCount,
      flowEventCount,
      replayEventCount,
      lastEvent: history.length > 0 ? history[history.length - 1] : null,
      history,
    };
  }

  function clearEventHistory() {
    eventHistory = [];
    root.dataset.eventCount = '0';
    return getEventState();
  }

  function recordEvent(eventKind, detail = {}) {
    const event = {
      historyIndex: eventHistory.length,
      eventKind: coerceString(eventKind),
      panelId: coerceString(detail?.panelId),
      flowAction: coerceString(detail?.flowAction),
      focusKind: coerceString(detail?.focusKind),
      focusValue: String(normalizeStepValue(detail?.focusValue ?? '')),
      requestHistoryIndex: Number.isFinite(detail?.requestHistoryIndex)
        ? Math.trunc(Number(detail.requestHistoryIndex))
        : -1,
      replayHistoryIndex: Number.isFinite(detail?.replayHistoryIndex)
        ? Math.trunc(Number(detail.replayHistoryIndex))
        : -1,
      invocationCount: Number.isFinite(detail?.invocationCount)
        ? Math.trunc(Number(detail.invocationCount))
        : 0,
    };
    eventHistory.push(event);
    if (eventHistory.length > 64) {
      eventHistory = eventHistory.slice(eventHistory.length - 64);
    }
    root.dataset.eventCount = String(eventHistory.length);
    return event;
  }

  function dispatchSolverActionDomEvent(type, detail = {}) {
    const payload = cloneJson(detail);
    root.dispatchEvent(new CustomEvent(type, {
      detail: payload,
    }));
    if (typeof window !== 'undefined' && window && window !== root) {
      window.dispatchEvent(new CustomEvent(type, {
        detail: cloneJson(payload),
      }));
    }
  }

  function emitAction(panel, context = {}) {
    const request = buildSolverActionRequest(panel, context, invocationCount);
    if (request) {
      request.historyIndex = requestHistory.length;
      requestHistory.push(request);
      if (requestHistory.length > 64) {
        requestHistory = requestHistory.slice(requestHistory.length - 64);
      }
      dispatchSolverActionDomEvent('cad:solver-action-request', request);
    }
    if (typeof onAction === 'function') {
      onAction(cloneJson(panel), {
        invocationCount,
        normalized: getNormalized(),
        request: request ? cloneJson(request) : null,
        requestState: getRequestState(),
        eventState: getEventState(),
        ...context,
      });
    }
  }

  function replayRequestHistoryIndex(index) {
    const historyIndex = Math.trunc(Number(index));
    if (!Number.isFinite(historyIndex) || historyIndex < 0 || historyIndex >= requestHistory.length) {
      return false;
    }
    const sourceRequest = requestHistory[historyIndex];
    if (!sourceRequest || typeof sourceRequest !== 'object') {
      return false;
    }
    const panel = getCurrentPanel(sourceRequest.panelId);
    if (!panel || panel.enabled !== true) {
      return false;
    }

    activePanelId = panel.id;
    lastInvokedPanel = cloneJson(panel);
    invocationCount += 1;

    const replayFocusKind = coerceString(sourceRequest.focusKind || sourceRequest?.target?.kind);
    const replayFocusValue = String(normalizeStepValue(sourceRequest.focusValue || sourceRequest?.target?.value || ''));
    const replayStepIndex = Number.isFinite(sourceRequest.flowStepIndex)
      ? Math.trunc(Number(sourceRequest.flowStepIndex))
      : 0;
    activeFlow = buildFlow(panel, replayStepIndex);
    if (activeFlow && replayFocusKind && replayFocusValue) {
      const matchedIndex = activeFlow.steps.findIndex(
        (step) => step.kind === replayFocusKind && String(step.value) === replayFocusValue
      );
      if (matchedIndex >= 0) {
        activeFlow = buildFlow(panel, matchedIndex);
      }
    }
    if (replayFocusKind && replayFocusValue) {
      activeFocus = {
        panelId: panel.id,
        kind: replayFocusKind,
        value: replayFocusValue,
      };
      if (activeFlow?.currentStep && activeFlow.currentStep.kind === replayFocusKind && String(activeFlow.currentStep.value) === replayFocusValue) {
        activeFocus = {
          panelId: panel.id,
          kind: activeFlow.currentStep.kind,
          value: String(activeFlow.currentStep.value),
        };
      }
    } else {
      setFocusFromFlow(activeFlow);
    }

    dispatchSolverActionDomEvent('cad:solver-action-replay', {
      panelId: panel.id,
      panel: cloneJson(panel),
      sourceRequest: cloneJson(sourceRequest),
      sourceHistoryIndex: historyIndex,
      invocationCount,
    });
    recordEvent('replay', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'replay',
      replayHistoryIndex: historyIndex,
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow?.stepIndex ?? -1,
      flowStepCount: activeFlow?.stepCount ?? 0,
      flowAction: 'replay',
      replayHistoryIndex: historyIndex,
      replayRequestKind: coerceString(sourceRequest.requestKind),
    });
    render();
    return true;
  }

  function getState() {
    const normalized = getNormalized();
    const activePanel = normalized.panels.find((panel) => panel.id === activePanelId) || null;
    return {
      activePanelId,
      lastInvokedPanelId: lastInvokedPanel?.id || '',
      invocationCount,
      activePanel: activePanel ? cloneJson(activePanel) : null,
      lastInvokedPanel: lastInvokedPanel ? cloneJson(lastInvokedPanel) : null,
      availablePanelIds: normalized.panels.map((panel) => panel.id),
      activeFocus: activeFocus ? cloneJson(activeFocus) : null,
      activeFlow: activeFlow ? cloneJson(activeFlow) : null,
    };
  }

  function clearActiveAction() {
    activePanelId = '';
    lastInvokedPanel = null;
    activeFocus = null;
    activeFlow = null;
    return render();
  }

  function clearActiveFocus() {
    activeFocus = null;
    return render();
  }

  function rememberPanelCardFocus(panelId) {
    pendingPanelCardFocusId = coerceString(panelId);
  }

  function restorePanelCardFocus(preferredPanelId = '') {
    const panelId = coerceString(preferredPanelId) || coerceString(pendingPanelCardFocusId);
    pendingPanelCardFocusId = '';
    if (!panelId) return;
    const card = root.querySelector(`.cad-solver-panel[data-panel-card="true"][data-panel-id="${panelId}"]`);
    if (card instanceof HTMLElement) {
      card.focus();
    }
  }

  function focusPanelCard(panelId = '') {
    const preferredPanelId = coerceString(panelId);
    if (!preferredPanelId) return false;
    rememberPanelCardFocus(preferredPanelId);
    restorePanelCardFocus(preferredPanelId);
    return document.activeElement instanceof HTMLElement &&
      document.activeElement.matches?.(`.cad-solver-panel[data-panel-card="true"][data-panel-id="${preferredPanelId}"]`) === true;
  }

  function handlePanelCardKeydown(panel, event) {
    if (!panel || panel.enabled !== true || !event) {
      return;
    }
    const key = coerceString(event.key);
    let handled = false;

    if (key === 'Enter' || key === ' ') {
      rememberPanelCardFocus(panel.id);
      handled = invoke(panel.id);
    } else if (panel.id === activePanelId) {
      if (key === 'ArrowRight') {
        rememberPanelCardFocus(panel.id);
        handled = advanceFlow();
      } else if (key === 'ArrowLeft') {
        rememberPanelCardFocus(panel.id);
        handled = rewindFlow();
      } else if (key === 'Home') {
        rememberPanelCardFocus(panel.id);
        handled = restartFlow();
      } else if (key === 'End' && activeFlow && activeFlow.panelId === panel.id && Number.isFinite(activeFlow.stepCount) && activeFlow.stepCount > 0) {
        rememberPanelCardFocus(panel.id);
        handled = jumpFlow(activeFlow.stepCount - 1);
      }
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function invoke(panelId) {
    const panel = getCurrentPanel(panelId);
    if (!panel || panel.enabled !== true) {
      return false;
    }
    activePanelId = panel.id;
    lastInvokedPanel = cloneJson(panel);
    invocationCount += 1;
    activeFlow = buildFlow(panel, 0);
    setFocusFromFlow(activeFlow);
    dispatchSolverActionDomEvent('cad:solver-action', {
      panelId: panel.id,
      panel: cloneJson(panel),
      invocationCount,
    });
    recordEvent('invoke', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'start',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow?.stepIndex ?? -1,
      flowStepCount: activeFlow?.stepCount ?? 0,
      flowAction: 'start',
    });
    render();
    return true;
  }

  function invokeFocus(panelId, kind, value) {
    const panel = getCurrentPanel(panelId);
    const focusKind = coerceString(kind);
    const focusValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    if (!panel || panel.enabled !== true || !focusKind || !focusValue) {
      return false;
    }
    activePanelId = panel.id;
    lastInvokedPanel = cloneJson(panel);
    const nextFlow = buildFlow(panel, 0);
    const matchedIndex = nextFlow?.steps?.findIndex((step) => step.kind === focusKind && String(step.value) === focusValue) ?? -1;
    activeFlow = nextFlow ? buildFlow(panel, matchedIndex >= 0 ? matchedIndex : nextFlow.stepIndex) : null;
    activeFocus = {
      panelId: panel.id,
      kind: focusKind,
      value: focusValue,
    };
    if (activeFlow && activeFlow.currentStep && activeFlow.currentStep.kind === focusKind && String(activeFlow.currentStep.value) === focusValue) {
      activeFocus = {
        panelId: panel.id,
        kind: activeFlow.currentStep.kind,
        value: String(activeFlow.currentStep.value),
      };
    }
    dispatchSolverActionDomEvent('cad:solver-action-focus', {
      panelId: panel.id,
      panel: cloneJson(panel),
      focusKind,
      focusValue,
      invocationCount,
    });
    recordEvent('focus', {
      panelId: panel.id,
      focusKind,
      focusValue,
      flowAction: 'focus',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind,
      focusValue,
      flowStepIndex: activeFlow?.stepIndex ?? -1,
      flowStepCount: activeFlow?.stepCount ?? 0,
      flowAction: 'focus',
    });
    render();
    return true;
  }

  function advanceFlow() {
    const panel = getCurrentPanel(activePanelId);
    if (!panel || !activeFlow || activeFlow.panelId !== panel.id) {
      return false;
    }
    if ((activeFlow.stepIndex ?? -1) >= ((activeFlow.stepCount || activeFlow.steps.length) - 1)) {
      return false;
    }
    activeFlow = buildFlow(panel, (activeFlow.stepIndex ?? -1) + 1);
    setFocusFromFlow(activeFlow);
    dispatchSolverActionDomEvent('cad:solver-action-flow-step', {
      panelId: panel.id,
      panel: cloneJson(panel),
      flowAction: 'next',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
    });
    recordEvent('flow', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'next',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      flowAction: 'next',
    });
    render();
    return true;
  }

  function rewindFlow() {
    const panel = getCurrentPanel(activePanelId);
    if (!panel || !activeFlow || activeFlow.panelId !== panel.id) {
      return false;
    }
    if ((activeFlow.stepIndex ?? 0) <= 0) {
      return false;
    }
    activeFlow = buildFlow(panel, (activeFlow.stepIndex ?? 0) - 1);
    setFocusFromFlow(activeFlow);
    dispatchSolverActionDomEvent('cad:solver-action-flow-step', {
      panelId: panel.id,
      panel: cloneJson(panel),
      flowAction: 'prev',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
    });
    recordEvent('flow', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'prev',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      flowAction: 'prev',
    });
    render();
    return true;
  }

  function restartFlow() {
    const panel = getCurrentPanel(activePanelId);
    if (!panel) {
      return false;
    }
    const nextFlow = buildFlow(panel, 0);
    if (!nextFlow) {
      activeFlow = null;
      activeFocus = null;
      render();
      return false;
    }
    activeFlow = nextFlow;
    setFocusFromFlow(activeFlow);
    dispatchSolverActionDomEvent('cad:solver-action-flow-step', {
      panelId: panel.id,
      panel: cloneJson(panel),
      flowAction: 'restart',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
    });
    recordEvent('flow', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'restart',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      flowAction: 'restart',
    });
    render();
    return true;
  }

  function jumpFlow(stepIndex) {
    const panel = getCurrentPanel(activePanelId);
    if (!panel || !activeFlow || activeFlow.panelId !== panel.id) {
      return false;
    }
    const nextIndex = Math.trunc(Number(stepIndex));
    if (!Number.isFinite(nextIndex) || nextIndex < 0 || nextIndex >= (activeFlow.stepCount || activeFlow.steps.length)) {
      return false;
    }
    if (nextIndex === (activeFlow.stepIndex ?? -1)) {
      return false;
    }
    activeFlow = buildFlow(panel, nextIndex);
    setFocusFromFlow(activeFlow);
    dispatchSolverActionDomEvent('cad:solver-action-flow-step', {
      panelId: panel.id,
      panel: cloneJson(panel),
      flowAction: 'jump',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
    });
    recordEvent('flow', {
      panelId: panel.id,
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowAction: 'jump',
      requestHistoryIndex: requestHistory.length,
      invocationCount,
    });
    emitAction(panel, {
      focusKind: activeFocus?.kind || '',
      focusValue: activeFocus?.value || '',
      flowStepIndex: activeFlow.stepIndex,
      flowStepCount: activeFlow.stepCount,
      flowAction: 'jump',
    });
    render();
    return true;
  }

  function render() {
    const activeElement = document.activeElement;
    const preservedPanelId = root.contains(activeElement)
      ? coerceString(activeElement?.closest?.('.cad-solver-panel[data-panel-card="true"]')?.dataset?.panelId)
      : '';
    root.innerHTML = '';
    const normalized = getNormalized();
    const requestState = getRequestState();
    root.dataset.panelCount = String(normalized.actionPanelCount);
    root.dataset.panelSource = normalized.source;
    root.dataset.requestCount = String(requestState.requestCount || 0);
    root.dataset.eventCount = String(getEventState().eventCount || 0);
    root.dataset.activePanelId = activePanelId || '';
    if (activePanelId && !normalized.panels.some((panel) => panel.id === activePanelId)) {
      activePanelId = '';
    }
    if (!normalized.panels.length) {
      const empty = document.createElement('div');
      empty.className = 'cad-solver-panel__empty';
      if (normalized.actionPanelCount > 0) {
        empty.textContent = `${normalized.actionPanelCount} diagnostic slots available; no active solver actions.`;
      } else {
        empty.textContent = 'No solver diagnostics loaded.';
      }
      root.appendChild(empty);
      return normalized;
    }

    const activePanel = normalized.panels.find((panel) => panel.id === activePanelId) || null;
    renderFlowSummary(root, activeFlow, activePanel);
    renderFocusSummary(root, activeFocus, activePanel);

    for (const panel of normalized.panels) {
      renderPanel(root, panel, {
        active: panel.id === activePanelId,
        activeFocus,
        activeFlow: activeFlow && activeFlow.panelId === panel.id ? activeFlow : null,
        onInvoke: (targetPanel) => invoke(targetPanel.id),
        onChipFocus: (targetPanel, kind, value) => invokeFocus(targetPanel.id, kind, value),
        onFlowPrev: () => rewindFlow(),
        onFlowNext: () => advanceFlow(),
        onFlowRestart: () => restartFlow(),
        onFlowJump: (_targetPanel, stepIndex) => jumpFlow(stepIndex),
        onCardKeydown: handlePanelCardKeydown,
      });
    }
    restorePanelCardFocus(preservedPanelId);
    return normalized;
  }

  function setDiagnostics(nextPayload) {
    payload = isObject(nextPayload) ? cloneJson(nextPayload) : null;
    if (activePanelId && !getCurrentPanel(activePanelId)) {
      activePanelId = '';
    }
    if (lastInvokedPanel && !getCurrentPanel(lastInvokedPanel.id)) {
      lastInvokedPanel = null;
    }
    if (activeFocus && !getCurrentPanel(activeFocus.panelId)) {
      activeFocus = null;
    }
    if (activeFlow && !getCurrentPanel(activeFlow.panelId)) {
      activeFlow = null;
    }
    return render();
  }

  render();

  return {
    render,
    setDiagnostics,
    getDiagnostics: () => cloneJson(resolvePayload()),
    getNormalized,
    getState,
    getRequestState,
    getEventState,
    invoke,
    invokeFocus,
    advanceFlow,
    rewindFlow,
    restartFlow,
    jumpFlow,
    replayRequestHistoryIndex,
    focusPanelCard,
    clearActiveAction,
    clearActiveFocus,
    clearRequestHistory,
    clearEventHistory,
  };
}
