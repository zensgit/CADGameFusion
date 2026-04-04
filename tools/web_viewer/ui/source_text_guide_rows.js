import { isDirectEditableSourceTextEntity } from '../insert_group.js';
import { formatCompactNumber, formatPoint } from './selection_display_helpers.js';

function pushRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({ key, label, value: String(value) });
}

export function appendSourceTextGuideRows(rows, entity, sourceTextGuide) {
  if (entity?.sourceTextPos && Number.isFinite(entity.sourceTextPos.x) && Number.isFinite(entity.sourceTextPos.y)) {
    pushRow(rows, 'source-text-pos', 'Source Text Pos', formatPoint(entity.sourceTextPos));
  }
  if (Number.isFinite(entity?.sourceTextRotation)) {
    pushRow(rows, 'source-text-rotation', 'Source Text Rotation', formatCompactNumber(entity.sourceTextRotation));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.anchor) {
    pushRow(rows, 'source-anchor', 'Source Anchor', formatPoint(sourceTextGuide.anchor));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.landingPoint) {
    pushRow(rows, 'leader-landing', 'Leader Landing', formatPoint(sourceTextGuide.landingPoint));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && sourceTextGuide?.elbowPoint) {
    pushRow(rows, 'leader-elbow', 'Leader Elbow', formatPoint(sourceTextGuide.elbowPoint));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceType === 'LEADER' && Number.isFinite(sourceTextGuide?.landingLength)) {
    pushRow(rows, 'leader-landing-length', 'Leader Landing Length', formatCompactNumber(sourceTextGuide.landingLength));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.anchorDriverId) {
    const driverValue = sourceTextGuide?.anchorDriverLabel
      ? `${sourceTextGuide.anchorDriverId}:${sourceTextGuide.anchorDriverLabel}`
      : String(sourceTextGuide.anchorDriverId);
    pushRow(rows, 'source-anchor-driver', 'Source Anchor Driver', driverValue);
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.sourceOffset) {
    pushRow(rows, 'source-offset', 'Source Offset', formatPoint(sourceTextGuide.sourceOffset));
  }
  if (isDirectEditableSourceTextEntity(entity) && sourceTextGuide?.currentOffset) {
    pushRow(rows, 'current-offset', 'Current Offset', formatPoint(sourceTextGuide.currentOffset));
  }
}
