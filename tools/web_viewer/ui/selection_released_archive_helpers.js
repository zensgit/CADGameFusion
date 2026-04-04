import {
  resolveReleasedInsertArchive,
  summarizeReleasedInsertPeerInstances,
} from '../insert_group.js';
import { isReadOnlySelectionEntity } from './selection_meta_helpers.js';
import { formatSelectionAttributeModes } from './selection_attribute_mode_helpers.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveCommonArchiveString(archives, key) {
  if (!Array.isArray(archives) || archives.length === 0) return '';
  const first = normalizeText(archives[0]?.[key]);
  if (!first) return '';
  return archives.every((archive) => normalizeText(archive?.[key]) === first) ? first : '';
}

function resolveCommonArchiveInteger(archives, key) {
  if (!Array.isArray(archives) || archives.length === 0) return undefined;
  const first = Number.isFinite(archives[0]?.[key]) ? Math.trunc(Number(archives[0][key])) : undefined;
  if (!Number.isFinite(first)) return undefined;
  return archives.every((archive) => Number.isFinite(archive?.[key]) && Math.trunc(Number(archive[key])) === first)
    ? first
    : undefined;
}

export function formatReleasedInsertArchiveOrigin(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  const sourceType = normalizeText(archive?.sourceType);
  const proxyKind = normalizeText(archive?.proxyKind);
  const editMode = normalizeText(archive?.editMode);
  return [sourceType, proxyKind, editMode].filter(Boolean).join(' / ');
}

export function formatReleasedInsertArchiveModes(entityOrArchive) {
  const archive = resolveReleasedInsertArchive(entityOrArchive) || entityOrArchive;
  return formatSelectionAttributeModes(archive);
}

export function summarizeReleasedInsertArchiveSelection(entities, options = {}) {
  const list = Array.isArray(entities) ? entities.filter(Boolean) : [];
  if (list.length === 0) return null;
  const archives = list.map((entity) => resolveReleasedInsertArchive(entity));
  if (archives.some((archive) => !archive || normalizeText(archive?.sourceType).toUpperCase() !== 'INSERT')) {
    return null;
  }
  const groupId = resolveCommonArchiveInteger(archives, 'groupId');
  if (!Number.isFinite(groupId)) {
    return null;
  }
  const blockName = resolveCommonArchiveString(archives, 'blockName');
  if (!blockName) {
    return null;
  }
  const listEntities = typeof options.listEntities === 'function' ? options.listEntities : null;
  const peerSummary = listEntities
    ? summarizeReleasedInsertPeerInstances(listEntities(), list[0], { isReadOnly: isReadOnlySelectionEntity })
    : null;
  const archive = {
    sourceType: 'INSERT',
    editMode: resolveCommonArchiveString(archives, 'editMode'),
    proxyKind: resolveCommonArchiveString(archives, 'proxyKind'),
    groupId,
    blockName,
    textKind: resolveCommonArchiveString(archives, 'textKind'),
    attributeTag: resolveCommonArchiveString(archives, 'attributeTag'),
    attributeDefault: resolveCommonArchiveString(archives, 'attributeDefault'),
    attributePrompt: resolveCommonArchiveString(archives, 'attributePrompt'),
  };
  const attributeFlags = resolveCommonArchiveInteger(archives, 'attributeFlags');
  if (Number.isFinite(attributeFlags)) {
    archive.attributeFlags = attributeFlags;
  }
  const commonModes = formatReleasedInsertArchiveModes(archive);
  return {
    archive,
    entityCount: list.length,
    entityIds: list.map((entity) => entity.id),
    peerSummary,
    commonModes,
  };
}
