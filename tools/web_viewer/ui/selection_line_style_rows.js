import { normalizeText } from './selection_display_helpers.js';

function pushRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({
    key,
    label,
    value: String(value),
  });
}

export function appendSelectionLineStyleRows(rows, effectiveStyle, styleSources) {
  pushRow(rows, 'line-type', 'Line Type', normalizeText(effectiveStyle?.lineType));
  pushRow(rows, 'line-type-source', 'Line Type Source', styleSources?.lineTypeSource);
  if (styleSources?.lineWeightSource === 'EXPLICIT' || (Number.isFinite(effectiveStyle?.lineWeight) && Number(effectiveStyle.lineWeight) > 0)) {
    pushRow(rows, 'line-weight', 'Line Weight', String(effectiveStyle.lineWeight));
  }
  pushRow(rows, 'line-weight-source', 'Line Weight Source', styleSources?.lineWeightSource);
  if (Number.isFinite(effectiveStyle?.lineTypeScale)) {
    pushRow(rows, 'line-type-scale', 'Line Type Scale', String(effectiveStyle.lineTypeScale));
  }
  pushRow(rows, 'line-type-scale-source', 'Line Type Scale Source', styleSources?.lineTypeScaleSource);
}
