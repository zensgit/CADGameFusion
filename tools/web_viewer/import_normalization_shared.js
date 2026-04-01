function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function readAliasedValue(raw, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    if (hasOwn(raw, key)) {
      return raw?.[key];
    }
  }
  return undefined;
}

export function normalizeColorSource(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toUpperCase();
  return normalized === 'BYLAYER'
    || normalized === 'BYBLOCK'
    || normalized === 'INDEX'
    || normalized === 'TRUECOLOR'
    ? normalized
    : '';
}

export function normalizeColorAci(value) {
  if (!Number.isFinite(value)) return null;
  return Math.min(255, Math.max(0, Math.trunc(value)));
}

export function normalizeOptionalBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

export function normalizeTextKind(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function deriveLegacyAttdefDefault(raw, meta, {
  textKindKeys = ['textKind', 'text_kind'],
  attributeDefaultKeys = ['attributeDefault', 'attribute_default'],
  attributePromptKeys = ['attributePrompt', 'attribute_prompt'],
  textValueKeys = ['value'],
  nestedTextValueKeys = ['text'],
} = {}) {
  const metaTextKind = typeof meta?.textKind === 'string' ? meta.textKind : undefined;
  const textKind = normalizeTextKind(metaTextKind ?? readAliasedValue(raw, textKindKeys));
  if (textKind !== 'attdef') return null;

  if (typeof meta?.attributeDefault === 'string') return meta.attributeDefault;
  const explicitDefault = readAliasedValue(raw, attributeDefaultKeys);
  if (typeof explicitDefault === 'string') return explicitDefault;

  const explicitPrompt = typeof meta?.attributePrompt === 'string'
    ? meta.attributePrompt
    : readAliasedValue(raw, attributePromptKeys);
  const prompt = typeof explicitPrompt === 'string' ? explicitPrompt : '';

  let rawValue = readAliasedValue(raw, textValueKeys);
  if (typeof rawValue !== 'string') {
    for (const key of Array.isArray(nestedTextValueKeys) ? nestedTextValueKeys : []) {
      const candidate = raw?.[key]?.value;
      if (typeof candidate === 'string') {
        rawValue = candidate;
        break;
      }
    }
  }
  if (typeof rawValue !== 'string') return null;

  if (prompt) {
    const crlfSuffix = `\r\n${prompt}`;
    if (rawValue.endsWith(crlfSuffix)) {
      return rawValue.slice(0, -crlfSuffix.length);
    }
    const lfSuffix = `\n${prompt}`;
    if (rawValue.endsWith(lfSuffix)) {
      return rawValue.slice(0, -lfSuffix.length);
    }
  }
  return rawValue;
}

export function applyAttributeFlagFallbacks(meta) {
  if (!meta || !Number.isFinite(meta.attributeFlags)) return meta;
  if (typeof meta.attributeInvisible !== 'boolean') meta.attributeInvisible = (meta.attributeFlags & 1) !== 0;
  if (typeof meta.attributeConstant !== 'boolean') meta.attributeConstant = (meta.attributeFlags & 2) !== 0;
  if (typeof meta.attributeVerify !== 'boolean') meta.attributeVerify = (meta.attributeFlags & 4) !== 0;
  if (typeof meta.attributePreset !== 'boolean') meta.attributePreset = (meta.attributeFlags & 8) !== 0;
  if (typeof meta.attributeLockPosition !== 'boolean') meta.attributeLockPosition = (meta.attributeFlags & 16) !== 0;
  return meta;
}

export function isInsertTextProxyMetadata(meta) {
  return String(meta?.sourceType || '').trim().toUpperCase() === 'INSERT'
    && String(meta?.editMode || '').trim().toLowerCase() === 'proxy'
    && String(meta?.proxyKind || '').trim().toLowerCase() === 'text'
    && normalizeTextKind(meta?.textKind) !== '';
}

export function normalizeImportedEntityStyle(raw, {
  lineTypeKeys = ['lineType', 'line_type'],
  lineWeightKeys = ['lineWeight', 'line_weight'],
  lineWeightSourceKeys = ['lineWeightSource', 'line_weight_source'],
  lineTypeScaleKeys = ['lineTypeScale', 'line_type_scale'],
  lineTypeScaleSourceKeys = ['lineTypeScaleSource', 'line_type_scale_source'],
} = {}) {
  const style = {
    lineType: 'CONTINUOUS',
    lineWeight: 0,
    lineWeightSource: 'BYLAYER',
    lineTypeScale: 1,
    lineTypeScaleSource: 'DEFAULT',
  };

  const lineType = readAliasedValue(raw, lineTypeKeys);
  if (typeof lineType === 'string' && lineType.trim()) {
    style.lineType = lineType.trim().toUpperCase();
  }

  const lineWeight = readAliasedValue(raw, lineWeightKeys);
  if (Number.isFinite(lineWeight)) {
    style.lineWeight = Math.max(0, Number(lineWeight));
  }

  const rawLineWeightSource = readAliasedValue(raw, lineWeightSourceKeys);
  if (typeof rawLineWeightSource === 'string' && rawLineWeightSource.trim()) {
    const normalizedSource = rawLineWeightSource.trim().toUpperCase();
    style.lineWeightSource = normalizedSource === 'EXPLICIT' ? 'EXPLICIT' : 'BYLAYER';
  } else if ((Array.isArray(lineWeightKeys) ? lineWeightKeys : []).some((key) => hasOwn(raw, key))) {
    style.lineWeightSource = 'EXPLICIT';
  }

  const lineTypeScale = readAliasedValue(raw, lineTypeScaleKeys);
  if (Number.isFinite(lineTypeScale)) {
    style.lineTypeScale = Math.max(0, Number(lineTypeScale));
  }

  const rawLineTypeScaleSource = readAliasedValue(raw, lineTypeScaleSourceKeys);
  if (typeof rawLineTypeScaleSource === 'string' && rawLineTypeScaleSource.trim()) {
    const normalizedSource = rawLineTypeScaleSource.trim().toUpperCase();
    style.lineTypeScaleSource = normalizedSource === 'EXPLICIT' ? 'EXPLICIT' : 'DEFAULT';
  } else if ((Array.isArray(lineTypeScaleKeys) ? lineTypeScaleKeys : []).some((key) => hasOwn(raw, key))) {
    style.lineTypeScaleSource = 'EXPLICIT';
  }

  return style;
}
