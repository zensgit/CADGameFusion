import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
let LineSegments2Ref = null;
let LineSegmentsGeometryRef = null;
let LineMaterialRef = null;
let lineModulesReady = false;
let lineModulesFailed = false;
let lineModulesPromise = null;

const urlParams = new URLSearchParams(window.location.search);
const viewMode = (urlParams.get("view") || "").trim().toLowerCase();
const projectionMode = (urlParams.get("projection") || "").trim().toLowerCase();
const gridMode = (urlParams.get("grid") || "").trim().toLowerCase();
const bgMode = (urlParams.get("bg") || "").trim().toLowerCase();
const renderMode = (urlParams.get("render") || "").trim().toLowerCase();
const uiMode = (urlParams.get("ui") || "").trim().toLowerCase();
const spaceMode = (urlParams.get("space") || "").trim().toLowerCase();
const lineWeightScaleParam = Number.parseFloat(urlParams.get("line_weight_scale") || "");
const meshMode = (urlParams.get("mesh") || "").trim().toLowerCase();
const textStyleMode = (urlParams.get("text_style") || urlParams.get("text_overlay_style") || "").trim().toLowerCase();
const lineOverlayMode = (urlParams.get("line_overlay") || urlParams.get("lines") || "").trim().toLowerCase();
const paperViewportMode = (urlParams.get("paper_viewport") || urlParams.get("layout_viewport") || "").trim().toLowerCase();
const layoutMode = (urlParams.get("layout") || "").trim();

const USE_TOP_VIEW = viewMode === "top";
const USE_ORTHO = projectionMode === "ortho";
const GRID_VISIBLE = !(gridMode === "0" || gridMode === "false" || gridMode === "off" || gridMode === "no");
const BG_BLACK = bgMode === "black" || bgMode === "dark";
const RENDER_WIREFRAME = renderMode === "wire" || renderMode === "wireframe";
const UI_HIDDEN = uiMode === "0" || uiMode === "false" || uiMode === "off" || uiMode === "no";
const SPACE_FILTER = spaceMode === "model" ? 0 : (spaceMode === "paper" ? 1 : null);
const LINE_WEIGHT_SCALE = Number.isFinite(lineWeightScaleParam) && lineWeightScaleParam > 0
  ? lineWeightScaleParam
  : 3.0;
const MESH_VISIBLE = !(meshMode === "0" || meshMode === "false" || meshMode === "off" || meshMode === "no");
const LINE_OVERLAY_VISIBLE = !(lineOverlayMode === "0" || lineOverlayMode === "false" || lineOverlayMode === "off" || lineOverlayMode === "no");
const TEXT_STYLE_CLEAN = textStyleMode === "clean" || textStyleMode === "plain";
const PAPER_VIEWPORT_ENABLED = !(paperViewportMode === "0" || paperViewportMode === "false" || paperViewportMode === "off" || paperViewportMode === "no");

const canvas = document.getElementById("viewport");
const statusEl = document.getElementById("status");
const gltfUrlInput = document.getElementById("gltf-url");
const loadBtn = document.getElementById("load-btn");
const meshCountEl = document.getElementById("mesh-count");
const vertexCountEl = document.getElementById("vertex-count");
const triangleCountEl = document.getElementById("triangle-count");
const selectionInfoEl = document.getElementById("selection-info");
const annotationListEl = document.getElementById("annotation-list");
const layerListEl = document.getElementById("layer-list");
const metaProjectIdEl = document.getElementById("meta-project-id");
const metaDocumentLabelEl = document.getElementById("meta-document-label");
const metaDocumentIdEl = document.getElementById("meta-document-id");
const metaManifestEl = document.getElementById("meta-manifest");
const textToggleBtn = document.getElementById("text-toggle");
const textOverlayEl = document.getElementById("text-overlay");
const textCanvas = document.getElementById("text-canvas");
const textFilterAllBtn = document.getElementById("text-filter-all");
const textFilterDimBtn = document.getElementById("text-filter-dimension");
const textFilterTextBtn = document.getElementById("text-filter-text");
const textOverlayStateEl = document.getElementById("text-overlay-state");
const textFilterStateEl = document.getElementById("text-filter-state");
const textEntryCountEl = document.getElementById("text-entry-count");
const textVisibleCountEl = document.getElementById("text-visible-count");
const textCappedCountEl = document.getElementById("text-capped-count");
let textCanvasCtx = null;

if (UI_HIDDEN) {
  document.body.classList.add("is-ui-hidden");
}
if (BG_BLACK) {
  document.body.classList.add("is-bg-black");
}
if (TEXT_STYLE_CLEAN) {
  document.body.classList.add("text-overlay-clean");
}
if (textCanvas) {
  textCanvasCtx = textCanvas.getContext("2d");
}

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
if (BG_BLACK) {
  renderer.setClearColor(0x000000, 1);
}

const scene = new THREE.Scene();
if (BG_BLACK) {
  scene.background = new THREE.Color(0x000000);
}

const camera = USE_ORTHO
  ? new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000)
  : new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
camera.position.set(3, 3, 3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

const hemi = new THREE.HemisphereLight(0xffffff, 0x2b2d33, 0.9);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.8);
dir.position.set(4, 6, 4);
scene.add(dir);

const grid = new THREE.GridHelper(10, 10, 0xe8dccf, 0xf1ede6);
grid.material.opacity = 0.4;
grid.material.transparent = true;
grid.visible = GRID_VISIBLE;
scene.add(grid);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let activeScene = null;
let selectable = [];
let selected = null;
const annotationGroup = new THREE.Group();
scene.add(annotationGroup);
const annotations = [];
let meshMetadata = null;
let documentData = null;
let entityIndex = new Map();
let layerColors = new Map();
let layerNames = new Map();
let meshSlices = [];
let lineSlices = [];
let lineGroup = null;
let lineMaterials = [];
let lineGeometryData = null;
let lineSource = null;
let metadataApplied = false;
let documentMeta = {};
let defaultSpace = null;
let viewportEntries = [];
let viewportTransforms = [];
let hasPaperFrame = false;
let defaultTextHeight = 0;
let textOverlayEnabled = true;
let textEntries = [];
let textLabels = [];
let textFiltered = [];
let textFilteredCount = 0;
let textFilter = "dimension";
let orthoHalfHeight = 1;
const textProject = new THREE.Vector3();
const textProject2 = new THREE.Vector3();
const textProject3 = new THREE.Vector3();
const textProject4 = new THREE.Vector3();

const CADGF_ENTITY_TYPE_TEXT = 7;
const TEXT_MIN_PX = 7;
const TEXT_MAX_PX = 48;
const TEXT_DEFAULT_PX = 12;
const TEXT_MAX_LABELS = 600;
const TEXT_MAX_ENTRIES = 4000;
const TEXT_MIN_SCREEN_PX = 2;
const TEXT_UP = new THREE.Vector3(0, 1, 0);
const TEXT_BASELINE_SHIFT = 0.12;
const TEXT_ASCII_WIDTH = 0.6;
const TEXT_WIDE_WIDTH = 1.0;
const TEXT_DEFAULT_HEIGHT_WORLD = 1.0;
const TEXT_LINE_HEIGHT = 1.1;
const LINE_WEIGHT_DEFAULT = 0.18;
const LINE_WEIGHT_MIN = 0.05;
const LINE_WEIGHT_MAX = 2.0;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#c0392b" : "#5f6b73";
}

