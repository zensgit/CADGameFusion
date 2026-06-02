import test from 'node:test';
import assert from 'node:assert/strict';

// Contract tests for the dual-mode web_viewer entry shell, ported INTO the submodule so
// CADGameFusion CI verifies the shell directly (the mirror in VemCAD apps/web is skipped until
// the pointer bump). Each test sets __VEMCAD_SKIP_AUTO_BOOTSTRAP before a fresh dynamic import so
// the module does not auto-boot, then drives bootstrapWebViewerEntry() with injected impls.
const ENTRY_URL = new URL('../app.js', import.meta.url).href;

function installDomStubs({ search = '' } = {}) {
  const elements = new Map();
  function makeElement(id) {
    const classes = new Set();
    const attrs = new Map();
    return {
      id,
      classList: {
        add: (n) => classes.add(n),
        remove: (n) => classes.delete(n),
        toggle: (n, f) => { if (f === undefined) { classes.has(n) ? classes.delete(n) : classes.add(n); } else if (f) classes.add(n); else classes.delete(n); },
        contains: (n) => classes.has(n),
      },
      setAttribute: (n, v) => attrs.set(n, String(v)),
      removeAttribute: (n) => attrs.delete(n),
      getAttribute: (n) => attrs.get(n) ?? null,
      textContent: '',
    };
  }
  const documentStub = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id); },
  };
  globalThis.window = { location: { search } };
  globalThis.document = documentStub;
  return { elements, documentStub };
}
function cleanupDomStubs() { delete globalThis.window; delete globalThis.document; }

test('bootstrapWebViewerEntry prefers product bootstrap when reachable', async () => {
  installDomStubs();
  globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP = true;
  try {
    const m = await import(`${ENTRY_URL}?prefer-product`);
    let productCalls = 0; let legacyCalls = 0;
    const result = await m.bootstrapWebViewerEntry({
      canLoadProductBootstrapImpl: async () => true,
      bootstrapProductWebAppImpl: async () => { productCalls += 1; return { mode: 'product' }; },
      bootstrapLegacyWebViewerAppImpl: async () => { legacyCalls += 1; return { mode: 'legacy' }; },
    });
    assert.deepEqual(result, { mode: 'product' });
    assert.equal(productCalls, 1);
    assert.equal(legacyCalls, 0);
    assert.equal(globalThis.window.__vemcadBootstrap.source, 'product');
  } finally {
    delete globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP;
    cleanupDomStubs();
  }
});

test('bootstrapWebViewerEntry falls back to legacy when product is unreachable', async () => {
  installDomStubs();
  globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP = true;
  try {
    const m = await import(`${ENTRY_URL}?legacy-unreachable`);
    let legacyCalls = 0;
    const result = await m.bootstrapWebViewerEntry({
      canLoadProductBootstrapImpl: async () => false,
      bootstrapProductWebAppImpl: async () => { throw new Error('product bootstrap should not run'); },
      bootstrapLegacyWebViewerAppImpl: async () => { legacyCalls += 1; return { mode: 'legacy' }; },
    });
    assert.deepEqual(result, { mode: 'legacy' });
    assert.equal(legacyCalls, 1);
    assert.equal(globalThis.window.__vemcadBootstrap.source, 'legacy-fallback');
    assert.equal(globalThis.window.__vemcadBootstrap.fallbackReason, 'product-bootstrap-unreachable');
  } finally {
    delete globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP;
    cleanupDomStubs();
  }
});

test('desktop runtime disables product probing and boots legacy', async () => {
  installDomStubs();
  globalThis.window.vemcadDesktop = {};
  globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP = true;
  globalThis.fetch = async () => { throw new Error('desktop product probe should not fetch'); };
  try {
    const m = await import(`${ENTRY_URL}?desktop-skip`);
    assert.equal(m.isDesktopRuntime(), true);
    assert.equal(m.getProductBootstrapFallbackReason(), 'desktop-runtime-product-bootstrap-disabled');
    assert.equal(await m.canLoadProductBootstrap(), false);
    let legacyCalls = 0;
    const result = await m.bootstrapWebViewerEntry({
      bootstrapProductWebAppImpl: async () => { throw new Error('desktop product bootstrap should not run'); },
      bootstrapLegacyWebViewerAppImpl: async () => { legacyCalls += 1; return { mode: 'legacy' }; },
    });
    assert.deepEqual(result, { mode: 'legacy' });
    assert.equal(legacyCalls, 1);
    assert.equal(globalThis.window.__vemcadBootstrap.fallbackReason, 'desktop-runtime-product-bootstrap-disabled');
  } finally {
    delete globalThis.fetch;
    delete globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP;
    cleanupDomStubs();
  }
});

test('product selected but throws mid-boot falls back to legacy (no half-booted editor)', async () => {
  installDomStubs();
  globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP = true;
  try {
    const m = await import(`${ENTRY_URL}?product-throws`);
    let legacyCalls = 0;
    const result = await m.bootstrapWebViewerEntry({
      canLoadProductBootstrapImpl: async () => true,
      bootstrapProductWebAppImpl: async () => { throw new Error('boom mid-boot'); },
      bootstrapLegacyWebViewerAppImpl: async () => { legacyCalls += 1; return { mode: 'legacy' }; },
    });
    assert.deepEqual(result, { mode: 'legacy' });
    assert.equal(legacyCalls, 1);
    assert.equal(globalThis.window.__vemcadBootstrap.source, 'legacy-fallback');
    assert.equal(globalThis.window.__vemcadBootstrap.fallbackReason, 'product-bootstrap-error');
  } finally {
    delete globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP;
    cleanupDomStubs();
  }
});

const LEGACY_URL = new URL('../legacy_app_bootstrap.js', import.meta.url).href;

test('bootstrapLegacyWebViewerApp boots preview by default and wires the editor handoff bridge', async () => {
  installDomStubs({ search: '' });
  try {
    const m = await import(`${LEGACY_URL}?preview-test`);
    let previewLoads = 0;
    let workspaceImports = 0;
    const workspace = { importPayload() { workspaceImports += 1; } };
    const result = await m.bootstrapLegacyWebViewerApp({
      params: new URLSearchParams(''),
      loadPreviewModule: async () => { previewLoads += 1; return {}; },
      loadWorkspaceModule: async () => ({ bootstrapCadWorkspace() { return workspace; } }),
    });
    assert.deepEqual(result, { mode: 'preview' });
    assert.equal(previewLoads, 1);
    assert.equal(typeof globalThis.window.__vemcadApp.switchToEditor, 'function');
    await globalThis.window.__vemcadApp.switchToEditor({ entities: [] });
    assert.equal(workspaceImports, 1);
  } finally {
    cleanupDomStubs();
  }
});

test('bootstrapLegacyWebViewerApp boots the workspace directly in editor mode', async () => {
  installDomStubs({ search: '?mode=editor' });
  try {
    const m = await import(`${LEGACY_URL}?editor-test`);
    let workspaceBootstraps = 0;
    const result = await m.bootstrapLegacyWebViewerApp({
      params: new URLSearchParams('mode=editor'),
      loadPreviewModule: async () => { throw new Error('preview should not load in editor mode'); },
      loadWorkspaceModule: async () => { workspaceBootstraps += 1; return { bootstrapCadWorkspace() { return { importPayload() {} }; } }; },
    });
    assert.deepEqual(result, { mode: 'editor' });
    assert.equal(workspaceBootstraps, 1);
  } finally {
    cleanupDomStubs();
  }
});
