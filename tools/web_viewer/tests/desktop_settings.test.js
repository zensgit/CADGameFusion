import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDesktopDiagnosticsSnapshot,
  formatDesktopCombinedStatus,
  formatDesktopDwgStatus,
  formatDesktopOpenResult,
  formatDesktopRouterStatus,
  formatDesktopStartupStatus,
  mergeDesktopSettings,
  pickKnownDesktopSettings,
  serializeDesktopDiagnostics,
} from '../desktop_settings.js';

test('mergeDesktopSettings preserves explicit empty overrides and numeric values', () => {
  const merged = mergeDesktopSettings(
    {
      routerUrl: 'http://127.0.0.1:9000',
      routerPlugin: '/tmp/plugin.dylib',
      routerTimeoutMs: 60000,
      dwgRouteMode: 'auto',
      dwgPluginPath: '/tmp/dwg.dylib',
    },
    {
      routerPlugin: '',
      routerTimeoutMs: '45000',
      dwgRouteMode: 'local-convert',
      dwgPluginPath: '',
    }
  );

  assert.equal(merged.routerUrl, 'http://127.0.0.1:9000');
  assert.equal(merged.routerPlugin, '');
  assert.equal(merged.routerTimeoutMs, 45000);
  assert.equal(merged.dwgRouteMode, 'local-convert');
  assert.equal(merged.dwgPluginPath, '');
});

test('pickKnownDesktopSettings ignores unknown keys and normalizes numbers', () => {
  const picked = pickKnownDesktopSettings({
    projectId: ' demo ',
    routerStartTimeoutMs: '15000',
    bogus: 'ignored',
  });

  assert.deepEqual(picked, {
    projectId: 'demo',
    routerStartTimeoutMs: 15000,
  });
});

test('formatDesktopDwgStatus exposes route and readiness facts', () => {
  const text = formatDesktopDwgStatus({
    ok: true,
    message: 'DWG ready via direct plugin.',
    route: 'direct-plugin',
    route_mode: 'auto',
    direct_plugin_ready: true,
    local_convert_ready: false,
    dwg_plugin_path: '/tmp/libcadgf_dwg_importer_plugin.dylib',
    dwg_convert_cmd: '',
    dwg2dxf_bin: '/opt/homebrew/bin/dwg2dxf',
    dwg_service_path: '/tmp/cad_resources/dwg_service/cadgf_dwg_service.py',
    cad_runtime_source: 'packaged-cad-resources',
    cad_runtime_root: '/tmp/cad_resources',
    cad_runtime_ready: true,
    router_service_path: '/tmp/cad_resources/router/plm_router_service.py',
    plm_convert_path: '/tmp/cad_resources/tools/plm_convert.py',
    viewer_root: '/tmp/cad_resources/tools/web_viewer',
  });

  assert.match(text, /DWG ready via direct plugin\./);
  assert.match(text, /Route: direct-plugin/);
  assert.match(text, /Route mode: auto/);
  assert.match(text, /Direct plugin ready: yes/);
  assert.match(text, /Local convert ready: no/);
  assert.match(text, /DWG plugin: \/tmp\/libcadgf_dwg_importer_plugin\.dylib/);
  assert.match(text, /dwg2dxf: \/opt\/homebrew\/bin\/dwg2dxf/);
  assert.match(text, /DWG service: \/tmp\/cad_resources\/dwg_service\/cadgf_dwg_service\.py/);
  assert.match(text, /CAD runtime source: packaged-cad-resources/);
  assert.match(text, /CAD runtime root: \/tmp\/cad_resources/);
  assert.match(text, /CAD runtime ready: yes/);
  assert.match(text, /Router service: \/tmp\/cad_resources\/router\/plm_router_service\.py/);
  assert.match(text, /Preview pipeline: \/tmp\/cad_resources\/tools\/plm_convert\.py/);
  assert.match(text, /Viewer root: \/tmp\/cad_resources\/tools\/web_viewer/);
});

test('formatDesktopDwgStatus surfaces actionable hint on not-ready failures', () => {
  const text = formatDesktopDwgStatus({
    ok: false,
    error: 'DWG open path not configured. Provide a DWG plugin path or a DWG converter command.',
    error_code: 'DWG_NOT_READY',
    route: '',
    route_mode: 'local-convert',
    direct_plugin_ready: false,
    local_convert_ready: false,
    dwg_plugin_path: '',
    dwg_convert_cmd: '',
    dwg2dxf_bin: '/opt/homebrew/bin/dwg2dxf',
    hint: 'Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.',
  });

  assert.match(text, /DWG open path not configured/);
  assert.match(text, /Route: unavailable/);
  assert.match(text, /Route mode: local-convert/);
  assert.match(text, /Hint: Set DWG Plugin Path for direct import/);
  assert.match(text, /Error code: DWG_NOT_READY/);
});

