import {
  formatReleasedInsertArchiveOrigin,
  formatReleasedInsertArchiveModes,
} from './selection_released_archive_helpers.js';
import { normalizeText } from './selection_display_helpers.js';

function pushRow(rows, key, label, value) {
  if (value === null || value === undefined || value === '') return;
  rows.push({ key, label, value: String(value) });
}

export function appendReleasedArchiveIdentityRows(rows, archive) {
  if (!archive) return;
  pushRow(rows, 'released-from', 'Released From', formatReleasedInsertArchiveOrigin(archive));
  if (Number.isFinite(archive?.groupId)) {
    pushRow(rows, 'released-group-id', 'Released Group ID', String(Math.trunc(archive.groupId)));
  }
  pushRow(rows, 'released-block-name', 'Released Block Name', normalizeText(archive?.blockName));
}

export function appendReleasedArchiveAttributeRows(rows, archive, { commonModes } = {}) {
  if (!archive) return;
  pushRow(rows, 'released-text-kind', 'Released Text Kind', normalizeText(archive?.textKind));
  pushRow(rows, 'released-attribute-tag', 'Released Attribute Tag', normalizeText(archive?.attributeTag));
  pushRow(rows, 'released-attribute-default', 'Released Attribute Default', normalizeText(archive?.attributeDefault));
  pushRow(rows, 'released-attribute-prompt', 'Released Attribute Prompt', normalizeText(archive?.attributePrompt));
  if (Number.isFinite(archive?.attributeFlags)) {
    pushRow(rows, 'released-attribute-flags', 'Released Attribute Flags', String(Math.trunc(archive.attributeFlags)));
  }
  pushRow(
    rows,
    'released-attribute-modes',
    'Released Attribute Modes',
    commonModes || formatReleasedInsertArchiveModes(archive),
  );
}
