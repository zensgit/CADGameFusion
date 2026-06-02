// CADGameFusion web_viewer entry — DUAL-MODE shell.
//
// This file is the real browser entry (and the desktop-packaged entry: packaging copies
// tools/web_viewer/**). It does NOT itself boot the editor; it decides WHICH bootstrap to run:
//   - product (apps/web/bootstrapVemcadWebApp) when the VemCAD product layer is reachable
//     (repo-root integrated deploy) — this is what mounts the product solve workbench / I/O;
//   - legacy (legacy_app_bootstrap.js, the original standalone boot) otherwise — standalone
//     serve of deps/cadgamefusion, or the desktop package which ships only tools/web_viewer/**.
//
// The legacy fallback is load-bearing: it keeps the standalone + packaged editor booting exactly
// as before. Product selection also falls back to legacy if the product bootstrap throws mid-boot,
// so a reachable-but-broken product layer can never leave a half-booted editor.
//
// Tests import this module and drive bootstrapWebViewerEntry() with injected impls; set
// globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP before importing to suppress the auto-run.

// apps/web/app.js relative to this file (deps/cadgamefusion/tools/web_viewer/ -> repo root).
const PRODUCT_APP_URL = new URL('../../../../apps/web/app.js', import.meta.url);

// Desktop package ships only tools/web_viewer/** (no apps/web sibling) — never probe/fetch there.
export function isDesktopRuntime() {
  return !!(globalThis.window && globalThis.window.vemcadDesktop);
}

export function getProductBootstrapFallbackReason() {
  return isDesktopRuntime() ? 'desktop-runtime-product-bootstrap-disabled' : null;
}

// Is the product layer reachable from here? false (no fetch) under the desktop runtime; otherwise
// probe apps/web/app.js. Any failure (404 above the served root, file://, network) => not reachable.
export async function canLoadProductBootstrap() {
  if (isDesktopRuntime()) return false;
  try {
    const response = await fetch(PRODUCT_APP_URL, { method: 'GET', cache: 'no-store' });
    return !!response && response.ok;
  } catch {
    return false;
  }
}

async function defaultBootstrapProductWebApp() {
  const productModule = await import(PRODUCT_APP_URL.href);
  return productModule.bootstrapVemcadWebApp();
}

async function defaultBootstrapLegacyWebViewerApp() {
  const legacyModule = await import('./legacy_app_bootstrap.js');
  return legacyModule.bootstrapLegacyWebViewerApp();
}

function recordBootstrapSource(source, fallbackReason) {
  if (!globalThis.window) return;
  globalThis.window.__vemcadBootstrap = fallbackReason ? { source, fallbackReason } : { source };
}

// Decide product-vs-legacy and run it. Collaborators are injectable for tests; the defaults wire
// the real product probe / product bootstrap / legacy bootstrap.
export async function bootstrapWebViewerEntry({
  canLoadProductBootstrapImpl = canLoadProductBootstrap,
  bootstrapProductWebAppImpl = defaultBootstrapProductWebApp,
  bootstrapLegacyWebViewerAppImpl = defaultBootstrapLegacyWebViewerApp,
} = {}) {
  let productReachable = false;
  try {
    productReachable = await canLoadProductBootstrapImpl();
  } catch {
    productReachable = false;
  }

  if (productReachable) {
    try {
      const result = await bootstrapProductWebAppImpl();
      recordBootstrapSource('product');
      return result;
    } catch (error) {
      // Product layer was reachable but failed mid-boot — fall back to legacy so the editor
      // still boots rather than leaving a half-initialized page.
      console.error('product bootstrap failed; falling back to legacy', error);
      const result = await bootstrapLegacyWebViewerAppImpl();
      recordBootstrapSource('legacy-fallback', 'product-bootstrap-error');
      return result;
    }
  }

  const result = await bootstrapLegacyWebViewerAppImpl();
  recordBootstrapSource('legacy-fallback', getProductBootstrapFallbackReason() ?? 'product-bootstrap-unreachable');
  return result;
}

if (!globalThis.__VEMCAD_SKIP_AUTO_BOOTSTRAP) {
  bootstrapWebViewerEntry().catch((error) => {
    console.error('web_viewer bootstrap failed', error);
  });
}
