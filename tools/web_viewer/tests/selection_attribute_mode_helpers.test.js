import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSelectionAttributeModes } from '../ui/selection_attribute_mode_helpers.js';

test('formatSelectionAttributeModes returns empty for null', () => {
  assert.equal(formatSelectionAttributeModes(null), '');
});

test('formatSelectionAttributeModes returns empty for undefined', () => {
  assert.equal(formatSelectionAttributeModes(undefined), '');
});

test('formatSelectionAttributeModes returns empty for object without attribute metadata', () => {
  assert.equal(formatSelectionAttributeModes({}), '');
  assert.equal(formatSelectionAttributeModes({ type: 'line' }), '');
});

test('formatSelectionAttributeModes returns None for attributeFlags 0', () => {
  assert.equal(formatSelectionAttributeModes({ attributeFlags: 0 }), 'None');
});

test('formatSelectionAttributeModes returns None when all boolean flags are false', () => {
  assert.equal(
    formatSelectionAttributeModes({
      attributeInvisible: false,
      attributeConstant: false,
      attributeVerify: false,
      attributePreset: false,
      attributeLockPosition: false,
    }),
    'None',
  );
});

test('formatSelectionAttributeModes returns single mode', () => {
  assert.equal(formatSelectionAttributeModes({ attributeInvisible: true }), 'Invisible');
  assert.equal(formatSelectionAttributeModes({ attributeConstant: true }), 'Constant');
  assert.equal(formatSelectionAttributeModes({ attributeVerify: true }), 'Verify');
  assert.equal(formatSelectionAttributeModes({ attributePreset: true }), 'Preset');
  assert.equal(formatSelectionAttributeModes({ attributeLockPosition: true }), 'Lock Position');
});

test('formatSelectionAttributeModes returns multiple modes in correct order', () => {
  assert.equal(
    formatSelectionAttributeModes({ attributeInvisible: true, attributeConstant: true }),
    'Invisible / Constant',
  );
  assert.equal(
    formatSelectionAttributeModes({ attributePreset: true, attributeLockPosition: true }),
    'Preset / Lock Position',
  );
  assert.equal(
    formatSelectionAttributeModes({
      attributeInvisible: true,
      attributeConstant: true,
      attributeVerify: true,
      attributePreset: true,
      attributeLockPosition: true,
    }),
    'Invisible / Constant / Verify / Preset / Lock Position',
  );
});

test('formatSelectionAttributeModes preserves order regardless of input order', () => {
  assert.equal(
    formatSelectionAttributeModes({ attributeLockPosition: true, attributeInvisible: true }),
    'Invisible / Lock Position',
  );
});