test('formatDesktopRouterStatus surfaces health summary and recovery hints', () => {
  const okText = formatDesktopRouterStatus({
    ok: true,
    started: true,
    router_url: 'http://127.0.0.1:9000',
    router_auto_start: 'on',
    router_start_ready: true,
    router_start_source: 'configured',
    router_start_cmd: 'python3 tools/plm_router_service.py --port 9000',
    router_plugin: '/tmp/plugin.dylib',
    router_convert_cli: '/tmp/convert_cli',
    cad_runtime_source: 'packaged-cad-resources',
    cad_runtime_root: '/tmp/cad_resources',
    cad_runtime_ready: true,
    router_service_path: '/tmp/cad_resources/router/plm_router_service.py',
    plm_convert_path: '/tmp/cad_resources/tools/plm_convert.py',
    viewer_root: '/tmp/cad_resources/tools/web_viewer',
    health: {
      ok: true,
      router_mode: 'dev',
      default_plugin: '/tmp/plugin.dylib',
      default_convert_cli: '/tmp/convert_cli',
    },
  });
  assert.match(okText, /Router ready and auto-started\./);
  assert.match(okText, /Router URL: http:\/\/127\.0\.0\.1:9000/);
  assert.match(okText, /Router auto start: on/);
  assert.match(okText, /Router start ready: yes/);
  assert.match(okText, /Router start source: configured/);
  assert.match(okText, /Router start cmd: python3 tools\/plm_router_service\.py --port 9000/);
  assert.match(okText, /Router plugin: \/tmp\/plugin\.dylib/);
  assert.match(okText, /Router convert CLI: \/tmp\/convert_cli/);
  assert.match(okText, /CAD runtime source: packaged-cad-resources/);
  assert.match(okText, /CAD runtime root: \/tmp\/cad_resources/);
  assert.match(okText, /CAD runtime ready: yes/);
  assert.match(okText, /Router service: \/tmp\/cad_resources\/router\/plm_router_service\.py/);
  assert.match(okText, /Preview pipeline: \/tmp\/cad_resources\/tools\/plm_convert\.py/);
  assert.match(okText, /Viewer root: \/tmp\/cad_resources\/tools\/web_viewer/);
  assert.match(okText, /Router mode: dev/);
  assert.match(okText, /Default plugin: \/tmp\/plugin\.dylib/);

  const failText = formatDesktopRouterStatus({
    ok: false,
    error: 'Router not reachable.',
    error_code: 'ROUTER_NOT_AVAILABLE',
    router_url: 'http://127.0.0.1:9000',
    router_auto_start: 'off',
    router_start_ready: false,
    router_start_source: '',
    router_start_cmd: '',
    router_start_cmd_suggested: 'python3 tools/plm_router_service.py --port 9000',
    router_plugin: '/tmp/plugin.dylib',
    router_convert_cli: '/tmp/convert_cli',
    hint: 'Router Auto Start is Off. Start the router manually, or switch Router Auto Start back to Default/On in Settings.',
  });
  assert.match(failText, /Router not reachable\./);
  assert.match(failText, /Router auto start: off/);
  assert.match(failText, /Router start ready: no/);
  assert.match(failText, /Router start suggestion: python3 tools\/plm_router_service\.py --port 9000/);
  assert.match(failText, /Hint: Router Auto Start is Off\./);
  assert.match(failText, /Error code: ROUTER_NOT_AVAILABLE/);
});

