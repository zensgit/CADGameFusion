export function buildPropertyPanelSelectionShellState(presentation) {
  const mode = String(presentation?.mode || 'empty');
  const primary = presentation?.primary || null;
  const primaryLayer = presentation?.primaryLayer || null;
  const badges = Array.isArray(presentation?.badges) ? presentation.badges : [];
  const detailFacts = Array.isArray(presentation?.detailFacts) ? presentation.detailFacts : [];
  const isReadOnly = mode === 'multiple'
    ? badges.some((badge) => badge?.key === 'read-only')
    : (primary?.readOnly === true || primary?.editMode === 'proxy' || primary?.type === 'unsupported');

  const dataset = {
    mode,
    entityCount: String(Number.isFinite(presentation?.entityCount) ? presentation.entityCount : (primary ? 1 : 0)),
    primaryType: String(primary?.type || ''),
    readOnly: String(isReadOnly),
    layerId: Number.isFinite(primaryLayer?.id) ? String(primaryLayer.id) : '',
    layerName: String(primaryLayer?.name || ''),
    layerLocked: String(primaryLayer?.locked === true),
    layerFrozen: String(primaryLayer?.frozen === true),
    layerPrintable: String(primaryLayer?.printable !== false),
    layerConstruction: String(primaryLayer?.construction === true),
  };

  return { mode, primary, primaryLayer, badges, detailFacts, isReadOnly, dataset };
}
