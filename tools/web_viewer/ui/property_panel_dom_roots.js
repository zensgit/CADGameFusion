export function resolvePropertyPanelDomRoots({
  rootDocument = globalThis.document,
  formId = 'cad-property-form',
  summaryId = 'cad-selection-summary',
  detailsId = 'cad-selection-details',
} = {}) {
  const doc = rootDocument && typeof rootDocument.getElementById === 'function'
    ? rootDocument
    : null;
  if (!doc) {
    return null;
  }

  const form = doc.getElementById(formId);
  if (!form) {
    return null;
  }

  return {
    form,
    summary: doc.getElementById(summaryId) || null,
    details: doc.getElementById(detailsId) || null,
  };
}
