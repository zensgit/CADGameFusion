import { importCadgfDocument, isCadgfDocument } from './cadgf_document_adapter.js';

const CONVERT_CLI_TYPE_MAP = {
  0: 'polyline',
  1: 'point',
  2: 'line',
  3: 'arc',
  4: 'circle',
  5: 'ellipse',
  6: 'spline',
  7: 'text',
};

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function intColorToHex(color) {
  if (typeof color === 'string') return color;
  if (!Number.isFinite(color) || color <= 0) return '';
  return `#${(color & 0xFFFFFF).toString(16).padStart(6, '0')}`;
}

function normalizeConvertCliEntity(raw) {
  if (!raw || typeof raw.type !== 'number') return raw;
  const out = { ...raw };
  out.type = CONVERT_CLI_TYPE_MAP[raw.type] || 'line';
  if (Number.isFinite(raw.layer_id)) { out.layerId = raw.layer_id; delete out.layer_id; }
  if (Number.isFinite(raw.color)) out.color = intColorToHex(raw.color);
  if (typeof raw.line_type === 'string') { out.lineType = raw.line_type; delete out.line_type; }
  if (Number.isFinite(raw.line_weight)) { out.lineWeight = raw.line_weight; delete out.line_weight; }
  if (Number.isFinite(raw.line_type_scale)) { out.lineTypeScale = raw.line_type_scale; delete out.line_type_scale; }
  if (typeof raw.color_source === 'string') { out.colorSource = raw.color_source; delete out.color_source; }
  if (Number.isFinite(raw.color_aci)) { out.colorAci = raw.color_aci; delete out.color_aci; }
  if (Number.isFinite(raw.group_id)) { out.groupId = raw.group_id; delete out.group_id; }
  if (typeof raw.source_type === 'string') { out.sourceType = raw.source_type; delete out.source_type; }
  if (typeof raw.edit_mode === 'string') { out.editMode = raw.edit_mode; delete out.edit_mode; }
  if (typeof raw.proxy_kind === 'string') { out.proxyKind = raw.proxy_kind; delete out.proxy_kind; }
  if (typeof raw.block_name === 'string') { out.blockName = raw.block_name; delete out.block_name; }
  if (typeof raw.hatch_pattern === 'string') { out.hatchPattern = raw.hatch_pattern; delete out.hatch_pattern; }
  if (Number.isFinite(raw.hatch_id)) { out.hatchId = raw.hatch_id; delete out.hatch_id; }
  if (typeof raw.text_kind === 'string') { out.textKind = raw.text_kind; delete out.text_kind; }
  if (typeof raw.attribute_tag === 'string') { out.attributeTag = raw.attribute_tag; delete out.attribute_tag; }
  if (raw.attribute_invisible === true) out.attributeInvisible = true;
  if (Number.isFinite(raw.text_width_factor)) out.textWidthFactor = raw.text_width_factor;
  if (Number.isFinite(raw.text_halign)) out.textHalign = raw.text_halign;
  if (Number.isFinite(raw.text_attachment)) out.textAttachment = raw.text_attachment;

  if (out.type === 'line' && Array.isArray(raw.line) && raw.line.length >= 2) {
    const [p0, p1] = raw.line;
    out.start = { x: p0[0], y: p0[1] };
    out.end = { x: p1[0], y: p1[1] };
    delete out.line;
  }
  if (out.type === 'polyline' && Array.isArray(raw.polyline)) {
    out.points = raw.polyline.map((point) => ({ x: point[0], y: point[1] }));
    out.closed = raw.closed === true;
    delete out.polyline;
  }
  if (out.type === 'circle' && raw.circle) {
    out.center = { x: raw.circle.c[0], y: raw.circle.c[1] };
    out.radius = raw.circle.r;
    delete out.circle;
  }
  if (out.type === 'arc' && raw.arc) {
    out.center = { x: raw.arc.c[0], y: raw.arc.c[1] };
    out.radius = raw.arc.r;
    out.startAngle = raw.arc.a0;
    out.endAngle = raw.arc.a1;
    out.cw = raw.arc.cw === true;
    delete out.arc;
  }
  if (out.type === 'ellipse' && raw.ellipse) {
    out.center = { x: raw.ellipse.c[0], y: raw.ellipse.c[1] };
    out.radiusX = raw.ellipse.rx;
    out.radiusY = raw.ellipse.ry;
    out.rotation = raw.ellipse.rot || 0;
    out.startAngle = raw.ellipse.a0 || 0;
    out.endAngle = raw.ellipse.a1 || Math.PI * 2;
    delete out.ellipse;
  }
  if (out.type === 'point' && Array.isArray(raw.point)) {
    out.position = { x: raw.point[0], y: raw.point[1] };
    delete out.point;
  }
  if (out.type === 'text' && raw.text) {
    const text = raw.text;
    out.position = Array.isArray(text.pos) ? { x: text.pos[0], y: text.pos[1] } : { x: 0, y: 0 };
    out.height = text.h || 2.5;
    out.rotation = text.rot || 0;
    out.value = text.value || '';
    delete out.text;
  }
  if (out.type === 'spline' && raw.spline) {
    out.degree = raw.spline.degree || 3;
    out.controlPoints = (raw.spline.control || []).map((point) => ({ x: point[0], y: point[1] }));
    out.knots = raw.spline.knots || [];
    delete out.spline;
  }
  return out;
}

