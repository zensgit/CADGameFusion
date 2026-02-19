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

async function bootstrap() {
  const isEditorMode = mode === 'editor' || mode === 'cad' || mode === 'draft';
  if (isEditorMode) {
    setEditorMode();
    const editor = await import('./ui/workspace.js');
    editor.bootstrapCadWorkspace({ params });
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
