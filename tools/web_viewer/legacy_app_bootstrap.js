// Legacy CADGameFusion web_viewer bootstrap — the original standalone / desktop-packaged boot
// path, extracted verbatim so app.js can become a dual-mode shell (product-or-legacy) without
// changing this behavior. Used when the apps/web product layer is NOT reachable (standalone serve
// of deps/cadgamefusion, or the desktop package which only ships tools/web_viewer/**).
//
// Behavior preserved exactly: editor/preview mode switch, lazy workspace bootstrap, and the
// window.__vemcadApp.switchToEditor bridge (used by preview_app.js for the DXF/DWG handoff).
export async function bootstrapLegacyWebViewerApp({
  params = new URLSearchParams(globalThis.window?.location?.search ?? ''),
  loadWorkspaceModule = () => import('./ui/workspace.js'),
  loadPreviewModule = () => import('./preview_app.js'),
} = {}) {
  const mode = (params.get('mode') || '').trim().toLowerCase();
  const previewRoot = document.getElementById('preview-root');
  const editorRoot = document.getElementById('cad-editor-root');

  function setPreviewMode() {
    if (previewRoot) {
      previewRoot.classList.remove('is-hidden');
      previewRoot.removeAttribute('aria-hidden');
    }
    if (editorRoot) {
      editorRoot.classList.add('is-hidden');
      editorRoot.setAttribute('aria-hidden', 'true');
    }
  }

  function setEditorMode() {
    if (previewRoot) {
      previewRoot.classList.add('is-hidden');
      previewRoot.setAttribute('aria-hidden', 'true');
    }
    if (editorRoot) {
      editorRoot.classList.remove('is-hidden');
      editorRoot.removeAttribute('aria-hidden');
    }
  }

  // Workspace bootstrap state — lazily initialized when switching to editor mode.
  let workspaceInstance = null;
  let workspaceBootstrapPromise = null;

  async function ensureWorkspaceBootstrapped() {
    if (workspaceInstance) return workspaceInstance;
    if (workspaceBootstrapPromise) return workspaceBootstrapPromise;
    workspaceBootstrapPromise = (async () => {
      const editor = await loadWorkspaceModule();
      workspaceInstance = editor.bootstrapCadWorkspace({ params });
      return workspaceInstance;
    })();
    return workspaceBootstrapPromise;
  }

  // Public API exposed for cross-module use (e.g. preview_app.js DXF/DWG bridge).
  globalThis.window.__vemcadApp = {
    async switchToEditor(documentJson) {
      setEditorMode();
      const ws = await ensureWorkspaceBootstrapped();
      if (ws && typeof ws.importPayload === 'function') {
        ws.importPayload(documentJson, { fitView: true });
      }
    },
  };

  const isEditorMode = mode === 'editor' || mode === 'cad' || mode === 'draft';
  if (isEditorMode) {
    setEditorMode();
    workspaceInstance = await ensureWorkspaceBootstrapped();
    return { mode: 'editor' };
  }

  setPreviewMode();
  await loadPreviewModule();
  return { mode: 'preview' };
}
