const params = new URLSearchParams(window.location.search);
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
    const editor = await import('./ui/workspace.js');
    workspaceInstance = editor.bootstrapCadWorkspace({ params });
    return workspaceInstance;
  })();
  return workspaceBootstrapPromise;
}

// Public API exposed for cross-module use (e.g. preview_app.js DXF/DWG bridge).
window.__vemcadApp = {
  /**
   * Switch to editor mode and load the given document JSON payload.
   * Safe to call from preview_app.js when the desktop bridge delivers a
   * converted DXF/DWG document.
   */
  async switchToEditor(documentJson) {
    setEditorMode();
    const ws = await ensureWorkspaceBootstrapped();
    if (ws && typeof ws.importPayload === 'function') {
      ws.importPayload(documentJson, { fitView: true });
    }
  },
};

async function bootstrap() {
  const isEditorMode = mode === 'editor' || mode === 'cad' || mode === 'draft';
  if (isEditorMode) {
    setEditorMode();
    workspaceInstance = await ensureWorkspaceBootstrapped();
    return;
  }

  setPreviewMode();
  await import('./preview_app.js');
}

bootstrap().catch((error) => {
  console.error('web_viewer bootstrap failed', error);
  const target = mode === 'editor' || mode === 'cad' ? document.getElementById('cad-status-message') : document.getElementById('status');
  if (target) {
    target.textContent = `Bootstrap failed: ${error?.message || String(error)}`;
  }
});
