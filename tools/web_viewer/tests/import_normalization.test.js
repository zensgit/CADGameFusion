import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveLegacyAttdefDefault,
  normalizeColorAci,
  normalizeColorSource,
  normalizeOptionalBool,
  normalizeTextKind,
} from '../import_normalization.js';

test('import normalization helpers keep shared color and boolean semantics stable', () => {
  assert.equal(normalizeColorSource('bylayer'), 'BYLAYER');
  assert.equal(normalizeColorSource('truecolor'), 'TRUECOLOR');
  assert.equal(normalizeColorSource('unknown'), '');

  assert.equal(normalizeColorAci(8), 8);
  assert.equal(normalizeColorAci(999), 255);
  assert.equal(normalizeColorAci(null), null);

  assert.equal(normalizeOptionalBool(1), true);
  assert.equal(normalizeOptionalBool('false'), false);
  assert.equal(normalizeOptionalBool('maybe'), null);

  assert.equal(normalizeTextKind(' ATTRIB '), 'attrib');
});

test('deriveLegacyAttdefDefault supports both editor-style and cadgf-style fields', () => {
  const editorStyle = deriveLegacyAttdefDefault({
    textKind: 'attdef',
    attributePrompt: 'PROMPT',
    value: 'DEFAULT\r\nPROMPT',
  }, {});
  assert.equal(editorStyle, 'DEFAULT');

  const cadgfStyle = deriveLegacyAttdefDefault({
    text_kind: 'attdef',
    attribute_prompt: 'PROMPT',
    text: { value: 'DEFAULT\nPROMPT' },
  }, {});
  assert.equal(cadgfStyle, 'DEFAULT');
});