test('formatDesktopOpenResult summarizes success and cancellation', () => {
  const okText = formatDesktopOpenResult({
    ok: true,
    route: 'direct-plugin',
    route_mode: 'auto',
    direct_plugin_ready: true,
    local_convert_ready: true,
    document_label: 'sample_part',
    project_id: 'dwg-desktop-smoke',
    dwg_plugin_path: '/tmp/libcadgf_dwg_importer_plugin.dylib',
    cad_runtime_source: 'packaged-cad-resources',
    cad_runtime_root: '/tmp/cad_resources',
    cad_runtime_ready: true,
    manifest_url: 'http://127.0.0.1:9000/view/sample/manifest.json',
  });
  assert.match(okText, /CAD file opened\./);
  assert.match(okText, /Route: direct-plugin/);
  assert.match(okText, /Route mode: auto/);
  assert.match(okText, /Direct plugin ready: yes/);
  assert.match(okText, /Local convert ready: yes/);
  assert.match(okText, /Document label: sample_part/);
  assert.match(okText, /Project ID: dwg-desktop-smoke/);
  assert.match(okText, /DWG plugin: \/tmp\/libcadgf_dwg_importer_plugin\.dylib/);
  assert.match(okText, /CAD runtime source: packaged-cad-resources/);
  assert.match(okText, /CAD runtime root: \/tmp\/cad_resources/);
  assert.match(okText, /CAD runtime ready: yes/);

  const failText = formatDesktopOpenResult({
    ok: false,
    error: 'Router convert failed.',
    error_code: 'HTTP_500',
    route: 'direct-plugin',
    route_mode: 'direct-plugin',
    direct_plugin_ready: true,
    local_convert_ready: false,
    dwg_plugin_path: '/tmp/libcadgf_dwg_importer_plugin.dylib',
  });
  assert.match(failText, /Router convert failed\./);
  assert.match(failText, /Route: direct-plugin/);
  assert.match(failText, /Route mode: direct-plugin/);
  assert.match(failText, /Direct plugin ready: yes/);
  assert.match(failText, /Local convert ready: no/);
  assert.match(failText, /DWG plugin: \/tmp\/libcadgf_dwg_importer_plugin\.dylib/);
  assert.match(failText, /Error code: HTTP_500/);

  const hintedFailText = formatDesktopOpenResult({
    ok: false,
    error: 'Router URL not configured.',
    error_code: 'ROUTER_NOT_CONFIGURED',
    router_url: '',
    router_auto_start: 'on',
    router_start_ready: true,
    router_start_source: 'configured',
    router_start_cmd: 'python3 tools/plm_router_service.py --port 9000',
    router_plugin: '/tmp/plugin.dylib',
    router_convert_cli: '/tmp/convert_cli',
    cad_runtime_source: 'packaged-cad-resources',
    cad_runtime_root: '/tmp/cad_resources',
    cad_runtime_ready: true,
    router_service_path: '/tmp/cad_resources/router/plm_router_service.py',
    plm_convert_path: '/tmp/cad_resources/tools/plm_convert.py',
    viewer_root: '/tmp/cad_resources/tools/web_viewer',
    hint: 'Set Router URL in Settings before opening CAD files.',
  });
  assert.match(hintedFailText, /Router URL: n\/a/);
  assert.match(hintedFailText, /Router auto start: on/);
  assert.match(hintedFailText, /Router start ready: yes/);
  assert.match(hintedFailText, /Router start cmd: python3 tools\/plm_router_service\.py --port 9000/);
  assert.match(hintedFailText, /Router plugin: \/tmp\/plugin\.dylib/);
  assert.match(hintedFailText, /Router convert CLI: \/tmp\/convert_cli/);
  assert.match(hintedFailText, /CAD runtime source: packaged-cad-resources/);
  assert.match(hintedFailText, /CAD runtime root: \/tmp\/cad_resources/);
  assert.match(hintedFailText, /CAD runtime ready: yes/);
  assert.match(hintedFailText, /Router service: \/tmp\/cad_resources\/router\/plm_router_service\.py/);
  assert.match(hintedFailText, /Preview pipeline: \/tmp\/cad_resources\/tools\/plm_convert\.py/);
  assert.match(hintedFailText, /Viewer root: \/tmp\/cad_resources\/tools\/web_viewer/);
  assert.match(hintedFailText, /Hint: Set Router URL in Settings before opening CAD files\./);
  assert.match(hintedFailText, /Error code: ROUTER_NOT_CONFIGURED/);

  const cancelledText = formatDesktopOpenResult({ ok: false, canceled: true });
  assert.equal(cancelledText, 'Open CAD cancelled.');
});

test('formatDesktopCombinedStatus combines router and DWG readiness sections', () => {
  const text = formatDesktopCombinedStatus(
    {
      ok: true,
      started: false,
      router_url: 'http://127.0.0.1:9000',
      router_auto_start: 'on',
      router_start_ready: true,
      router_start_source: 'auto-detected',
      router_start_cmd: 'python3 /tmp/cad_resources/router/plm_router_service.py --port 9000',
      router_plugin: '/tmp/plugin.dylib',
      router_convert_cli: '/tmp/convert_cli',
      cad_runtime_source: 'packaged-cad-resources',
      cad_runtime_root: '/tmp/cad_resources',
      cad_runtime_ready: true,
      router_service_path: '/tmp/cad_resources/router/plm_router_service.py',
      plm_convert_path: '/tmp/cad_resources/tools/plm_convert.py',
      viewer_root: '/tmp/cad_resources/tools/web_viewer',
    },
    {
      ok: true,
      message: 'DWG ready via direct plugin.',
      route: 'direct-plugin',
      route_mode: 'auto',
      direct_plugin_ready: true,
      local_convert_ready: true,
      dwg_plugin_path: '/tmp/dwg.dylib',
      dwg_convert_cmd: 'python3 /tmp/dwg_service.py convert',
      dwg2dxf_bin: '/opt/homebrew/bin/dwg2dxf',
      dwg_service_path: '/tmp/cad_resources/dwg_service/cadgf_dwg_service.py',
      cad_runtime_source: 'packaged-cad-resources',
      cad_runtime_root: '/tmp/cad_resources',
      cad_runtime_ready: true,
      router_service_path: '/tmp/cad_resources/router/plm_router_service.py',
      plm_convert_path: '/tmp/cad_resources/tools/plm_convert.py',
      viewer_root: '/tmp/cad_resources/tools/web_viewer',
    }
  );

  assert.match(text, /\[Router\]/);
  assert.match(text, /\[DWG\]/);
  assert.match(text, /CAD runtime source: packaged-cad-resources/);
  assert.match(text, /DWG ready via direct plugin\./);
});

