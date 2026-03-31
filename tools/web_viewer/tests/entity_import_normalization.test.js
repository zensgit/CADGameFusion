import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeImportedAnnotationMetadata,
  normalizeImportedAttributeMetadata,
  normalizeImportedEntityMetadataBase,
  normalizeImportedEntityStyle,
  resolveImportedEntityVisibilityPolicy,
  resolveImportedTextValuePolicy,
} from '../entity_import_normalization.js';

test('normalizeImportedEntityStyle honors editor-style aliases and explicit source fields', () => {
  const style = normalizeImportedEntityStyle({
    lineType: ' hidden2 ',
    lineWeight: 0.55,
    lineWeightSource: 'explicit',
    lineTypeScale: 1.7,
    lineTypeScaleSource: 'default',
  });

  assert.deepEqual(style, {
    lineType: 'HIDDEN2',
    lineWeight: 0.55,
    lineWeightSource: 'EXPLICIT',
    lineTypeScale: 1.7,
    lineTypeScaleSource: 'DEFAULT',
  });
});

test('normalizeImportedEntityStyle preserves CADGF explicit-by-presence semantics when source keys are ignored', () => {
  const style = normalizeImportedEntityStyle({
    line_type: 'center',
    line_weight: 0.35,
    line_weight_source: 'BYLAYER',
    line_type_scale: 0.5,
    line_type_scale_source: 'DEFAULT',
  }, {
    honorLineWeightSourceKeys: false,
    honorLineTypeScaleSourceKeys: false,
  });

  assert.deepEqual(style, {
    lineType: 'CENTER',
    lineWeight: 0.35,
    lineWeightSource: 'EXPLICIT',
    lineTypeScale: 0.5,
    lineTypeScaleSource: 'EXPLICIT',
  });
});

test('normalizeImportedAttributeMetadata honors editor-style aliases and explicit attribute booleans', () => {
  const meta = normalizeImportedAttributeMetadata({
    textKind: 'attdef',
    attributeTag: 'TAG',
    attributePrompt: 'PROMPT',
    value: 'DEFAULT\r\nPROMPT',
    attributeFlags: 31,
    attributeInvisible: false,
    attributeConstant: true,
    attributeVerify: false,
    attributePreset: true,
    attributeLockPosition: false,
  });

  assert.deepEqual(meta, {
    textKind: 'attdef',
    attributeTag: 'TAG',
    attributePrompt: 'PROMPT',
    attributeDefault: 'DEFAULT',
    attributeFlags: 31,
    attributeInvisible: false,
    attributeConstant: true,
    attributeVerify: false,
    attributePreset: true,
    attributeLockPosition: false,
  });
});

test('normalizeImportedAttributeMetadata supports CADGF snake_case fields and flag fallback semantics', () => {
  const meta = normalizeImportedAttributeMetadata({
    text_kind: 'attrib',
    attribute_tag: 'ATTRIB_TAG',
    attribute_flags: 16,
    text: { value: 'ATTRIB_VALUE' },
  }, {
    textKindKeys: ['text_kind'],
    attributeTagKeys: ['attribute_tag'],
    attributeDefaultKeys: ['attribute_default'],
    attributePromptKeys: ['attribute_prompt'],
    attributeFlagsKeys: ['attribute_flags'],
    attributeInvisibleKeys: ['attribute_invisible'],
    attributeConstantKeys: ['attribute_constant'],
    attributeVerifyKeys: ['attribute_verify'],
    attributePresetKeys: ['attribute_preset'],
    attributeLockPositionKeys: ['attribute_lock_position'],
  });

  assert.deepEqual(meta, {
    textKind: 'attrib',
    attributeTag: 'ATTRIB_TAG',
    attributeFlags: 16,
    attributeInvisible: false,
    attributeConstant: false,
    attributeVerify: false,
    attributePreset: false,
    attributeLockPosition: true,
  });
});

test('normalizeImportedEntityMetadataBase honors editor-style aliases and clamps canonical fields', () => {
  const meta = normalizeImportedEntityMetadataBase({
    groupId: 7.8,
    space: 1,
    layout: 'Layout-A',
    colorSource: 'bylayer',
    colorAci: 999,
    sourceType: 'INSERT',
    editMode: 'fragment',
    proxyKind: 'text',
    blockName: 'BLOCK_A',
    hatchPattern: 'ANSI31',
    hatchId: 12.9,
    sourceBundleId: 33.4,
  });

  assert.deepEqual(meta, {
    groupId: 7,
    space: 1,
    layout: 'Layout-A',
    colorSource: 'BYLAYER',
    colorAci: 255,
    sourceType: 'INSERT',
    editMode: 'fragment',
    proxyKind: 'text',
    blockName: 'BLOCK_A',
    hatchPattern: 'ANSI31',
    hatchId: 12,
    sourceBundleId: 33,
  });
});

