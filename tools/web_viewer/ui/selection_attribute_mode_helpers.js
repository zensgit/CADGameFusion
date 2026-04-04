export function formatSelectionAttributeModes(entityOrArchive) {
  const hasAttributeMetadata = Number.isFinite(entityOrArchive?.attributeFlags)
    || typeof entityOrArchive?.attributeInvisible === 'boolean'
    || typeof entityOrArchive?.attributeConstant === 'boolean'
    || typeof entityOrArchive?.attributeVerify === 'boolean'
    || typeof entityOrArchive?.attributePreset === 'boolean'
    || typeof entityOrArchive?.attributeLockPosition === 'boolean';
  if (!hasAttributeMetadata) return '';
  const modes = [];
  if (entityOrArchive?.attributeInvisible === true) modes.push('Invisible');
  if (entityOrArchive?.attributeConstant === true) modes.push('Constant');
  if (entityOrArchive?.attributeVerify === true) modes.push('Verify');
  if (entityOrArchive?.attributePreset === true) modes.push('Preset');
  if (entityOrArchive?.attributeLockPosition === true) modes.push('Lock Position');
  return modes.length > 0 ? modes.join(' / ') : 'None';
}
