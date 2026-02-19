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
  const documentPayload = payload.document && typeof payload.document === 'object'
    ? payload.document
    : payload;

  documentState.importJSON(documentPayload);

  if (selectionState && payload.selection) {
    selectionState.restore(payload.selection);
  } else if (selectionState) {
    selectionState.clear();
  }

  if (snapState && payload.snap) {
    snapState.restore(payload.snap);
  }

  if (viewState && payload.view) {
    viewState.restore(payload.view);
  }
}
