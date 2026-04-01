export const DESKTOP_SETTINGS_STORAGE_KEY = 'vemcad.desktop.settings.v1';

export const DESKTOP_SETTINGS_FIELDS = [
  { key: 'routerUrl', id: 'settings-router-url', kind: 'string' },
  { key: 'routerEmit', id: 'settings-router-emit', kind: 'string' },
  { key: 'routerPlugin', id: 'settings-router-plugin', kind: 'string' },
  { key: 'routerConvertCli', id: 'settings-router-convert-cli', kind: 'string' },
  { key: 'routerAuthToken', id: 'settings-router-auth-token', kind: 'string' },
  { key: 'projectId', id: 'settings-project-id', kind: 'string' },
  { key: 'documentLabelPrefix', id: 'settings-document-prefix', kind: 'string' },
  { key: 'routerAutoStart', id: 'settings-router-auto-start', kind: 'string' },
  { key: 'routerTimeoutMs', id: 'settings-router-timeout', kind: 'number' },
  { key: 'routerStartTimeoutMs', id: 'settings-router-start-timeout', kind: 'number' },
  { key: 'routerStartCmd', id: 'settings-router-start-cmd', kind: 'string' },
  { key: 'dwgRouteMode', id: 'settings-dwg-route-mode', kind: 'string' },
  { key: 'dwgPluginPath', id: 'settings-dwg-plugin', kind: 'string' },
  { key: 'dwgConvertCmd', id: 'settings-dwg-convert-cmd', kind: 'string' },
  { key: 'dwgServicePath', id: 'settings-dwg-service-path', kind: 'string' },
  { key: 'dwg2dxfBin', id: 'settings-dwg2dxf-bin', kind: 'string' },
  { key: 'dwgTimeoutMs', id: 'settings-dwg-timeout', kind: 'number' },
];