test('normalizeImportedEntityMetadataBase supports CADGF snake_case aliases and optional own-space semantics', () => {
  const raw = Object.assign(Object.create({ space: 1 }), {
    group_id: 9,
    layout_name: 'Layout-B',
    color_source: 'index',
    color_aci: 8,
    source_type: 'TABLE',
    edit_mode: 'proxy',
    proxy_kind: 'table',
    block_name: 'TABLE_BLOCK',
    hatch_pattern: 'SOLID',
    hatch_id: 5,
    source_bundle_id: 70,
  });

  const meta = normalizeImportedEntityMetadataBase(raw, {
    groupIdKeys: ['group_id'],
    spaceKeys: ['space'],
    requireOwnSpaceKeys: true,
    layoutKeys: ['layout', 'layout_name'],
    colorSourceKeys: ['color_source'],
    colorAciKeys: ['color_aci'],
    sourceTypeKeys: ['source_type'],
    editModeKeys: ['edit_mode'],
    proxyKindKeys: ['proxy_kind'],
    blockNameKeys: ['block_name'],
    hatchPatternKeys: ['hatch_pattern'],
    hatchIdKeys: ['hatch_id'],
    sourceBundleIdKeys: ['source_bundle_id'],
  });

  assert.deepEqual(meta, {
    groupId: 9,
    layout: 'Layout-B',
    colorSource: 'INDEX',
    colorAci: 8,
    sourceType: 'TABLE',
    editMode: 'proxy',
    proxyKind: 'table',
    blockName: 'TABLE_BLOCK',
    hatchPattern: 'SOLID',
    hatchId: 5,
    sourceBundleId: 70,
  });
});

test('normalizeImportedAnnotationMetadata preserves editor proxy fallback order and anchor metadata', () => {
  const meta = normalizeImportedAnnotationMetadata({
    explicitSourceTextPos: null,
    explicitSourceTextRotation: null,
    textPos: { x: 10, y: 20 },
    textRotation: Math.PI / 6,
    dimTextPos: { x: 30, y: 40 },
    dimTextRotation: Math.PI / 3,
    sourceAnchor: { x: 2, y: 3 },
    leaderLanding: { x: 4, y: 5 },
    leaderElbow: { x: 6, y: 7 },
    sourceAnchorDriverId: 21.9,
    sourceAnchorDriverType: ' line ',
    sourceAnchorDriverKind: ' midpoint ',
  }, {
    proxyTextFallbackEnabled: true,
    sourceTextFallbackOrder: ['explicit', 'text', 'dimension'],
    sourceTextRotationFallbackOrder: ['explicit', 'text', 'dimension'],
  });

  assert.deepEqual(meta, {
    dimTextPos: { x: 30, y: 40 },
    dimTextRotation: Math.PI / 3,
    sourceAnchor: { x: 2, y: 3 },
    leaderLanding: { x: 4, y: 5 },
    leaderElbow: { x: 6, y: 7 },
    sourceAnchorDriverId: 21,
    sourceAnchorDriverType: 'line',
    sourceAnchorDriverKind: 'midpoint',
    sourceTextPos: { x: 10, y: 20 },
    sourceTextRotation: Math.PI / 6,
  });
});

test('normalizeImportedAnnotationMetadata supports CADGF dimension-first fallback order', () => {
  const meta = normalizeImportedAnnotationMetadata({
    textPos: { x: 12, y: 18 },
    textRotation: 0,
    dimTextPos: { x: 65, y: 152 },
    dimTextRotation: Math.PI / 4,
  }, {
    proxyTextFallbackEnabled: true,
    sourceTextFallbackOrder: ['dimension', 'text'],
    sourceTextRotationFallbackOrder: ['dimension', 'text'],
  });

  assert.deepEqual(meta, {
    dimTextPos: { x: 65, y: 152 },
    dimTextRotation: Math.PI / 4,
    sourceTextPos: { x: 65, y: 152 },
    sourceTextRotation: Math.PI / 4,
  });
});

test('resolveImportedTextValuePolicy preserves caller order and fallback defaults', () => {
  assert.equal(resolveImportedTextValuePolicy({
    legacyAttributeDefault: 'ATTDEF_DEFAULT',
    explicitValue: 'EDITOR_VALUE',
    textValue: 'CADGF_TEXT',
  }, {
    fallback: 'TEXT',
    valueOrder: ['explicit', 'text'],
  }), 'ATTDEF_DEFAULT');

  assert.equal(resolveImportedTextValuePolicy({
    legacyAttributeDefault: null,
    explicitValue: 'EDITOR_VALUE',
    textValue: 'CADGF_TEXT',
  }, {
    fallback: 'TEXT',
    valueOrder: ['explicit', 'text'],
  }), 'EDITOR_VALUE');

  assert.equal(resolveImportedTextValuePolicy({
    legacyAttributeDefault: null,
    explicitValue: 'EDITOR_VALUE',
    textValue: 'CADGF_TEXT',
  }, {
    fallback: '',
    valueOrder: ['text'],
  }), 'CADGF_TEXT');

  assert.equal(resolveImportedTextValuePolicy({
    legacyAttributeDefault: null,
    explicitValue: null,
    textValue: null,
  }, {
    fallback: 'TEXT',
    valueOrder: ['explicit', 'text'],
  }), 'TEXT');
});

test('resolveImportedEntityVisibilityPolicy preserves strict-boolean and bool-int caller semantics', () => {
  assert.equal(resolveImportedEntityVisibilityPolicy({
    hasExplicitVisible: true,
    explicitVisible: 0,
    isInsertTextProxy: false,
    attributeInvisible: null,
    fallback: true,
  }, {
    explicitVisibleMode: 'strict-boolean',
  }), true);

  assert.equal(resolveImportedEntityVisibilityPolicy({
    hasExplicitVisible: true,
    explicitVisible: 0,
    isInsertTextProxy: false,
    attributeInvisible: null,
    fallback: true,
  }, {
    explicitVisibleMode: 'bool-int',
  }), false);

  assert.equal(resolveImportedEntityVisibilityPolicy({
    hasExplicitVisible: false,
    explicitVisible: undefined,
    isInsertTextProxy: true,
    attributeInvisible: true,
    fallback: true,
  }, {
    explicitVisibleMode: 'bool-int',
  }), false);
});