test('formatDesktopStartupStatus summarizes ready and setup-needed states', () => {
  const readyText = formatDesktopStartupStatus(
    {
      ok: true,
      cad_runtime_source: 'packaged-cad-resources',
    },
    {
      ok: true,
      route: 'direct-plugin',
      cad_runtime_source: 'packaged-cad-resources',
    }
  );
  assert.equal(
    readyText,
    'Desktop ready via direct-plugin from packaged-cad-resources. Open CAD File or Settings.'
  );

  const routerSetupText = formatDesktopStartupStatus(
    {
      ok: false,
      hint: 'Set Router URL in Settings before opening CAD files.',
    },
    null
  );
  assert.equal(
    routerSetupText,
    'Desktop needs router setup. Click Settings. Set Router URL in Settings before opening CAD files.'
  );

  const dwgSetupText = formatDesktopStartupStatus(
    { ok: true },
    {
      ok: false,
      hint: 'Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.',
    }
  );
  assert.equal(
    dwgSetupText,
    'Desktop needs DWG setup. Click Settings. Set DWG Plugin Path for direct import, or set DWG Convert Command for local conversion in Settings.'
  );
});

test('buildDesktopDiagnosticsSnapshot normalizes settings and preserves results', () => {
  const snapshot = buildDesktopDiagnosticsSnapshot({
    appInfo: {
      app_name: 'VemCAD',
      app_version: '0.1.0',
      is_packaged: true,
    },
    defaults: {
      routerUrl: 'http://127.0.0.1:9000',
      dwgRouteMode: 'auto',
    },
    currentSettings: {
      routerUrl: 'http://127.0.0.1:9000',
      dwgRouteMode: 'auto',
    },
    draftSettings: {
      routerUrl: 'http://127.0.0.1:9011',
      dwgRouteMode: 'direct-plugin',
      bogus: 'ignored',
    },
    storedOverrides: {
      routerUrl: 'http://127.0.0.1:9011',
    },
    routerResult: {
      ok: true,
      router_url: 'http://127.0.0.1:9011',
    },
    dwgResult: {
      ok: true,
      route: 'direct-plugin',
    },
    mainStatus: 'Desktop ready.',
    settingsStatus: '[Router]\nRouter ready.',
    runtimeAssets: {
      source: 'vendor/three@0.160.0',
    },
    locationHref: 'file:///Applications/VemCAD.app',
    generatedAt: '2026-03-26T09:55:00.000Z',
  });

  assert.equal(snapshot.schema, 'vemcad.desktop.diagnostics.v1');
  assert.equal(snapshot.generated_at, '2026-03-26T09:55:00.000Z');
  assert.equal(snapshot.app.app_name, 'VemCAD');
  assert.equal(snapshot.statuses.main_status, 'Desktop ready.');
  assert.equal(snapshot.settings.defaults.routerUrl, 'http://127.0.0.1:9000');
  assert.equal(snapshot.settings.draft.routerUrl, 'http://127.0.0.1:9011');
  assert.equal(snapshot.settings.effective.routerUrl, 'http://127.0.0.1:9011');
  assert.equal(snapshot.settings.effective.dwgRouteMode, 'direct-plugin');
  assert.equal(snapshot.results.router_result.router_url, 'http://127.0.0.1:9011');
  assert.equal(snapshot.results.dwg_result.route, 'direct-plugin');
  assert.equal(snapshot.runtime_assets.source, 'vendor/three@0.160.0');
  assert.equal(snapshot.page.location_href, 'file:///Applications/VemCAD.app');

  const serialized = serializeDesktopDiagnostics(snapshot);
  assert.match(serialized, /"schema": "vemcad\.desktop\.diagnostics\.v1"/);
  assert.match(serialized, /"route": "direct-plugin"/);
});