function resetMetadataState() {
  meshMetadata = null;
  documentData = null;
  entityIndex = new Map();
  layerColors = new Map();
  layerNames = new Map();
  meshSlices = [];
  lineSlices = [];
  metadataApplied = false;
  documentMeta = {};
  defaultSpace = null;
  viewportEntries = [];
  viewportTransforms = [];
  defaultTextHeight = 0;
  hasPaperFrame = false;
  renderLayerList();
  resetTextOverlay();
}

function aciToRgb(index) {
  switch (index) {
    case 1: return 0xff0000;
    case 2: return 0xffff00;
    case 3: return 0x00ff00;
    case 4: return 0x00ffff;
    case 5: return 0x0000ff;
    case 6: return 0xff00ff;
    case 7: return 0xffffff;
    case 8: return 0x808080;
    case 9: return 0xc0c0c0;
    default: return 0xffffff;
  }
}

function colorIntToHex(color) {
  const safe = Number.isFinite(color) ? color : 0;
  return `#${safe.toString(16).padStart(6, "0")}`;
}

function resolveEntityColor(entity, fallbackLayerId = null, fallbackLayerColor = null) {
  const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : fallbackLayerId;
  const fallbackColor = Number.isFinite(fallbackLayerColor) ? fallbackLayerColor : null;
  const layerColor = Number.isFinite(layerId)
    ? (layerColors.get(layerId) ?? fallbackColor ?? 0xdcdce6)
    : (fallbackColor ?? 0xdcdce6);
  const entityColor = Number.isFinite(entity?.color) ? entity.color : 0;
  const source = (entity?.color_source || "").toUpperCase();
  const aci = Number.isFinite(entity?.color_aci) ? entity.color_aci : 0;
  const aciColor = aci > 0 ? aciToRgb(aci) : null;

  if (source === "BYLAYER") return layerColor;
  if (source === "INDEX") return aciColor ?? (entityColor || layerColor);
  if (source === "TRUECOLOR") return entityColor || aciColor || layerColor;
  if (source === "BYBLOCK") return entityColor || aciColor || layerColor;
  return entityColor || aciColor || layerColor;
}

function resolveLinePattern(lineType, scale = 1) {
  if (!lineType) return null;
  const key = String(lineType).toLowerCase();
  if (key.includes("continuous") || key.includes("bylayer") || key.includes("byblock")) {
    return null;
  }
  const scaled = (value) => Math.max(0.001, value * scale);
  if (key.includes("center")) {
    return { dash: scaled(18), gap: scaled(6) };
  }
  if (key.includes("hidden")) {
    return { dash: scaled(6), gap: scaled(4) };
  }
  if (key.includes("phantom")) {
    return { dash: scaled(12), gap: scaled(4) };
  }
  if (key.includes("dot")) {
    return { dash: scaled(2), gap: scaled(4) };
  }
  if (key.includes("dash")) {
    return { dash: scaled(10), gap: scaled(6) };
  }
  return { dash: scaled(8), gap: scaled(4) };
}

function getDocumentMeta() {
  const meta = documentData?.metadata?.meta;
  return meta && typeof meta === "object" ? meta : {};
}

function parseMetaNumber(meta, key) {
  if (!meta || typeof meta !== "object") return null;
  const raw = meta[key];
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

function parseMetaInt(meta, key) {
  if (!meta || typeof meta !== "object") return null;
  const num = Number.parseInt(meta[key], 10);
  return Number.isFinite(num) ? num : null;
}

function parseViewportMeta(meta) {
  const count = parseMetaInt(meta, "dxf.viewport.count") || 0;
  if (count <= 0) return [];
  const layoutFilter = layoutMode ? layoutMode.toLowerCase() : "";
  const viewports = [];
  for (let i = 0; i < count; i += 1) {
    const base = `dxf.viewport.${i}`;
    const space = parseMetaInt(meta, `${base}.space`);
    const centerX = parseMetaNumber(meta, `${base}.center_x`);
    const centerY = parseMetaNumber(meta, `${base}.center_y`);
    const viewCenterX = parseMetaNumber(meta, `${base}.view_center_x`);
    const viewCenterY = parseMetaNumber(meta, `${base}.view_center_y`);
    const width = parseMetaNumber(meta, `${base}.width`);
    const height = parseMetaNumber(meta, `${base}.height`);
    const viewHeight = parseMetaNumber(meta, `${base}.view_height`);
    const twistDeg = parseMetaNumber(meta, `${base}.twist_deg`) ?? 0;
    const id = parseMetaInt(meta, `${base}.id`);
    const layout = String(meta[`${base}.layout`] || "").trim();
    if (space !== 1) continue;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) ||
        !Number.isFinite(viewCenterX) || !Number.isFinite(viewCenterY) ||
        !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(viewHeight)) {
      continue;
    }
    if (width <= 0 || height <= 0 || viewHeight <= 0) continue;
    if (layoutFilter && layout.toLowerCase() !== layoutFilter) continue;
    viewports.push({
      space,
      id,
      layout,
      center: { x: centerX, y: centerY },
      viewCenter: { x: viewCenterX, y: viewCenterY },
      width,
      height,
      viewHeight,
      twistDeg
    });
  }
  return viewports;
}

function buildViewportTransforms(viewports) {
  return viewports.map((vp) => {
    const scale = vp.height / vp.viewHeight;
    const twistRad = vp.twistDeg * (Math.PI / 180);
    const cos = Math.cos(-twistRad);
    const sin = Math.sin(-twistRad);
    const halfW = vp.width * 0.5;
    const halfH = vp.height * 0.5;
    return {
      ...vp,
      scale,
      twistRad,
      cos,
      sin,
      clip: {
        minX: vp.center.x - halfW,
        maxX: vp.center.x + halfW,
        minY: vp.center.y - halfH,
        maxY: vp.center.y + halfH
      }
    };
  });
}

function updateDocumentMetaState() {
  documentMeta = getDocumentMeta();
  const space = parseMetaInt(documentMeta, "dxf.default_space");
  defaultSpace = (space === 0 || space === 1) ? space : null;
  const textHeight = parseMetaNumber(documentMeta, "dxf.default_text_height");
  defaultTextHeight = Number.isFinite(textHeight) && textHeight > 0 ? textHeight : 0;
  viewportEntries = parseViewportMeta(documentMeta);
  viewportTransforms = buildViewportTransforms(viewportEntries);
}

function getSpaceFilter() {
  if (SPACE_FILTER != null) return SPACE_FILTER;
  if (defaultSpace === 0 || defaultSpace === 1) return defaultSpace;
  return null;
}

function shouldUsePaperViewports(spaceFilter = getSpaceFilter()) {
  return PAPER_VIEWPORT_ENABLED && spaceFilter === 1 && viewportTransforms.length > 0;
}

