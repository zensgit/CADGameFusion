import test from 'node:test';
import assert from 'node:assert/strict';

// app.js self-bootstraps at import time unless this flag is set first. Set it BEFORE the dynamic
// import so loading the module under test does not kick off a real (DOM-touching) bootstrap.
globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP = true;
const { bootstrapWebViewerEntry } = await import('../app.js');

// Regression guard for the load-bearing fallback: a product layer that is *reachable* (the fetch
// probe returns ok) but throws mid-boot (import/eval/runtime) must still fall back to legacy rather
// than leaving a half-initialized "Bootstrap failed" page. Mirrors origin/main's
// product-bootstrap-error path.
test('bootstrapWebViewerEntry falls back to legacy when the product layer is reachable but throws mid-boot', async () => {
  const prevWindow = globalThis.window;
  globalThis.window = {};
  let legacyCalls = 0;
  try {
    const result = await bootstrapWebViewerEntry({
      canLoadProductBootstrapImpl: async () => true,
      bootstrapProductWebAppImpl: async () => {
        throw new Error('product boom mid-boot');
      },
      bootstrapLegacyWebViewerAppImpl: async () => {
        legacyCalls += 1;
        return 'legacy-booted';
      },
    });
    assert.equal(legacyCalls, 1, 'legacy bootstrap must run when product throws mid-boot');
    assert.equal(result, 'legacy-booted', 'entry must return the legacy bootstrap result');
    assert.equal(globalThis.window.__vemcadBootstrap.source, 'legacy-fallback');
    assert.equal(globalThis.window.__vemcadBootstrap.fallbackReason, 'product-bootstrap-error');
  } finally {
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
  }
});

test('bootstrapWebViewerEntry runs the product app and does not touch legacy when product boots cleanly', async () => {
  let legacyCalls = 0;
  const result = await bootstrapWebViewerEntry({
    canLoadProductBootstrapImpl: async () => true,
    bootstrapProductWebAppImpl: async () => 'product-booted',
    bootstrapLegacyWebViewerAppImpl: async () => {
      legacyCalls += 1;
      return 'legacy-booted';
    },
  });
  assert.equal(result, 'product-booted');
  assert.equal(legacyCalls, 0, 'legacy must not run when product boots cleanly');
});

test('bootstrapWebViewerEntry falls back to legacy when the product layer is unreachable', async () => {
  let legacyCalls = 0;
  let productCalls = 0;
  const result = await bootstrapWebViewerEntry({
    canLoadProductBootstrapImpl: async () => false,
    bootstrapProductWebAppImpl: async () => {
      productCalls += 1;
      return 'product-booted';
    },
    bootstrapLegacyWebViewerAppImpl: async () => {
      legacyCalls += 1;
      return 'legacy-booted';
    },
  });
  assert.equal(productCalls, 0, 'product bootstrap must not run when unreachable');
  assert.equal(legacyCalls, 1);
  assert.equal(result, 'legacy-booted');
});
