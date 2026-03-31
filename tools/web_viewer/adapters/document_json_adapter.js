import { applyResolvedEditorImport, resolveEditorImportPayload } from './editor_import_adapter.js';

export function serializeDocument(documentState, selectionState = null, snapState = null, viewState = null) {
  return {
    schema: 'vemcad-web-2d-v1',
    generated_at: new Date().toISOString(),
    document: documentState.exportJSON(),
    selection: selectionState ? selectionState.toJSON() : null,
    snap: snapState ? snapState.toJSON() : null,
    view: viewState ? viewState.toJSON() : null,
  };
}

export function hydrateDocument(documentState, payload, selectionState = null, snapState = null, viewState = null) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid JSON payload.');
  }
  const resolved = resolveEditorImportPayload(payload);
  if (resolved.kind === 'cadgf') {
    throw new Error('hydrateDocument expects editor JSON or convert_cli payloads. Use the CADGF import adapter for CADGF documents.');
  }
  applyResolvedEditorImport(documentState, resolved, selectionState, snapState, viewState);
}