function transformPointToViewport(point, vp) {
  const dx = point.x - vp.viewCenter.x;
  const dy = point.y - vp.viewCenter.y;
  const rx = dx * vp.cos - dy * vp.sin;
  const ry = dx * vp.sin + dy * vp.cos;
  return {
    x: vp.center.x + rx * vp.scale,
    y: vp.center.y + ry * vp.scale,
    z: point.z ?? 0
  };
}

function clipSegmentToRect(ax, ay, bx, by, rect) {
  const LEFT = 1;
  const RIGHT = 2;
  const BOTTOM = 4;
  const TOP = 8;
  const codeFor = (x, y) => {
    let code = 0;
    if (x < rect.minX) code |= LEFT;
    else if (x > rect.maxX) code |= RIGHT;
    if (y < rect.minY) code |= BOTTOM;
    else if (y > rect.maxY) code |= TOP;
    return code;
  };
  let x0 = ax;
  let y0 = ay;
  let x1 = bx;
  let y1 = by;
  let code0 = codeFor(x0, y0);
  let code1 = codeFor(x1, y1);
  while (true) {
    if (!(code0 | code1)) {
      return [x0, y0, x1, y1];
    }
    if (code0 & code1) {
      return null;
    }
    const outCode = code0 ? code0 : code1;
    let x = 0;
    let y = 0;
    if (outCode & TOP) {
      if (y1 === y0) return null;
      x = x0 + (x1 - x0) * (rect.maxY - y0) / (y1 - y0);
      y = rect.maxY;
    } else if (outCode & BOTTOM) {
      if (y1 === y0) return null;
      x = x0 + (x1 - x0) * (rect.minY - y0) / (y1 - y0);
      y = rect.minY;
    } else if (outCode & RIGHT) {
      if (x1 === x0) return null;
      y = y0 + (y1 - y0) * (rect.maxX - x0) / (x1 - x0);
      x = rect.maxX;
    } else if (outCode & LEFT) {
      if (x1 === x0) return null;
      y = y0 + (y1 - y0) * (rect.minX - x0) / (x1 - x0);
      x = rect.minX;
    }
    if (outCode === code0) {
      x0 = x;
      y0 = y;
      code0 = codeFor(x0, y0);
    } else {
      x1 = x;
      y1 = y;
      code1 = codeFor(x1, y1);
    }
  }
}

function resolveLineWidth(slice) {
  const weight = Number.isFinite(slice?.line_weight) && slice.line_weight > 0
    ? slice.line_weight
    : LINE_WEIGHT_DEFAULT;
  const scaled = weight * LINE_WEIGHT_SCALE;
  return Math.min(LINE_WEIGHT_MAX, Math.max(LINE_WEIGHT_MIN, scaled));
}