function normalizeConvertCliLayer(raw) {
  if (!raw) return raw;
  const out = { ...raw };
  if (Number.isFinite(raw.color)) out.color = intColorToHex(raw.color);
  if (raw.visible === 1) out.visible = true;
  else if (raw.visible === 0) out.visible = false;
  if (raw.locked === 1) out.locked = true;
  else if (raw.locked === 0) out.locked = false;
  if (raw.printable === 1) out.printable = true;
  else if (raw.printable === 0) out.printable = false;
  if (raw.frozen === 1) out.frozen = true;
  else if (raw.frozen === 0) out.frozen = false;
  if (raw.construction === 1) out.construction = true;
  else if (raw.construction === 0) out.construction = false;
  return out;
}

export function isConvertCliDocument(payload) {
  if (!isObject(payload) || !Array.isArray(payload.entities) || payload.entities.length === 0) {
    return false;
  }
  return typeof payload.entities[0]?.type === 'number';
}

export function adaptConvertCliDocument(payload) {
  if (!isConvertCliDocument(payload)) return payload;
  const adapted = { ...payload };
  adapted.entities = payload.entities.map((entity) => normalizeConvertCliEntity(entity));
  if (Array.isArray(payload.layers)) {
    adapted.layers = payload.layers.map((layer) => normalizeConvertCliLayer(layer));
  }
  return adapted;
}

export function extractEditorDocumentSnapshot(payload) {
  if (!isObject(payload)) {
    throw new Error('Invalid editor import payload.');
  }
  return isObject(payload.document) ? payload.document : payload;
}

export function resolveEditorImportPayload(payload) {
  if (!isObject(payload)) {
    throw new Error('Invalid editor import payload.');
  }
  if (isCadgfDocument(payload)) {
    const imported = importCadgfDocument(payload);
    return {
      kind: 'cadgf',
      documentPayload: imported.docSnapshot,
      docSnapshot: imported.docSnapshot,
      baseCadgfJson: imported.baseCadgfJson,
      warnings: imported.warnings,
    };
  }
  const kind = isConvertCliDocument(payload) ? 'convert-cli' : 'editor';
  const documentPayload = kind === 'convert-cli' ? adaptConvertCliDocument(payload) : payload;
  return {
    kind,
    documentPayload,
    docSnapshot: extractEditorDocumentSnapshot(documentPayload),
    baseCadgfJson: null,
    warnings: [],
  };
}

export function applyResolvedEditorImport(
  documentState,
  resolved,
  selectionState = null,
  snapState = null,
  viewState = null,
  { silent = false } = {},
) {
  if (!documentState || typeof documentState.restore !== 'function') {
    throw new Error('Document state is required.');
  }
  if (!resolved || typeof resolved !== 'object') {
    throw new Error('Resolved editor import payload is required.');
  }

  documentState.restore(resolved.docSnapshot, { silent });
  if (resolved.kind !== 'editor' && typeof documentState.setCurrentSpaceContext === 'function') {
    documentState.setCurrentSpaceContext(null, { silent: true });
  }

  if (selectionState) {
    if (resolved.documentPayload?.selection) {
      selectionState.restore(resolved.documentPayload.selection);
    } else {
      selectionState.clear();
    }
  }

  if (snapState && resolved.documentPayload?.snap) {
    snapState.restore(resolved.documentPayload.snap);
  }

  if (viewState && resolved.documentPayload?.view) {
    viewState.restore(resolved.documentPayload.view);
  }
}