function sanitizeFieldValue(field, value) {
  if (field.kind === 'number') {
    if (value === '' || value == null) {
      return '';
    }
    const numeric = Number.parseInt(String(value).trim(), 10);
    return Number.isFinite(numeric) ? numeric : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

export function pickKnownDesktopSettings(raw = {}) {
  const picked = {};
  if (!raw || typeof raw !== 'object') {
    return picked;
  }
  for (const field of DESKTOP_SETTINGS_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(raw, field.key)) {
      continue;
    }
    picked[field.key] = sanitizeFieldValue(field, raw[field.key]);
  }
  return picked;
}

export function mergeDesktopSettings(defaults = {}, overrides = {}) {
  return {
    ...pickKnownDesktopSettings(defaults),
    ...pickKnownDesktopSettings(overrides),
  };
}

function boolLabel(value) {
  return value ? 'yes' : 'no';
}

function valueLabel(value, empty = 'n/a') {
  if (typeof value === 'string') {
    return value.trim() || empty;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return empty;
}

export function formatDesktopRouterStatus(result = {}) {
  if (!result || typeof result !== 'object') {
    return 'Router status unavailable.';
  }
  const lines = [
    result.ok
      ? (result.started ? 'Router ready and auto-started.' : 'Router ready.')
      : (result.error || 'Router not ready.'),
  ];
  if ('router_url' in result) {
    lines.push(`Router URL: ${valueLabel(result.router_url)}`);
  }
  if ('router_auto_start' in result) {
    lines.push(`Router auto start: ${valueLabel(result.router_auto_start)}`);
  }
  if ('router_start_ready' in result) {
    lines.push(`Router start ready: ${boolLabel(result.router_start_ready)}`);
  }
  if ('router_start_source' in result) {
    lines.push(`Router start source: ${valueLabel(result.router_start_source)}`);
  }
  if ('router_start_cmd' in result) {
    lines.push(`Router start cmd: ${valueLabel(result.router_start_cmd)}`);
  }
  if ('router_start_cmd_suggested' in result) {
    lines.push(`Router start suggestion: ${valueLabel(result.router_start_cmd_suggested)}`);
  }
  if ('router_plugin' in result) {
    lines.push(`Router plugin: ${valueLabel(result.router_plugin)}`);
  }
  if ('router_convert_cli' in result) {
    lines.push(`Router convert CLI: ${valueLabel(result.router_convert_cli)}`);
  }
  if ('cad_runtime_source' in result) {
    lines.push(`CAD runtime source: ${valueLabel(result.cad_runtime_source)}`);
  }
  if ('cad_runtime_root' in result) {
    lines.push(`CAD runtime root: ${valueLabel(result.cad_runtime_root)}`);
  }
  if ('cad_runtime_ready' in result) {
    lines.push(`CAD runtime ready: ${boolLabel(result.cad_runtime_ready)}`);
  }
  if ('router_service_path' in result) {
    lines.push(`Router service: ${valueLabel(result.router_service_path)}`);
  }
  if ('plm_convert_path' in result) {
    lines.push(`Preview pipeline: ${valueLabel(result.plm_convert_path)}`);
  }
  if ('viewer_root' in result) {
    lines.push(`Viewer root: ${valueLabel(result.viewer_root)}`);
  }
  const health = result.health && typeof result.health === 'object' ? result.health : null;
  if (health) {
    lines.push(`Health ok: ${boolLabel(health.ok !== false)}`);
    if ('router_mode' in health) {
      lines.push(`Router mode: ${valueLabel(health.router_mode)}`);
    }
    if ('default_plugin' in health) {
      lines.push(`Default plugin: ${valueLabel(health.default_plugin)}`);
    }
    if ('default_convert_cli' in health) {
      lines.push(`Default convert CLI: ${valueLabel(health.default_convert_cli)}`);
    }
  }
  if (result.health_error) {
    lines.push(`Health error: ${valueLabel(result.health_error)}`);
  }
  if (result.hint) {
    lines.push(`Hint: ${valueLabel(result.hint)}`);
  }
  if (!result.ok && result.error_code) {
    lines.push(`Error code: ${valueLabel(result.error_code)}`);
  }
  return lines.join('\n');
}

export function formatDesktopDwgStatus(result = {}) {
  if (!result || typeof result !== 'object') {
    return 'DWG status unavailable.';
  }
  const lines = [
    result.ok
      ? (result.message || 'DWG ready.')
      : (result.error || result.message || 'DWG not ready.'),
  ];
  if ('route' in result) {
    lines.push(`Route: ${valueLabel(result.route, 'unavailable')}`);
  }
  if ('route_mode' in result) {
    lines.push(`Route mode: ${valueLabel(result.route_mode, 'auto')}`);
  }
  if ('direct_plugin_ready' in result) {
    lines.push(`Direct plugin ready: ${boolLabel(result.direct_plugin_ready)}`);
  }
  if ('local_convert_ready' in result) {
    lines.push(`Local convert ready: ${boolLabel(result.local_convert_ready)}`);
  }
  if ('dwg_plugin_path' in result) {
    lines.push(`DWG plugin: ${valueLabel(result.dwg_plugin_path)}`);
  }
  if ('dwg_convert_cmd' in result) {
    lines.push(`DWG convert cmd: ${valueLabel(result.dwg_convert_cmd)}`);
  }
  if ('dwg2dxf_bin' in result) {
    lines.push(`dwg2dxf: ${valueLabel(result.dwg2dxf_bin)}`);
  }
  if ('dwg_service_path' in result) {
    lines.push(`DWG service: ${valueLabel(result.dwg_service_path)}`);
  }
  if ('cad_runtime_source' in result) {
    lines.push(`CAD runtime source: ${valueLabel(result.cad_runtime_source)}`);
  }
  if ('cad_runtime_root' in result) {
    lines.push(`CAD runtime root: ${valueLabel(result.cad_runtime_root)}`);
  }
  if ('cad_runtime_ready' in result) {
    lines.push(`CAD runtime ready: ${boolLabel(result.cad_runtime_ready)}`);
  }
  if ('router_service_path' in result) {
    lines.push(`Router service: ${valueLabel(result.router_service_path)}`);
  }
  if ('plm_convert_path' in result) {
    lines.push(`Preview pipeline: ${valueLabel(result.plm_convert_path)}`);
  }
  if ('viewer_root' in result) {
    lines.push(`Viewer root: ${valueLabel(result.viewer_root)}`);
  }
  if (result.hint) {
    lines.push(`Hint: ${valueLabel(result.hint)}`);
  }
  if (!result.ok && result.error_code) {
    lines.push(`Error code: ${valueLabel(result.error_code)}`);
  }
  return lines.join('\n');
}

export function formatDesktopOpenResult(result = {}) {
  if (!result || typeof result !== 'object') {
    return 'Open result unavailable.';
  }
  if (result.ok) {
    const lines = ['CAD file opened.'];
    if ('route' in result) {
      lines.push(`Route: ${valueLabel(result.route, 'unavailable')}`);
    }
    if ('route_mode' in result) {
      lines.push(`Route mode: ${valueLabel(result.route_mode, 'auto')}`);
    }
    if ('direct_plugin_ready' in result) {
      lines.push(`Direct plugin ready: ${boolLabel(result.direct_plugin_ready)}`);
    }
    if ('local_convert_ready' in result) {
      lines.push(`Local convert ready: ${boolLabel(result.local_convert_ready)}`);
    }
    if (result.document_label) {
      lines.push(`Document label: ${valueLabel(result.document_label)}`);
    }
    if (result.project_id) {
      lines.push(`Project ID: ${valueLabel(result.project_id)}`);
    }
    if ('dwg_plugin_path' in result) {
      lines.push(`DWG plugin: ${valueLabel(result.dwg_plugin_path)}`);
    }
    if ('cad_runtime_source' in result) {
      lines.push(`CAD runtime source: ${valueLabel(result.cad_runtime_source)}`);
    }
    if ('cad_runtime_root' in result) {
      lines.push(`CAD runtime root: ${valueLabel(result.cad_runtime_root)}`);
    }
    if ('cad_runtime_ready' in result) {
      lines.push(`CAD runtime ready: ${boolLabel(result.cad_runtime_ready)}`);
    }
    if (result.manifest_url) {
      lines.push(`Manifest URL: ${valueLabel(result.manifest_url)}`);
    }
    return lines.join('\n');
  }
  if (result.canceled) {
    return 'Open CAD cancelled.';
  }
  const lines = [result.error || 'Open CAD failed.'];
  if ('route' in result) {
    lines.push(`Route: ${valueLabel(result.route, 'unavailable')}`);
  }
  if ('route_mode' in result) {
    lines.push(`Route mode: ${valueLabel(result.route_mode, 'auto')}`);
  }
  if ('direct_plugin_ready' in result) {
    lines.push(`Direct plugin ready: ${boolLabel(result.direct_plugin_ready)}`);
  }
  if ('local_convert_ready' in result) {
    lines.push(`Local convert ready: ${boolLabel(result.local_convert_ready)}`);
  }
  if ('dwg_plugin_path' in result) {
    lines.push(`DWG plugin: ${valueLabel(result.dwg_plugin_path)}`);
  }
  if ('router_url' in result) {
    lines.push(`Router URL: ${valueLabel(result.router_url)}`);
  }
  if ('router_auto_start' in result) {
    lines.push(`Router auto start: ${valueLabel(result.router_auto_start)}`);
  }
  if ('router_start_ready' in result) {
    lines.push(`Router start ready: ${boolLabel(result.router_start_ready)}`);
  }
  if ('router_start_source' in result) {
    lines.push(`Router start source: ${valueLabel(result.router_start_source)}`);
  }
  if ('router_start_cmd' in result) {
    lines.push(`Router start cmd: ${valueLabel(result.router_start_cmd)}`);
  }
  if ('router_start_cmd_suggested' in result) {
    lines.push(`Router start suggestion: ${valueLabel(result.router_start_cmd_suggested)}`);
  }
  if ('router_plugin' in result) {
    lines.push(`Router plugin: ${valueLabel(result.router_plugin)}`);
  }
  if ('router_convert_cli' in result) {
    lines.push(`Router convert CLI: ${valueLabel(result.router_convert_cli)}`);
  }
  if ('cad_runtime_source' in result) {
    lines.push(`CAD runtime source: ${valueLabel(result.cad_runtime_source)}`);
  }
  if ('cad_runtime_root' in result) {
    lines.push(`CAD runtime root: ${valueLabel(result.cad_runtime_root)}`);
  }
  if ('cad_runtime_ready' in result) {
    lines.push(`CAD runtime ready: ${boolLabel(result.cad_runtime_ready)}`);
  }
  if ('router_service_path' in result) {
    lines.push(`Router service: ${valueLabel(result.router_service_path)}`);
  }
  if ('plm_convert_path' in result) {
    lines.push(`Preview pipeline: ${valueLabel(result.plm_convert_path)}`);
  }
  if ('viewer_root' in result) {
    lines.push(`Viewer root: ${valueLabel(result.viewer_root)}`);
  }
  if (result.hint) {
    lines.push(`Hint: ${valueLabel(result.hint)}`);
  }
  if (result.error_code) {
    lines.push(`Error code: ${valueLabel(result.error_code)}`);
  }
  return lines.join('\n');
}

export function formatDesktopCombinedStatus(routerResult = null, dwgResult = null) {
  const sections = [];
  if (routerResult) {
    sections.push(`[Router]\n${formatDesktopRouterStatus(routerResult)}`);
  }
  if (dwgResult) {
    sections.push(`[DWG]\n${formatDesktopDwgStatus(dwgResult)}`);
  }
  if (!sections.length) {
    return 'Desktop status unavailable.';
  }
  return sections.join('\n\n');
}

export function formatDesktopStartupStatus(routerResult = null, dwgResult = null) {
  if (routerResult?.ok && dwgResult?.ok) {
    const route = valueLabel(dwgResult.route, 'ready');
    const runtimeSource = valueLabel(
      dwgResult.cad_runtime_source || routerResult.cad_runtime_source,
      'desktop-runtime'
    );
    return `Desktop ready via ${route} from ${runtimeSource}. Open CAD File or Settings.`;
  }
  if (routerResult && !routerResult.ok) {
    return `Desktop needs router setup. Click Settings. ${valueLabel(routerResult.hint || routerResult.error, 'Check router settings.')}`;
  }
  if (dwgResult && !dwgResult.ok) {
    return `Desktop needs DWG setup. Click Settings. ${valueLabel(dwgResult.hint || dwgResult.error, 'Check DWG settings.')}`;
  }
  return 'Desktop readiness unavailable. Click Settings.';
}

export function buildDesktopDiagnosticsSnapshot({
  appInfo = null,
  defaults = {},
  currentSettings = {},
  draftSettings = {},
  storedOverrides = {},
  routerResult = null,
  dwgResult = null,
  mainStatus = '',
  settingsStatus = '',
  runtimeAssets = null,
  locationHref = '',
  generatedAt = '',
} = {}) {
  const normalizedDefaults = pickKnownDesktopSettings(defaults);
  const normalizedCurrent = pickKnownDesktopSettings(currentSettings);
  const normalizedDraft = pickKnownDesktopSettings(draftSettings);
  const normalizedStored = pickKnownDesktopSettings(storedOverrides);
  const normalizedGeneratedAt = typeof generatedAt === 'string' && generatedAt.trim()
    ? generatedAt.trim()
    : new Date().toISOString();
  return {
    schema: 'vemcad.desktop.diagnostics.v1',
    generated_at: normalizedGeneratedAt,
    app: appInfo && typeof appInfo === 'object' ? { ...appInfo } : null,
    statuses: {
      main_status: valueLabel(mainStatus, ''),
      settings_status: valueLabel(settingsStatus, ''),
    },
    settings: {
      defaults: normalizedDefaults,
      current: normalizedCurrent,
      draft: normalizedDraft,
      stored_overrides: normalizedStored,
      effective: mergeDesktopSettings(normalizedDefaults, normalizedDraft),
    },
    results: {
      router_result: routerResult && typeof routerResult === 'object' ? { ...routerResult } : null,
      dwg_result: dwgResult && typeof dwgResult === 'object' ? { ...dwgResult } : null,
    },
    runtime_assets: runtimeAssets && typeof runtimeAssets === 'object' ? { ...runtimeAssets } : null,
    page: {
      location_href: valueLabel(locationHref, ''),
    },
  };
}

export function serializeDesktopDiagnostics(snapshot = {}) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