function resetLineOverlay(keepSource = false) {
  if (!keepSource) {
    lineGeometryData = null;
    lineSource = null;
  }
  if (lineGroup) {
    lineGroup.removeFromParent();
    lineGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  lineGroup = null;
  lineMaterials = [];
}

async function loadLineModules() {
  if (lineModulesReady || lineModulesFailed) return;
  if (lineModulesPromise) {
    await lineModulesPromise;
    return;
  }
  lineModulesPromise = Promise.all([
    import("https://unpkg.com/three@0.160.0/examples/jsm/lines/LineSegments2.js"),
    import("https://unpkg.com/three@0.160.0/examples/jsm/lines/LineSegmentsGeometry.js"),
    import("https://unpkg.com/three@0.160.0/examples/jsm/lines/LineMaterial.js"),
  ])
    .then(([lineSegs, lineGeom, lineMat]) => {
      LineSegments2Ref = lineSegs.LineSegments2;
      LineSegmentsGeometryRef = lineGeom.LineSegmentsGeometry;
      LineMaterialRef = lineMat.LineMaterial;
      lineModulesReady = true;
    })
    .catch((err) => {
      console.error("Line modules failed to load", err);
      lineModulesFailed = true;
    })
    .finally(() => {
      lineModulesPromise = null;
    });
  await lineModulesPromise;
}

function ingestDocumentData(doc) {
  documentData = doc;
  entityIndex = new Map();
  layerColors = new Map();
  if (Array.isArray(doc?.layers)) {
    doc.layers.forEach((layer) => {
      if (layer && Number.isFinite(layer.id)) {
        layerColors.set(layer.id, Number.isFinite(layer.color) ? layer.color : 0);
        layerNames.set(layer.id, typeof layer.name === "string" ? layer.name : "");
      }
    });
  }
  if (Array.isArray(doc?.entities)) {
    doc.entities.forEach((entity) => {
      if (entity && Number.isFinite(entity.id)) {
        entityIndex.set(entity.id, entity);
      }
    });
  }
  updateDocumentMetaState();
  collectTextEntries();
}

function ingestMeshMetadata(meta) {
  meshMetadata = meta;
  meshSlices = Array.isArray(meta?.entities) ? meta.entities : [];
  lineSlices = Array.isArray(meta?.line_entities) ? meta.line_entities : [];
}

function buildLayerInfoFromSlices() {
  if (layerNames.size > 0) return;
  meshSlices.forEach((slice) => {
    if (!slice || !Number.isFinite(slice.layer_id)) return;
    const id = slice.layer_id;
    if (!layerNames.has(id) && typeof slice.layer_name === "string") {
      layerNames.set(id, slice.layer_name);
    }
    if (!layerColors.has(id) && Number.isFinite(slice.layer_color)) {
      layerColors.set(id, slice.layer_color);
    }
  });
}

function renderLayerList() {
  if (!layerListEl) return;
  layerListEl.innerHTML = "";
  const entries = Array.from(layerNames.entries())
    .map(([id, name]) => ({
      id,
      name: name || `Layer ${id}`,
      color: layerColors.get(id)
    }))
    .sort((a, b) => a.id - b.id);

  if (entries.length === 0) {
    const item = document.createElement("li");
    item.className = "layer-item";
    item.innerHTML = "<span class=\"layer-label\">No layer metadata</span>";
    layerListEl.appendChild(item);
    return;
  }

  entries.forEach((layer) => {
    const item = document.createElement("li");
    item.className = "layer-item";
    const swatch = document.createElement("span");
    swatch.className = "layer-swatch";
    if (Number.isFinite(layer.color)) {
      swatch.style.background = colorIntToHex(layer.color);
    }
    const label = document.createElement("span");
    label.className = "layer-label";
    const name = document.createElement("strong");
    name.textContent = layer.name;
    const id = document.createElement("span");
    id.textContent = `#${layer.id}`;
    label.appendChild(swatch);
    label.appendChild(name);
    item.appendChild(label);
    item.appendChild(id);
    layerListEl.appendChild(item);
  });
}

function resetTextOverlay() {
  textEntries = [];
  textLabels = [];
  textFiltered = [];
  textFilteredCount = 0;
  if (textOverlayEl) {
    textOverlayEl.innerHTML = "";
  }
  if (textCanvasCtx && textCanvas) {
    textCanvasCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  }
  updateTextStats();
}

function normalizeTextValue(value) {
  if (!value) return "";
  let out = String(value);
  out = out.replace(/\\P/g, "\n");
  out = out.replace(/\\S([^;]+);/g, (_, body) => {
    const cleaned = body.replace(/[{}]/g, "").replace(/\s+/g, "").replace(/\^/g, "/");
    return cleaned;
  });
  out = out.replace(/\\H[^;]*;/g, "");
  out = out.replace(/\\W[^;]*;/g, "");
  out = out.replace(/\\A\d+;/g, "");
  out = out.replace(/\\C\d+;/g, "");
  out = out.replace(/\\F[^;]*;/g, "");
  out = out.replace(/\\T[^;]*;/g, "");
  out = out.replace(/\\Q[^;]*;/g, "");
  out = out.replace(/\\L/g, "");
  out = out.replace(/\\O/g, "");
  out = out.replace(/[{}]/g, "");
  out = out.replace(/%%d/gi, "deg");
  out = out.replace(/%%p/gi, "+/-");
  out = out.replace(/%%c/gi, "dia");
  return out;
}

function isWideChar(ch) {
  if (!ch) return false;
  const code = ch.codePointAt(0);
  if (code == null) return false;
  return code >= 0x2E80;
}

function estimateTextWidthWorld(entry) {
  if (!entry) return 0;
  if (Number.isFinite(entry.width) && entry.width > 0) {
    return entry.width;
  }
  const height = entry.height > 0
    ? entry.height
    : (defaultTextHeight > 0 ? defaultTextHeight : TEXT_DEFAULT_HEIGHT_WORLD);
  const widthFactor = Number.isFinite(entry.widthFactor) && entry.widthFactor > 0
    ? entry.widthFactor
    : 1.0;
  const lines = entry.value ? entry.value.split("\n") : [""];
  let maxWidth = 0;
  lines.forEach((line) => {
    let width = 0;
    for (const ch of line) {
      width += height * (isWideChar(ch) ? TEXT_WIDE_WIDTH : TEXT_ASCII_WIDTH) * widthFactor;
    }
    if (width > maxWidth) maxWidth = width;
  });
  return maxWidth;
}

function resolveTextAnchor(entity, kind) {
  if (kind === "dimension") {
    return { x: 0.5, y: 0.5 };
  }
  const attachment = Number.isFinite(entity?.text_attachment) ? entity.text_attachment : null;
  if (Number.isFinite(attachment) && attachment >= 1 && attachment <= 9) {
    const index = attachment - 1;
    const col = index % 3;
    const row = Math.floor(index / 3);
    return { x: col / 2, y: row / 2 };
  }

  const halign = Number.isFinite(entity?.text_halign) ? entity.text_halign : 0;
  const valign = Number.isFinite(entity?.text_valign) ? entity.text_valign : 0;
  let col = 0;
  if (halign === 2) {
    col = 2;
  } else if (halign === 1 || halign === 3 || halign === 4 || halign === 5) {
    col = 1;
  }
  let row = 2;
  if (valign === 3) {
    row = 0;
  } else if (valign === 2) {
    row = 1;
  } else if (valign === 1) {
    row = 2;
  }
  return { x: col / 2, y: row / 2 };
}

function collectTextEntries() {
  resetTextOverlay();
  if (!documentData || !Array.isArray(documentData.entities)) return;
  const spaceFilter = getSpaceFilter();
  const useViewports = shouldUsePaperViewports(spaceFilter);
  const viewports = viewportTransforms;
  for (const entity of documentData.entities) {
    if (!entity || entity.type !== CADGF_ENTITY_TYPE_TEXT || !entity.text) continue;
    if (!useViewports && spaceFilter != null && Number.isFinite(entity.space) && entity.space !== spaceFilter) continue;
    if (useViewports && Number.isFinite(entity.space) && entity.space !== 0 && entity.space !== 1) continue;
    const textValue = normalizeTextValue(entity.text.value);
    if (!textValue) continue;
    const dimPos = Array.isArray(entity.dim_text_pos) ? entity.dim_text_pos : null;
    const pos = dimPos ?? entity.text.pos;
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const posX = Number(pos[0]);
    const posY = Number(pos[1]);
    if (!Number.isFinite(posX) || !Number.isFinite(posY)) continue;
    const rotation = Number.isFinite(entity.dim_text_rotation)
      ? entity.dim_text_rotation
      : (Number.isFinite(entity.text.rot) ? entity.text.rot : 0);

    const kind = entity.text_kind || "text";
    const baseHeight = Number.isFinite(entity.text.h) && entity.text.h > 0
      ? entity.text.h
      : (defaultTextHeight > 0 ? defaultTextHeight : 0);
    const baseWidth = Number.isFinite(entity.text_width) ? entity.text_width : 0;
    const widthFactor = Number.isFinite(entity.text_width_factor) && entity.text_width_factor > 0
      ? entity.text_width_factor
      : 1.0;
    const baseEntry = {
      id: entity.id,
      kind,
      value: textValue,
      position: new THREE.Vector3(posX, posY, 0),
      height: baseHeight,
      rotation,
      anchor: resolveTextAnchor(entity, kind),
      width: baseWidth,
      widthFactor,
      valign: Number.isFinite(entity.text_valign) ? entity.text_valign : null,
      lines: textValue.split("\n").length || 1
    };
    if (useViewports && Number.isFinite(entity.space) && entity.space === 0) {
      viewports.forEach((vp) => {
        const mapped = transformPointToViewport(baseEntry.position, vp);
        const entry = {
          ...baseEntry,
          position: new THREE.Vector3(mapped.x, mapped.y, 0),
          height: baseEntry.height > 0 ? baseEntry.height * vp.scale : 0,
          width: baseEntry.width > 0 ? baseEntry.width * vp.scale : 0,
          rotation: rotation - vp.twistRad,
          clip: vp.clip
        };
        textEntries.push(entry);
      });
    } else {
      textEntries.push(baseEntry);
    }
    if (textEntries.length >= TEXT_MAX_ENTRIES) {
      break;
    }
  }
  applyTextFilter(textFilter);
}

function filterTextEntries(entries) {
  if (textFilter === "all") return entries;
  if (textFilter === "text") {
    return entries.filter((entry) => entry.kind !== "dimension");
  }
  return entries.filter((entry) => entry.kind === "dimension");
}

function buildTextOverlay(entries) {
  if (textOverlayEl) {
    textOverlayEl.innerHTML = "";
  }
  textLabels = [];
}

function updateTextStats() {
  if (textOverlayStateEl) {
    textOverlayStateEl.textContent = textOverlayEnabled ? "On" : "Off";
  }
  if (textFilterStateEl) {
    textFilterStateEl.textContent = textFilter;
  }
  if (textEntryCountEl) {
    textEntryCountEl.textContent = textEntries.length.toString();
  }
  if (textVisibleCountEl) {
    textVisibleCountEl.textContent = textFiltered.length.toString();
  }
  if (textCappedCountEl) {
    const capped = Math.max(0, textFilteredCount - textFiltered.length);
    textCappedCountEl.textContent = capped.toString();
  }
}

function setTextOverlayEnabled(enabled) {
  textOverlayEnabled = Boolean(enabled);
  if (textOverlayEl) {
    textOverlayEl.style.display = textOverlayEnabled ? "block" : "none";
  }
  if (textCanvas) {
    textCanvas.style.display = textOverlayEnabled ? "block" : "none";
  }
  if (textToggleBtn) {
    textToggleBtn.classList.toggle("is-active", textOverlayEnabled);
  }
  updateTextStats();
}

function setTextFilter(filter) {
  textFilter = filter;
  if (textFilterDimBtn) textFilterDimBtn.classList.toggle("is-active", textFilter === "dimension");
  if (textFilterTextBtn) textFilterTextBtn.classList.toggle("is-active", textFilter === "text");
  if (textFilterAllBtn) textFilterAllBtn.classList.toggle("is-active", textFilter === "all");
  applyTextFilter(textFilter);
  updateTextStats();
}

function applyTextFilter(filter) {
  const filtered = filterTextEntries(textEntries);
  textFilteredCount = filtered.length;
  textFiltered = filtered.slice(0, TEXT_MAX_LABELS);
  buildTextOverlay(textFiltered);
  updateTextStats();
}

function parseTextOverlayParams(params) {
  const rawFilter = (params.get("text_filter") || "").trim().toLowerCase();
  const filter = ["dimension", "text", "all"].includes(rawFilter) ? rawFilter : "dimension";
  const rawOverlay = (params.get("text_overlay") || "").trim().toLowerCase();
  let enabled = true;
  if (rawOverlay) {
    enabled = !(rawOverlay === "0" || rawOverlay === "false" || rawOverlay === "off" || rawOverlay === "no");
  }
  return { filter, enabled };
}

function updateTextOverlayPositions() {
  if (!textOverlayEnabled || textFiltered.length === 0) return;
  const width = canvas.clientWidth || window.innerWidth || 1;
  const height = canvas.clientHeight || window.innerHeight || 1;
  const margin = 0.02;
  if (!textCanvas) return;
  if (!textCanvasCtx) {
    textCanvasCtx = textCanvas.getContext("2d");
  }
  if (!textCanvasCtx) return;
  const targetW = Math.max(1, Math.floor(width));
  const targetH = Math.max(1, Math.floor(height));
  if (textCanvas.width !== targetW || textCanvas.height !== targetH) {
    textCanvas.width = targetW;
    textCanvas.height = targetH;
  }
  textCanvasCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  textCanvasCtx.save();
  textCanvasCtx.textBaseline = "alphabetic";
  textFiltered.forEach((entry, idx) => {
    if (entry.clip) {
      if (entry.position.x < entry.clip.minX || entry.position.x > entry.clip.maxX ||
          entry.position.y < entry.clip.minY || entry.position.y > entry.clip.maxY) {
        return;
      }
    }
    textProject.copy(entry.position).project(camera);
    if (textProject.z < -1 || textProject.z > 1) {
      return;
    }
    if (textProject.x < -1 - margin || textProject.x > 1 + margin ||
        textProject.y < -1 - margin || textProject.y > 1 + margin) {
      return;
    }
    const x = (textProject.x * 0.5 + 0.5) * width;
    const y = (-textProject.y * 0.5 + 0.5) * height;

    const rot = entry.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const upX = -sin;
    const upY = cos;

    let size = TEXT_DEFAULT_PX;
    let upScreenX = 0;
    let upScreenY = 0;
    if (entry.height > 0) {
      textProject2.copy(entry.position);
      textProject2.x += upX * entry.height;
      textProject2.y += upY * entry.height;
      textProject2.project(camera);
      const x2 = (textProject2.x * 0.5 + 0.5) * width;
      const y2 = (-textProject2.y * 0.5 + 0.5) * height;
      upScreenX = x2 - x;
      upScreenY = y2 - y;
      size = Math.hypot(upScreenX, upScreenY);
    }
    if (size < TEXT_MIN_SCREEN_PX) {
      return;
    }
    size = Math.min(TEXT_MAX_PX, Math.max(TEXT_MIN_PX, size));

    const fontFamily = "IBM Plex Mono, ui-monospace, monospace";
    textCanvasCtx.font = `${size.toFixed(2)}px ${fontFamily}`;

    let widthPx = 0;
    let heightPx = 0;
    const widthWorld = estimateTextWidthWorld(entry);
    if (widthWorld > 0) {
      textProject3.copy(entry.position);
      textProject3.x += cos * widthWorld;
      textProject3.y += sin * widthWorld;
      textProject3.project(camera);
      const x2 = (textProject3.x * 0.5 + 0.5) * width;
      const y2 = (-textProject3.y * 0.5 + 0.5) * height;
      const dist = Math.hypot(x2 - x, y2 - y);
      if (Number.isFinite(dist) && dist > 0) {
        widthPx = dist;
      }
    }
    if (Number.isFinite(widthPx) && widthPx > 0) {
      const measured = textCanvasCtx.measureText(entry.value || "");
      if (Number.isFinite(measured.width) && measured.width > 0) {
        const ratio = widthPx / measured.width;
        if (ratio > 0.25 && ratio < 4) {
          widthPx = measured.width * ratio;
        }
      }
    }
    const baseHeight = entry.height > 0
      ? entry.height
      : (defaultTextHeight > 0 ? defaultTextHeight : TEXT_DEFAULT_HEIGHT_WORLD);
    const heightWorld = baseHeight * Math.max(1, entry.lines || 1) * TEXT_LINE_HEIGHT;
    if (heightWorld > 0) {
      textProject4.copy(entry.position);
      textProject4.x += upX * heightWorld;
      textProject4.y += upY * heightWorld;
      textProject4.project(camera);
      const x2 = (textProject4.x * 0.5 + 0.5) * width;
      const y2 = (-textProject4.y * 0.5 + 0.5) * height;
      const dist = Math.hypot(x2 - x, y2 - y);
      if (Number.isFinite(dist) && dist > 0) {
        heightPx = dist;
      }
    }
    if (!Number.isFinite(widthPx) || widthPx <= 0) widthPx = 1;
    if (!Number.isFinite(heightPx) || heightPx <= 0) heightPx = 1;

    const deg = rot * (180 / Math.PI);
    const offsetX = -entry.anchor.x * widthPx;
    let offsetY = -entry.anchor.y * heightPx;
    if (entry.valign === 0 && entry.kind !== "dimension" && size > 0) {
      const upLen = Math.hypot(upScreenX, upScreenY);
      if (upLen > 0) {
        const shift = size * TEXT_BASELINE_SHIFT;
        offsetY += (upScreenY / upLen) * shift;
        offsetX += (upScreenX / upLen) * shift;
      }
    }
    textCanvasCtx.fillStyle = (TEXT_STYLE_CLEAN && BG_BLACK) ? "#f5f5f5" : "#1e2329";
    textCanvasCtx.save();
    textCanvasCtx.translate(x + offsetX, y + offsetY);
    textCanvasCtx.rotate(rot);
    const lines = entry.value ? entry.value.split("\n") : [""];
    const lineHeight = size * TEXT_LINE_HEIGHT;
    lines.forEach((line, i) => {
      textCanvasCtx.fillText(line, 0, i * lineHeight);
    });
    textCanvasCtx.restore();
  });
  textCanvasCtx.restore();
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function resolveUrl(baseUrl, path) {
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function resolveManifestUrl(manifestParam) {
  if (!manifestParam) return "";
  return resolveUrl(`${window.location.origin}/`, manifestParam);
}

function extractManifestMeta(manifest) {
  if (!manifest || typeof manifest !== "object") return null;
  return {
    projectId: typeof manifest.project_id === "string" ? manifest.project_id.trim() : "",
    documentLabel: typeof manifest.document_label === "string" ? manifest.document_label.trim() : "",
    documentId: typeof manifest.document_id === "string" ? manifest.document_id.trim() : "",
  };
}

function encodeDocumentId(projectId, documentLabel) {
  if (!projectId || !documentLabel) return "";
  const payload = `${projectId}\n${documentLabel}`;
  const bytes = new TextEncoder().encode(payload);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeDocumentId(documentId) {
  if (!documentId) return null;
  const padding = "=".repeat((4 - (documentId.length % 4)) % 4);
  const base64 = (documentId + padding).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const text = new TextDecoder().decode(bytes);
    const split = text.indexOf("\n");
    if (split === -1) return null;
    return {
      projectId: text.slice(0, split),
      documentLabel: text.slice(split + 1),
    };
  } catch {
    return null;
  }
}

function setMetaValue(element, value) {
  if (!element) return;
  const text = value ? value : "n/a";
  element.textContent = text;
  element.classList.toggle("is-empty", !value);
}

function setMetaLink(element, url) {
  if (!element) return;
  if (url) {
    element.textContent = url;
    element.href = url;
    element.classList.remove("is-empty");
    return;
  }
  element.textContent = "n/a";
  element.removeAttribute("href");
  element.classList.add("is-empty");
}

function updateDocumentMeta(params, fallbackMeta = null) {
  let projectId = params.get("project_id")?.trim() ?? "";
  let documentLabel = params.get("document_label")?.trim() ?? "";
  let documentId = params.get("document_id")?.trim() ?? "";
  const fallbackProjectId = fallbackMeta?.projectId ?? "";
  const fallbackDocumentLabel = fallbackMeta?.documentLabel ?? "";
  const fallbackDocumentId = fallbackMeta?.documentId ?? "";

  if (!projectId && fallbackProjectId) {
    projectId = fallbackProjectId;
  }
  if (!documentLabel && fallbackDocumentLabel) {
    documentLabel = fallbackDocumentLabel;
  }
  if (!documentId && fallbackDocumentId) {
    documentId = fallbackDocumentId;
  }

  if ((!projectId || !documentLabel) && documentId) {
    const decoded = decodeDocumentId(documentId);
    if (decoded) {
      projectId = projectId || decoded.projectId;
      documentLabel = documentLabel || decoded.documentLabel;
    }
  }

  if (!documentId && projectId && documentLabel) {
    documentId = encodeDocumentId(projectId, documentLabel);
  }

  setMetaValue(metaProjectIdEl, projectId);
  setMetaValue(metaDocumentLabelEl, documentLabel);
  setMetaValue(metaDocumentIdEl, documentId);

  const manifestParam = params.get("manifest");
  const manifestUrl = resolveManifestUrl(manifestParam);
  setMetaLink(metaManifestEl, manifestUrl);
}

async function loadManifestArtifacts(manifestUrl, manifest) {
  const artifacts = manifest?.artifacts ?? {};
  const tasks = [];
  if (artifacts.document_json) {
    const docUrl = resolveUrl(manifestUrl, artifacts.document_json);
    tasks.push(loadJson(docUrl).then(ingestDocumentData));
  }
  if (artifacts.mesh_metadata) {
    const metaUrl = resolveUrl(manifestUrl, artifacts.mesh_metadata);
    tasks.push(loadJson(metaUrl).then(ingestMeshMetadata));
  }
  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
  buildLayerInfoFromSlices();
  renderLayerList();
  tryApplyMetadata();
}

async function loadFromManifest(manifestUrl, params) {
  setStatus("Loading manifest...");
  resetMetadataState();
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Manifest request failed (${response.status}).`);
  }
  const manifest = await response.json();
  updateDocumentMeta(params, extractManifestMeta(manifest));
  loadManifestArtifacts(manifestUrl, manifest).catch((error) => {
    console.error(error);
  });
  const gltfName = manifest?.artifacts?.mesh_gltf;
  if (!gltfName) {
    throw new Error("Manifest missing artifacts.mesh_gltf.");
  }
  const resolved = resolveUrl(manifestUrl, gltfName);
  gltfUrlInput.value = resolved;
  loadScene(resolved);
}

function updateCounts() {
  let meshCount = 0;
  let vertexCount = 0;
  let triCount = 0;
  selectable.forEach((mesh) => {
    meshCount += 1;
    const geometry = mesh.geometry;
    if (geometry?.attributes?.position) {
      vertexCount += geometry.attributes.position.count;
    }
    if (geometry?.index) {
      triCount += geometry.index.count / 3;
    } else if (geometry?.attributes?.position) {
      triCount += geometry.attributes.position.count / 3;
    }
  });
  meshCountEl.textContent = meshCount.toString();
  vertexCountEl.textContent = vertexCount.toString();
  triangleCountEl.textContent = Math.round(triCount).toString();
}

function clearSelection() {
  if (!selected) return;
  if (selected.userData.originalMaterial) {
    selected.material = selected.userData.originalMaterial;
    selected.userData.originalMaterial = null;
  }
  selected = null;
  selectionInfoEl.innerHTML = "<div class=\"selection__empty\">Click a surface to inspect.</div>";
}

function setSelection(mesh) {
  clearSelection();
  selected = mesh;
  selected.userData.originalMaterial = mesh.material;
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((mat) => mat.clone());
    mesh.material.forEach((mat) => mat.color?.set("#ff8b4a"));
  } else if (mesh.material) {
    mesh.material = mesh.material.clone();
    if (mesh.material.color) {
      mesh.material.color.set("#ff8b4a");
    }
  }

  const geometry = mesh.geometry;
  const verts = geometry?.attributes?.position?.count ?? 0;
  const tris = geometry?.index ? geometry.index.count / 3 : verts / 3;
  const rows = [
    `<div class="selection__row"><span>Name</span><strong>${mesh.name || "Mesh"}</strong></div>`,
    `<div class="selection__row"><span>Vertices</span><strong>${verts}</strong></div>`,
    `<div class="selection__row"><span>Triangles</span><strong>${Math.round(tris)}</strong></div>`
  ];

  const entity = mesh?.userData?.cadgfEntity;
  const slice = mesh?.userData?.cadgfSlice;
  if (entity || slice) {
    const entityId = entity?.id ?? slice?.id;
    const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice?.layer_id;
    if (Number.isFinite(entityId)) {
      rows.push(`<div class="selection__row"><span>Entity ID</span><strong>${entityId}</strong></div>`);
    }
    if (entity?.name) {
      rows.push(`<div class="selection__row"><span>Entity Name</span><strong>${entity.name}</strong></div>`);
    }
    if (Number.isFinite(layerId)) {
      rows.push(`<div class="selection__row"><span>Layer ID</span><strong>${layerId}</strong></div>`);
    }
    const layerName = (Number.isFinite(layerId) && layerNames.get(layerId)) || slice?.layer_name;
    if (layerName) {
      rows.push(`<div class="selection__row"><span>Layer Name</span><strong>${layerName}</strong></div>`);
    }
    const colorSource = entity?.color_source ?? slice?.color_source;
    if (colorSource) {
      rows.push(`<div class="selection__row"><span>Color Source</span><strong>${colorSource}</strong></div>`);
    }
    const colorAci = Number.isFinite(entity?.color_aci) ? entity.color_aci : slice?.color_aci;
    if (Number.isFinite(colorAci)) {
      rows.push(`<div class="selection__row"><span>Color ACI</span><strong>${colorAci}</strong></div>`);
    }
    if (entity || slice || layerId != null) {
      const fallbackLayerColor = Number.isFinite(slice?.layer_color) ? slice.layer_color : null;
      const resolved = resolveEntityColor(entity ?? slice ?? {}, layerId, fallbackLayerColor);
      rows.push(`<div class="selection__row"><span>Resolved Color</span><strong>${colorIntToHex(resolved)}</strong></div>`);
    }
  }

  selectionInfoEl.innerHTML = rows.join("");
}

function resetScene() {
  if (activeScene) {
    scene.remove(activeScene);
    activeScene.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }
  resetLineOverlay();
  annotationGroup.clear();
  annotations.length = 0;
  annotationListEl.innerHTML = "";
  selectable = [];
  activeScene = null;
  clearSelection();
  updateCounts();
}

function applyEntityMaterials(mesh) {
  const geometry = mesh.geometry;
  if (!geometry || !geometry.index || meshSlices.length === 0) return;
  mesh.visible = MESH_VISIBLE;
  if (!MESH_VISIBLE) return;
  geometry.clearGroups();
  const materials = [];
  const previous = mesh.material;
  if (previous) {
    if (Array.isArray(previous)) {
      previous.forEach((mat) => mat?.dispose());
    } else {
      previous.dispose?.();
    }
  }
  meshSlices.forEach((slice) => {
    if (!Number.isFinite(slice.index_offset) || !Number.isFinite(slice.index_count)) return;
    const spaceFilter = getSpaceFilter();
    if (spaceFilter != null && Number.isFinite(slice.space) && slice.space !== spaceFilter) return;
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const material = new THREE.MeshStandardMaterial({
      color: colorIntToHex(colorInt),
      metalness: 0.05,
      roughness: 0.7,
      wireframe: RENDER_WIREFRAME
    });
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    mesh.material = materials;
    const spaceFilter = getSpaceFilter();
    const filtered = spaceFilter == null
      ? meshSlices
      : meshSlices.filter((slice) => !Number.isFinite(slice.space) || slice.space === spaceFilter);
    mesh.userData.cadgfSlices = filtered;
    mesh.visible = true;
  } else {
    mesh.visible = false;
  }
}

function captureLineGeometry(object) {
  if (!object?.isLineSegments || !object.geometry) return;
  const positions = object.geometry.attributes?.position?.array;
  const indices = object.geometry.index?.array;
  if (!positions || !indices) return;
  lineSource = object;
  lineGeometryData = { positions, indices };
}

function buildLineOverlay() {
  if (!LINE_OVERLAY_VISIBLE) {
    if (lineGroup) {
      lineGroup.visible = false;
    }
    if (lineSource) {
      lineSource.visible = false;
    }
    return;
  }
  if (!lineGeometryData || !lineSlices.length || !activeScene) {
    if (lineSource) lineSource.visible = true;
    return;
  }
  if (!lineModulesReady && !lineModulesFailed) {
    loadLineModules().then(() => buildLineOverlay());
    return;
  }
  if (!lineModulesReady) {
    if (lineSource) lineSource.visible = true;
    return;
  }
  if (lineSource) lineSource.visible = true;
  resetLineOverlay(true);
  lineGroup = new THREE.Group();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const spaceFilter = getSpaceFilter();
  const useViewports = shouldUsePaperViewports(spaceFilter);
  const viewports = viewportTransforms;
  const buildPositions = (slice, vp) => {
    const positions = [];
    const start = slice.index_offset;
    const end = slice.index_offset + slice.index_count;
    for (let i = start; i + 1 < end; i += 2) {
      const ia = lineGeometryData.indices[i];
      const ib = lineGeometryData.indices[i + 1];
      if (!Number.isFinite(ia) || !Number.isFinite(ib)) continue;
      const ax = lineGeometryData.positions[ia * 3];
      const ay = lineGeometryData.positions[ia * 3 + 1];
      const az = lineGeometryData.positions[ia * 3 + 2];
      const bx = lineGeometryData.positions[ib * 3];
      const by = lineGeometryData.positions[ib * 3 + 1];
      const bz = lineGeometryData.positions[ib * 3 + 2];
      if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) continue;
      if (vp) {
        const pa = transformPointToViewport({ x: ax, y: ay, z: az }, vp);
        const pb = transformPointToViewport({ x: bx, y: by, z: bz }, vp);
        const clipped = clipSegmentToRect(pa.x, pa.y, pb.x, pb.y, vp.clip);
        if (!clipped) continue;
        positions.push(clipped[0], clipped[1], 0, clipped[2], clipped[3], 0);
      } else {
        positions.push(ax, ay, az ?? 0, bx, by, bz ?? 0);
      }
    }
    return positions;
  };
  const addLineGeometry = (positions, slice) => {
    if (!positions || positions.length < 6) return;
    const geometry = new LineSegmentsGeometryRef();
    geometry.setPositions(positions);
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const lineScale = Number.isFinite(slice.line_type_scale) && slice.line_type_scale > 0
      ? slice.line_type_scale
      : 1.0;
    const pattern = resolveLinePattern(slice.line_type, lineScale);
    const material = new LineMaterialRef({
      color: colorIntToHex(colorInt),
      linewidth: resolveLineWidth(slice),
      worldUnits: true,
      dashed: Boolean(pattern)
    });
    if (pattern) {
      material.dashSize = pattern.dash;
      material.gapSize = pattern.gap;
      material.dashScale = 1;
    }
    material.resolution.set(width, height);
    lineMaterials.push(material);
    const line = new LineSegments2Ref(geometry, material);
    line.computeLineDistances();
    lineGroup.add(line);
  };

  lineSlices.forEach((slice) => {
    if (!Number.isFinite(slice?.index_offset) || !Number.isFinite(slice?.index_count)) return;
    const sliceSpace = Number.isFinite(slice.space) ? slice.space : 0;
    if (!useViewports) {
      if (spaceFilter != null && sliceSpace !== spaceFilter) return;
      addLineGeometry(buildPositions(slice, null), slice);
      return;
    }
    if (sliceSpace === 1) {
      addLineGeometry(buildPositions(slice, null), slice);
      return;
    }
    if (sliceSpace === 0) {
      viewports.forEach((vp) => {
        addLineGeometry(buildPositions(slice, vp), slice);
      });
    }
  });
  if (lineGroup.children.length > 0) {
    activeScene.add(lineGroup);
    if (lineSource) {
      lineSource.visible = false;
    }
    if (useViewports && !hasPaperFrame) {
      frameScene(lineGroup);
      hasPaperFrame = true;
    }
  } else if (lineSource) {
    lineSource.visible = true;
  }
}

function tryApplyMetadata() {
  if (metadataApplied || !activeScene || entityIndex.size === 0) return;
  let hasMeshPrimitive = false;
  activeScene.traverse((child) => {
    if (child.isMesh) {
      applyEntityMaterials(child);
      hasMeshPrimitive = true;
    }
    if (child.isLineSegments) {
      captureLineGeometry(child);
    }
  });
  if (lineSlices.length === 0 && lineGeometryData && !hasMeshPrimitive && meshSlices.length > 0) {
    lineSlices = meshSlices;
  }
  buildLineOverlay();
  metadataApplied = true;
}

function applyRenderOverrides(mesh) {
  if (!RENDER_WIREFRAME || !mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => {
      if (mat) mat.wireframe = true;
    });
  } else {
    mesh.material.wireframe = true;
  }
}

function resolveEntityFromHit(hit) {
  if (!hit || !hit.object) return null;
  const slices = hit.object.userData?.cadgfSlices;
  if (!Array.isArray(slices) || !Number.isFinite(hit.faceIndex)) return null;
  const indexStart = hit.faceIndex * 3;
  const slice = slices.find((s) =>
    Number.isFinite(s.index_offset) &&
    Number.isFinite(s.index_count) &&
    indexStart >= s.index_offset &&
    indexStart < s.index_offset + s.index_count
  );
  if (!slice) return null;
  const entity = entityIndex.get(slice.id) || null;
  return { entity, slice };
}

function frameScene(object) {
  const box = new THREE.Box3().setFromObject(object);
  const sizeVec = box.getSize(new THREE.Vector3());
  const size = sizeVec.length();
  const center = box.getCenter(new THREE.Vector3());
  controls.reset();
  controls.target.copy(center);
  if (USE_ORTHO) {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    const viewSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1);
    orthoHalfHeight = viewSize * 0.6;
    const halfWidth = orthoHalfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = orthoHalfHeight;
    camera.bottom = -orthoHalfHeight;
    camera.near = -viewSize * 10;
    camera.far = viewSize * 10;
    const dist = viewSize * 2;
    if (USE_TOP_VIEW) {
      camera.position.set(center.x, center.y, center.z + dist);
    } else {
      camera.position.set(center.x + dist * 0.6, center.y + dist * 0.5, center.z + dist * 0.7);
    }
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    return;
  }

  if (USE_TOP_VIEW) {
    camera.position.set(center.x, center.y, center.z + size * 1.8);
  } else {
    camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.5, size * 0.7));
  }
  camera.near = Math.max(size / 100, 0.01);
  camera.far = size * 10;
  camera.updateProjectionMatrix();
}

function loadScene(url) {
  setStatus("Loading scene...");
  resetScene();
  loader.load(
    url,
    (gltf) => {
      activeScene = gltf.scene;
      scene.add(activeScene);
      selectable = [];
      activeScene.traverse((child) => {
        if (child.isMesh) {
          selectable.push(child);
          child.castShadow = true;
          child.receiveShadow = true;
          applyRenderOverrides(child);
          if (!MESH_VISIBLE) {
            child.visible = false;
          }
        }
        if (child.isLineSegments) {
          captureLineGeometry(child);
        }
      });
      frameScene(activeScene);
      updateCounts();
      tryApplyMetadata();
      setStatus("Loaded successfully.");
    },
    undefined,
    (error) => {
      console.error(error);
      setStatus("Failed to load glTF.", true);
    }
  );
}

function addAnnotation(point) {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 16),
    new THREE.MeshStandardMaterial({ color: "#ff8b4a" })
  );
  marker.position.copy(point);
  annotationGroup.add(marker);

  const id = `A${annotations.length + 1}`;
  annotations.push({ id, point, marker });
  renderAnnotationList();
}

function renderAnnotationList() {
  annotationListEl.innerHTML = "";
  annotations.forEach((note, idx) => {
    const item = document.createElement("li");
    item.className = "annotation-item";
    const coords = `${note.point.x.toFixed(2)}, ${note.point.y.toFixed(2)}, ${note.point.z.toFixed(2)}`;
    item.innerHTML = `<span>${note.id} * ${coords}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.addEventListener("click", () => {
      annotationGroup.remove(note.marker);
      annotations.splice(idx, 1);
      renderAnnotationList();
    });
    item.appendChild(btn);
    annotationListEl.appendChild(item);
  });
}

function onPointerDown(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(selectable, true);
  if (hits.length === 0) {
    clearSelection();
    return;
  }

  const hit = hits[0];
  if (event.shiftKey) {
    addAnnotation(hit.point);
    return;
  }
  const resolved = resolveEntityFromHit(hit);
  if (resolved) {
    hit.object.userData.cadgfEntity = resolved.entity;
    hit.object.userData.cadgfSlice = resolved.slice;
  } else {
    hit.object.userData.cadgfEntity = null;
    hit.object.userData.cadgfSlice = null;
  }
  setSelection(hit.object);
}

function onResize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (USE_ORTHO) {
    const aspect = width / height;
    const halfWidth = orthoHalfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = orthoHalfHeight;
    camera.bottom = -orthoHalfHeight;
  } else {
    camera.aspect = width / height;
  }
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  if (lineMaterials.length > 0) {
    lineMaterials.forEach((mat) => {
      mat.resolution.set(width, height);
    });
  }
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  updateTextOverlayPositions();
  requestAnimationFrame(animate);
}

loadBtn.addEventListener("click", () => {
  const url = gltfUrlInput.value.trim();
  if (!url) {
    setStatus("Enter a glTF URL.", true);
    return;
  }
  resetMetadataState();
  loadScene(url);
});

window.addEventListener("resize", onResize);
canvas.addEventListener("pointerdown", onPointerDown);
if (textToggleBtn) {
  textToggleBtn.addEventListener("click", () => {
    setTextOverlayEnabled(!textOverlayEnabled);
  });
}
if (textFilterDimBtn) {
  textFilterDimBtn.addEventListener("click", () => setTextFilter("dimension"));
}
if (textFilterTextBtn) {
  textFilterTextBtn.addEventListener("click", () => setTextFilter("text"));
}
if (textFilterAllBtn) {
  textFilterAllBtn.addEventListener("click", () => setTextFilter("all"));
}

async function bootstrapScene() {
  const params = urlParams;
  const textParams = parseTextOverlayParams(params);
  setTextOverlayEnabled(textParams.enabled);
  setTextFilter(textParams.filter);
  const manifestParam = params.get("manifest");
  const manifestUrl = resolveManifestUrl(manifestParam);
  const gltfParam = params.get("gltf");
  updateDocumentMeta(params);
  if (manifestUrl) {
    try {
      await loadFromManifest(manifestUrl, params);
      return;
    } catch (error) {
      console.error(error);
      setStatus("Failed to load manifest.", true);
    }
  }
  if (gltfParam) {
    gltfUrlInput.value = gltfParam;
    resetMetadataState();
    loadScene(gltfParam);
    return;
  }
  const fallback = gltfUrlInput.value.trim();
  if (fallback) {
    resetMetadataState();
    loadScene(fallback);
  }
}

bootstrapScene();
animate();
