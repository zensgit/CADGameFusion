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
let instanceIndex = new Map();
let blockIndex = new Map();
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
let selectedTextEntryKey = null;
let highlightedTextSiblingKeys = new Set();
let currentHighlightInfo = null;
let lastFocusState = null;
let orthoHalfHeight = 1;
const textProject = new THREE.Vector3();
const textProject2 = new THREE.Vector3();
const textProject3 = new THREE.Vector3();
const textProject4 = new THREE.Vector3();

if (typeof window !== "undefined") {
  window.__cadgfPreviewDebug = {
    getVisibleTextEntries() {
      return textFiltered
        .filter((entry) => entry?.screenBounds)
        .map((entry) => ({
          id: Number.isFinite(entry?.id) ? entry.id : null,
          value: entry?.value || "",
          kind: entry?.kind || "text",
          minX: entry?.screenBounds?.minX ?? null,
          minY: entry?.screenBounds?.minY ?? null,
          maxX: entry?.screenBounds?.maxX ?? null,
          maxY: entry?.screenBounds?.maxY ?? null,
        }));
    },
    getHighlightState() {
      return {
        selectedId: currentHighlightInfo?.selectedId ?? null,
        groupId: currentHighlightInfo?.groupId ?? null,
        highlightedSiblingCount: currentHighlightInfo?.siblingIds?.length ?? 0,
        highlightedSiblingIds: Array.isArray(currentHighlightInfo?.siblingIds)
          ? [...currentHighlightInfo.siblingIds]
          : [],
      };
    },
    selectEntityById(entityId, navKind = "debug-select") {
      return focusSelectionEntityId(entityId, navKind);
    },
    focusGroupById(groupId, navKind = "debug-group") {
      return focusSelectionGroupId(groupId, navKind);
    },
    hasEntityId(entityId) {
      return Boolean(resolveSelectionTargetByEntityId(entityId));
    },
    hasGroupId(groupId) {
      return resolveSelectionTargetsByGroupId(groupId).length > 0;
    },
    getLastFocusState() {
      return lastFocusState ? JSON.parse(JSON.stringify(lastFocusState)) : null;
    },
    getLineOverlayState() {
      return (lineGroup?.children || []).map((child) => ({
        name: child?.name || "",
        id: parsePreviewInt(child?.userData?.cadgfSlice?.id ?? child?.userData?.cadgfEntity?.id),
        color: child?.material?.color?.getHexString?.() ?? null,
        linewidth: Number.isFinite(child?.material?.linewidth) ? Number(child.material.linewidth.toFixed(3)) : null,
      }));
    },
  };
}

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
const HIGHLIGHT_SELECTED_COLOR = 0xff8b4a;
const HIGHLIGHT_SELECTED_EMISSIVE = 0x5a2400;
const HIGHLIGHT_SIBLING_COLOR = 0x2f80ed;
const HIGHLIGHT_SIBLING_EMISSIVE = 0x103a66;
const HIGHLIGHT_SELECTED_LINEWIDTH_MULTIPLIER = 1.7;
const HIGHLIGHT_SIBLING_LINEWIDTH_MULTIPLIER = 1.35;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#c0392b" : "#5f6b73";
}

function rebuildSelectableObjects() {
  selectable = [];
  if (activeScene) {
    activeScene.traverse((child) => {
      if (child.isMesh && child.visible !== false) {
        selectable.push(child);
      }
    });
  }
  if (lineGroup?.children?.length) {
    lineGroup.children.forEach((child) => {
      if (child && child.visible !== false) {
        selectable.push(child);
      }
    });
  }
}

function resetMetadataState() {
  meshMetadata = null;
  documentData = null;
  entityIndex = new Map();
  layerColors = new Map();
  layerNames = new Map();
  instanceIndex = new Map();
  blockIndex = new Map();
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

function parsePreviewInt(value) {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) ? num : null;
}

function parsePreviewNumber(value) {
  const num = Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function getMeshMetadataSummary() {
  const summary = meshMetadata?.summary;
  return summary && typeof summary === "object" ? summary : null;
}

function getMeshMetadataLayouts() {
  if (!Array.isArray(meshMetadata?.layouts)) return [];
  return meshMetadata.layouts.filter((layout) => layout && typeof layout === "object");
}

function normalizeLayoutName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getSyntheticPaperLayoutFallback() {
  const paperLayouts = getMeshMetadataLayouts().filter((layout) => {
    const space = parsePreviewInt(layout.space);
    return space === 1 && layout.synthetic === true && normalizeLayoutName(layout.name);
  });
  if (paperLayouts.length !== 1) return "";
  return normalizeLayoutName(paperLayouts[0].name);
}

function matchesLayoutFilter(layoutName) {
  if (!layoutMode) return true;
  const filter = layoutMode.toLowerCase();
  const normalized = normalizeLayoutName(layoutName);
  if (normalized && normalized.toLowerCase() === filter) {
    return true;
  }
  const fallback = getSyntheticPaperLayoutFallback();
  return Boolean(fallback) && fallback.toLowerCase() === filter && !normalized;
}

function parseMeshViewportMeta() {
  if (!Array.isArray(meshMetadata?.viewports)) return [];
  const fallbackLayout = getSyntheticPaperLayoutFallback();
  const viewports = [];
  meshMetadata.viewports.forEach((rawViewport) => {
    if (!rawViewport || typeof rawViewport !== "object") return;
    const space = parsePreviewInt(rawViewport.space);
    const centerX = parsePreviewNumber(rawViewport.center_x);
    const centerY = parsePreviewNumber(rawViewport.center_y);
    const viewCenterX = parsePreviewNumber(rawViewport.view_center_x);
    const viewCenterY = parsePreviewNumber(rawViewport.view_center_y);
    const width = parsePreviewNumber(rawViewport.width);
    const height = parsePreviewNumber(rawViewport.height);
    const viewHeight = parsePreviewNumber(rawViewport.view_height);
    const twistDeg = parsePreviewNumber(rawViewport.twist_deg) ?? 0;
    const id = parsePreviewInt(rawViewport.id);
    const layout = normalizeLayoutName(rawViewport.layout_name ?? rawViewport.layout) || fallbackLayout;
    if (space !== 1) return;
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY) ||
        !Number.isFinite(viewCenterX) || !Number.isFinite(viewCenterY) ||
        !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(viewHeight)) {
      return;
    }
    if (width <= 0 || height <= 0 || viewHeight <= 0) return;
    if (!matchesLayoutFilter(layout)) return;
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
  });
  return viewports;
}

function parseDocumentViewportMeta(meta) {
  const count = parseMetaInt(meta, "dxf.viewport.count") || 0;
  if (count <= 0) return [];
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
    if (!matchesLayoutFilter(layout)) continue;
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
  const summary = getMeshMetadataSummary();
  const space = parsePreviewInt(summary?.default_space) ?? parseMetaInt(documentMeta, "dxf.default_space");
  defaultSpace = (space === 0 || space === 1) ? space : null;
  const textHeight = parseMetaNumber(documentMeta, "dxf.default_text_height");
  defaultTextHeight = Number.isFinite(textHeight) && textHeight > 0 ? textHeight : 0;
  const normalizedViewports = parseMeshViewportMeta();
  viewportEntries = normalizedViewports.length > 0 ? normalizedViewports : parseDocumentViewportMeta(documentMeta);
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

function captureMeshMaterialBase(material) {
  if (!material) return;
  const data = material.userData ?? (material.userData = {});
  if (!Number.isFinite(data.cadgfBaseColor) && material.color) {
    data.cadgfBaseColor = material.color.getHex();
  }
  if (!Number.isFinite(data.cadgfBaseEmissive) && material.emissive) {
    data.cadgfBaseEmissive = material.emissive.getHex();
  }
  if (!Number.isFinite(data.cadgfBaseEmissiveIntensity)) {
    data.cadgfBaseEmissiveIntensity = Number.isFinite(material.emissiveIntensity) ? material.emissiveIntensity : 1;
  }
  if (!Number.isFinite(data.cadgfBaseOpacity)) {
    data.cadgfBaseOpacity = Number.isFinite(material.opacity) ? material.opacity : 1;
  }
  if (typeof data.cadgfBaseTransparent !== "boolean") {
    data.cadgfBaseTransparent = Boolean(material.transparent);
  }
}

function resetMeshMaterialHighlight(material) {
  if (!material) return;
  captureMeshMaterialBase(material);
  const data = material.userData ?? {};
  if (material.color && Number.isFinite(data.cadgfBaseColor)) {
    material.color.setHex(data.cadgfBaseColor);
  }
  if (material.emissive && Number.isFinite(data.cadgfBaseEmissive)) {
    material.emissive.setHex(data.cadgfBaseEmissive);
  }
  if (Number.isFinite(data.cadgfBaseEmissiveIntensity)) {
    material.emissiveIntensity = data.cadgfBaseEmissiveIntensity;
  }
  if (Number.isFinite(data.cadgfBaseOpacity)) {
    material.opacity = data.cadgfBaseOpacity;
  }
  material.transparent = Boolean(data.cadgfBaseTransparent);
}

function applyMeshMaterialHighlight(material, mode) {
  resetMeshMaterialHighlight(material);
  if (!material || !mode) return;
  if (material.color) {
    material.color.setHex(mode === "selected" ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
  }
  if (material.emissive) {
    material.emissive.setHex(mode === "selected" ? HIGHLIGHT_SELECTED_EMISSIVE : HIGHLIGHT_SIBLING_EMISSIVE);
    material.emissiveIntensity = mode === "selected" ? 0.4 : 0.25;
  }
}

function captureLineMaterialBase(material) {
  if (!material) return;
  const data = material.userData ?? (material.userData = {});
  if (!Number.isFinite(data.cadgfBaseColor) && material.color) {
    data.cadgfBaseColor = material.color.getHex();
  }
  if (!Number.isFinite(data.cadgfBaseLinewidth)) {
    data.cadgfBaseLinewidth = Number.isFinite(material.linewidth) ? material.linewidth : resolveLineWidth(null);
  }
  if (!Number.isFinite(data.cadgfBaseOpacity)) {
    data.cadgfBaseOpacity = Number.isFinite(material.opacity) ? material.opacity : 1;
  }
}

function resetLineMaterialHighlight(material) {
  if (!material) return;
  captureLineMaterialBase(material);
  const data = material.userData ?? {};
  if (material.color && Number.isFinite(data.cadgfBaseColor)) {
    material.color.setHex(data.cadgfBaseColor);
  }
  if (Number.isFinite(data.cadgfBaseLinewidth)) {
    material.linewidth = data.cadgfBaseLinewidth;
  }
  if (Number.isFinite(data.cadgfBaseOpacity)) {
    material.opacity = data.cadgfBaseOpacity;
  }
  material.transparent = false;
  material.needsUpdate = true;
}

function applyLineMaterialHighlight(material, mode) {
  resetLineMaterialHighlight(material);
  if (!material || !mode) return;
  const data = material.userData ?? {};
  if (material.color) {
    material.color.setHex(mode === "selected" ? HIGHLIGHT_SELECTED_COLOR : HIGHLIGHT_SIBLING_COLOR);
  }
  const baseWidth = Number.isFinite(data.cadgfBaseLinewidth) ? data.cadgfBaseLinewidth : material.linewidth;
  material.linewidth = baseWidth * (mode === "selected"
    ? HIGHLIGHT_SELECTED_LINEWIDTH_MULTIPLIER
    : HIGHLIGHT_SIBLING_LINEWIDTH_MULTIPLIER);
  material.opacity = 1;
  material.transparent = false;
  material.needsUpdate = true;
}

function clearFragmentHighlights() {
  if (activeScene) {
    activeScene.traverse((child) => {
      if (!child?.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => resetMeshMaterialHighlight(material));
      } else {
        resetMeshMaterialHighlight(child.material);
      }
    });
  }
  if (lineGroup?.children?.length) {
    lineGroup.children.forEach((child) => {
      if (child?.material) {
        resetLineMaterialHighlight(child.material);
      }
    });
  }
  highlightedTextSiblingKeys = new Set();
  currentHighlightInfo = null;
}

function collectVisibleFragmentEntityIds() {
  const ids = new Set();
  if (activeScene) {
    activeScene.traverse((child) => {
      if (!child?.isMesh || child.visible === false) return;
      const slices = Array.isArray(child.userData?.cadgfSlices) ? child.userData.cadgfSlices : [];
      slices.forEach((slice) => {
        const id = parsePreviewInt(slice?.id);
        if (id !== null) {
          ids.add(id);
        }
      });
    });
  }
  if (lineGroup?.children?.length) {
    lineGroup.children.forEach((child) => {
      if (!child || child.visible === false) return;
      const id = parsePreviewInt(child.userData?.cadgfSlice?.id ?? child.userData?.cadgfEntity?.id);
      if (id !== null) {
        ids.add(id);
      }
    });
  }
  if (textOverlayEnabled) {
    textFiltered.forEach((entry) => {
      const id = parsePreviewInt(entry?.id);
      if (id !== null) {
        ids.add(id);
      }
    });
  }
  return ids;
}

function collectGroupEntityIds(groupId, instance = null) {
  const ids = new Set();
  if (groupId === null) return ids;
  if (Array.isArray(instance?.entity_ids)) {
    instance.entity_ids.forEach((value) => {
      const id = parsePreviewInt(value);
      if (id !== null) {
        ids.add(id);
      }
    });
  }
  if (ids.size > 0) return ids;

  entityIndex.forEach((entity, id) => {
    if (selectionGroupId(entity, null) === groupId) {
      ids.add(id);
    }
  });
  if (ids.size > 0) return ids;

  const appendSliceIds = (slices) => {
    slices.forEach((slice) => {
      if (selectionGroupId(null, slice) !== groupId) return;
      const id = parsePreviewInt(slice?.id);
      if (id !== null) {
        ids.add(id);
      }
    });
  };
  appendSliceIds(meshSlices);
  appendSliceIds(lineSlices);
  return ids;
}

function isExplodedInsertFragment(entity, slice) {
  return selectionValue(entity, slice, "source_type") === "INSERT"
    && selectionValue(entity, slice, "edit_mode") === "exploded"
    && selectionValue(entity, slice, "proxy_kind") === "insert";
}

function buildHighlightInfo(entity, slice) {
  const selectedId = parsePreviewInt(entity?.id ?? slice?.id);
  const groupId = selectionGroupId(entity, slice);
  const info = {
    selectedId,
    groupId,
    visibleEntityIds: [],
    siblingIds: [],
    siblingIdSet: new Set(),
    linkedInsertSelection: false,
  };
  if (selectedId === null || groupId === null || !isExplodedInsertFragment(entity, slice)) {
    return info;
  }
  const instance = findSelectionInstance(entity, slice);
  const groupEntityIds = collectGroupEntityIds(groupId, instance);
  const visibleEntityIds = collectVisibleFragmentEntityIds();
  info.visibleEntityIds = [...groupEntityIds].filter((id) => visibleEntityIds.has(id));
  info.siblingIds = info.visibleEntityIds.filter((id) => id !== selectedId);
  info.siblingIdSet = new Set(info.siblingIds);
  info.linkedInsertSelection = true;
  return info;
}

function refreshTextSiblingHighlights(highlightInfo, selectedEntryKey = null) {
  highlightedTextSiblingKeys = new Set();
  if (!highlightInfo?.siblingIdSet?.size) return;
  textFiltered.forEach((entry) => {
    const id = parsePreviewInt(entry?.id);
    if (id === null || !highlightInfo.siblingIdSet.has(id)) return;
    const key = entrySelectionKey(entry);
    if (selectedEntryKey && key === selectedEntryKey) return;
    highlightedTextSiblingKeys.add(key);
  });
}

function applySelectionHighlights(highlightInfo, selectedObject = null, selectedEntryKey = null) {
  clearFragmentHighlights();
  currentHighlightInfo = highlightInfo;
  if (activeScene) {
    activeScene.traverse((child) => {
      if (!child?.isMesh || !child.material) return;
      const slices = Array.isArray(child.userData?.cadgfSlices) ? child.userData.cadgfSlices : [];
      if (!Array.isArray(child.material) || slices.length === 0) {
        const mode = child === selectedObject ? "selected" : null;
        applyMeshMaterialHighlight(child.material, mode);
        return;
      }
      child.material.forEach((material, index) => {
        const slice = slices[index];
        const entityId = parsePreviewInt(slice?.id);
        let mode = null;
        if (entityId !== null && highlightInfo?.selectedId === entityId) {
          mode = "selected";
        } else if (entityId !== null && highlightInfo?.siblingIdSet?.has(entityId)) {
          mode = "sibling";
        }
        applyMeshMaterialHighlight(material, mode);
      });
    });
  }
  if (lineGroup?.children?.length) {
    lineGroup.children.forEach((child) => {
      const entityId = parsePreviewInt(child.userData?.cadgfSlice?.id ?? child.userData?.cadgfEntity?.id);
      let mode = null;
      if (entityId !== null && highlightInfo?.selectedId === entityId) {
        mode = "selected";
      } else if (entityId !== null && highlightInfo?.siblingIdSet?.has(entityId)) {
        mode = "sibling";
      } else if (entityId === null && child === selectedObject) {
        mode = "selected";
      }
      applyLineMaterialHighlight(child.material, mode);
    });
  }
  refreshTextSiblingHighlights(highlightInfo, selectedEntryKey);
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
  instanceIndex = new Map();
  blockIndex = new Map();
  meshSlices = Array.isArray(meta?.entities) ? meta.entities : [];
  lineSlices = Array.isArray(meta?.line_entities) ? meta.line_entities : [];
  if (Array.isArray(meta?.instances)) {
    meta.instances.forEach((instance) => {
      const groupId = parsePreviewInt(instance?.group_id);
      if (groupId !== null) {
        instanceIndex.set(groupId, instance);
      }
    });
  }
  if (Array.isArray(meta?.blocks)) {
    meta.blocks.forEach((block) => {
      const name = typeof block?.name === "string" ? block.name.trim() : "";
      if (name) {
        blockIndex.set(name, block);
      }
    });
  }
  updateDocumentMetaState();
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
  selectedTextEntryKey = null;
  highlightedTextSiblingKeys = new Set();
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
      entity,
      position: new THREE.Vector3(posX, posY, 0),
      height: baseHeight,
      rotation,
      anchor: resolveTextAnchor(entity, kind),
      width: baseWidth,
      widthFactor,
      valign: Number.isFinite(entity.text_valign) ? entity.text_valign : null,
      lines: textValue.split("\n").length || 1,
      screenBounds: null
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
  entries.forEach((entry) => {
    if (entry) entry.screenBounds = null;
  });
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
  const textOnlyFallback = selectable.length === 0 && lineSlices.length === 0;
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
    entry.screenBounds = null;
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
    if (size < TEXT_MIN_SCREEN_PX && !textOnlyFallback) {
      return;
    }
    size = Math.min(TEXT_MAX_PX, Math.max(TEXT_MIN_PX, size));

    const fontFamily = "IBM Plex Mono, ui-monospace, monospace";
    textCanvasCtx.font = `${size.toFixed(2)}px ${fontFamily}`;
    const measured = textCanvasCtx.measureText(entry.value || "");

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
    if (textOnlyFallback) {
      if (!Number.isFinite(widthPx) || widthPx <= 0 || widthPx < measured.width * 0.6) {
        widthPx = Math.max(measured.width, 1);
      }
      const fallbackHeightPx = size * Math.max(1, entry.lines || 1) * TEXT_LINE_HEIGHT;
      if (!Number.isFinite(heightPx) || heightPx <= 0 || heightPx < fallbackHeightPx * 0.6) {
        heightPx = Math.max(fallbackHeightPx, 1);
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
    const drawX = x + offsetX;
    const drawY = y + offsetY;
    entry.screenBounds = {
      minX: drawX - 4,
      minY: drawY - 4,
      maxX: drawX + widthPx + 4,
      maxY: drawY + heightPx + 4
    };
    textCanvasCtx.fillStyle = (TEXT_STYLE_CLEAN && BG_BLACK) ? "#f5f5f5" : "#1e2329";
    const isSelected = selectedTextEntryKey && selectedTextEntryKey === entrySelectionKey(entry);
    const isSiblingHighlighted = highlightedTextSiblingKeys.has(entrySelectionKey(entry));
    if (isSiblingHighlighted && !isSelected) {
      textCanvasCtx.save();
      textCanvasCtx.fillStyle = "rgba(47, 128, 237, 0.14)";
      textCanvasCtx.strokeStyle = "rgba(47, 128, 237, 0.9)";
      textCanvasCtx.lineWidth = 1.25;
      textCanvasCtx.fillRect(entry.screenBounds.minX, entry.screenBounds.minY, widthPx + 8, heightPx + 8);
      textCanvasCtx.strokeRect(entry.screenBounds.minX, entry.screenBounds.minY, widthPx + 8, heightPx + 8);
      textCanvasCtx.restore();
      textCanvasCtx.fillStyle = (TEXT_STYLE_CLEAN && BG_BLACK) ? "#f5f5f5" : "#1e2329";
    }
    if (isSelected) {
      textCanvasCtx.save();
      textCanvasCtx.fillStyle = "rgba(255, 139, 74, 0.16)";
      textCanvasCtx.strokeStyle = "rgba(255, 139, 74, 0.85)";
      textCanvasCtx.lineWidth = 1.5;
      textCanvasCtx.fillRect(entry.screenBounds.minX, entry.screenBounds.minY, widthPx + 8, heightPx + 8);
      textCanvasCtx.strokeRect(entry.screenBounds.minX, entry.screenBounds.minY, widthPx + 8, heightPx + 8);
      textCanvasCtx.restore();
      textCanvasCtx.fillStyle = (TEXT_STYLE_CLEAN && BG_BLACK) ? "#f5f5f5" : "#1e2329";
    }
    textCanvasCtx.save();
    textCanvasCtx.translate(drawX, drawY);
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

function resolveTextEntryHit(localX, localY) {
  if (!textOverlayEnabled || textFiltered.length === 0) return null;
  for (let i = textFiltered.length - 1; i >= 0; i -= 1) {
    const entry = textFiltered[i];
    const bounds = entry?.screenBounds;
    if (!bounds) continue;
    if (localX >= bounds.minX && localX <= bounds.maxX && localY >= bounds.minY && localY <= bounds.maxY) {
      return entry;
    }
  }
  return null;
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
  const results = await Promise.allSettled(tasks);
  const rejected = results.find((one) => one && one.status === "rejected");
  if (rejected?.reason) {
    throw rejected.reason;
  }
  if (rejected) {
    throw new Error("Manifest artifact loading failed.");
  }
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
  await loadManifestArtifacts(manifestUrl, manifest);
  const gltfName = manifest?.artifacts?.mesh_gltf;
  if (!gltfName) {
    gltfUrlInput.value = "";
    resetScene();
    activeScene = new THREE.Group();
    scene.add(activeScene);
    rebuildSelectableObjects();
    frameTextEntries();
    updateCounts();
    setStatus("Loaded document successfully.");
    return;
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
  if (selected?.userData?.originalMaterial) {
    selected.material = selected.userData.originalMaterial;
    selected.userData.originalMaterial = null;
  }
  clearFragmentHighlights();
  selected = null;
  selectedTextEntryKey = null;
  selectionInfoEl.innerHTML = "<div class=\"selection__empty\">Click a surface or text label to inspect.</div>";
}

function selectionValue(entity, slice, key) {
  const raw = entity?.[key] ?? slice?.[key];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (Number.isFinite(raw)) {
    return String(raw);
  }
  return raw ?? null;
}

function pushSelectionRow(rows, label, value) {
  if (value === null || value === undefined || value === "") return;
  rows.push(`<div class="selection__row"><span>${label}</span><strong>${value}</strong></div>`);
}

function buildSelectionOrigin(entity, slice) {
  const sourceType = selectionValue(entity, slice, "source_type");
  const proxyKind = selectionValue(entity, slice, "proxy_kind");
  const editMode = selectionValue(entity, slice, "edit_mode");
  const parts = [];
  if (sourceType && proxyKind) {
    parts.push(`${sourceType}/${proxyKind}`);
  } else if (sourceType) {
    parts.push(sourceType);
  }
  if (editMode) {
    parts.push(editMode);
  }
  return parts.join(" | ");
}

function selectionGroupId(entity, slice) {
  return parsePreviewInt(entity?.group_id ?? slice?.group_id);
}

function findSelectionInstance(entity, slice) {
  const groupId = selectionGroupId(entity, slice);
  if (groupId !== null && instanceIndex.has(groupId)) {
    return instanceIndex.get(groupId);
  }
  return null;
}

function findSelectionBlock(entity, slice, instance = null) {
  const blockName = selectionValue(entity, slice, "block_name")
    || (typeof instance?.block_name === "string" ? instance.block_name.trim() : "");
  if (!blockName) return null;
  return blockIndex.get(blockName) || null;
}

function formatInstanceSummary(instance) {
  if (!instance || typeof instance !== "object") return null;
  const blockName = typeof instance.block_name === "string" ? instance.block_name.trim() : "";
  const groupId = parsePreviewInt(instance.group_id);
  const docCount = parsePreviewInt(instance.document_entity_count);
  const meshCount = parsePreviewInt(instance.mesh_entity_count);
  const lineCount = parsePreviewInt(instance.line_entity_count);
  const parts = [];
  if (blockName) parts.push(blockName);
  if (groupId !== null) parts.push(`group ${groupId}`);
  if (docCount !== null) parts.push(`doc ${docCount}`);
  if (meshCount !== null) parts.push(`mesh ${meshCount}`);
  if (lineCount !== null) parts.push(`line ${lineCount}`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function formatBlockSummary(block) {
  if (!block || typeof block !== "object") return null;
  const instanceCount = parsePreviewInt(block.instance_count);
  const docCount = parsePreviewInt(block.document_entity_count);
  const meshCount = parsePreviewInt(block.mesh_entity_count);
  const lineCount = parsePreviewInt(block.line_entity_count);
  const proxyCount = parsePreviewInt(block.proxy_entity_count);
  const parts = [];
  if (instanceCount !== null) parts.push(`instances ${instanceCount}`);
  if (docCount !== null) parts.push(`doc ${docCount}`);
  if (meshCount !== null) parts.push(`mesh ${meshCount}`);
  if (lineCount !== null) parts.push(`line ${lineCount}`);
  if (proxyCount !== null) parts.push(`proxy ${proxyCount}`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

function formatEntityIdList(values, maxItems = 8) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const ids = values.filter((value) => Number.isFinite(value)).map((value) => String(value));
  if (ids.length === 0) return null;
  if (ids.length <= maxItems) return ids.join(", ");
  return `${ids.slice(0, maxItems).join(", ")} +${ids.length - maxItems} more`;
}

function formatEntityIdChips(values, navKind = "entity", maxItems = 8) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const ids = values
    .filter((value) => Number.isFinite(value))
    .map((value) => Number.parseInt(value, 10));
  if (ids.length === 0) return null;
  const visibleIds = ids.slice(0, maxItems);
  const chips = visibleIds
    .map((id) => `<button type="button" class="selection__chip" data-nav-kind="${navKind}" data-entity-id="${id}">${id}</button>`)
    .join("");
  if (ids.length <= maxItems) return chips;
  return `${chips}<span class="selection__chip-more">+${ids.length - maxItems} more</span>`;
}

function pushHighlightSummary(rows, highlightInfo) {
  if (!highlightInfo?.linkedInsertSelection) return;
  rows.push(
    `<div class="selection__row"><span>Highlighted Sibling Count</span><strong>${highlightInfo.siblingIds.length}</strong></div>`
  );
  const siblingChips = formatEntityIdChips(highlightInfo.siblingIds, "highlighted-sibling");
  if (siblingChips) {
    rows.push(`<div class="selection__row"><span>Highlighted Sibling IDs</span><strong class="selection__chips">${siblingChips}</strong></div>`);
  }
}

function ensureNonZeroBox(box, padding = 0.5) {
  if (!box || box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  if (size.lengthSq() > 0) return box;
  box.expandByVector(new THREE.Vector3(padding, padding, padding));
  return box;
}

function buildTextEntryBox(entry) {
  if (!entry?.position) return null;
  const width = estimateTextWidthWorld(entry);
  const height = (entry.height > 0 ? entry.height : TEXT_DEFAULT_HEIGHT_WORLD) * Math.max(1, entry.lines || 1) * TEXT_LINE_HEIGHT;
  const box = new THREE.Box3();
  box.expandByPoint(entry.position);
  box.expandByPoint(new THREE.Vector3(entry.position.x + width, entry.position.y + height, entry.position.z || 0));
  return ensureNonZeroBox(box, Math.max(entry.height || TEXT_DEFAULT_HEIGHT_WORLD, 0.5));
}

function buildSliceBox(slice) {
  if (!slice || !lineGeometryData?.positions || !lineGeometryData?.indices) return null;
  if (!Number.isFinite(slice.index_offset) || !Number.isFinite(slice.index_count)) return null;
  const box = new THREE.Box3();
  const start = slice.index_offset;
  const end = slice.index_offset + slice.index_count;
  for (let i = start; i < end; i += 1) {
    const index = lineGeometryData.indices[i];
    if (!Number.isFinite(index)) continue;
    const x = lineGeometryData.positions[index * 3];
    const y = lineGeometryData.positions[index * 3 + 1];
    const z = lineGeometryData.positions[index * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    box.expandByPoint(new THREE.Vector3(x, y, Number.isFinite(z) ? z : 0));
  }
  return ensureNonZeroBox(box, 0.5);
}

function buildSelectionTargetBox(target) {
  if (!target) return null;
  if (target.type === "text") {
    return buildTextEntryBox(target.entry);
  }
  if (target.object) {
    const objectBox = ensureNonZeroBox(new THREE.Box3().setFromObject(target.object), 0.5);
    if (objectBox) return objectBox;
  }
  if (target.slice) {
    return buildSliceBox(target.slice);
  }
  return null;
}

function selectionTargetEntityId(target) {
  if (!target) return null;
  return parsePreviewInt(target.entity?.id ?? target.slice?.id ?? target.entry?.id);
}

function snapshotFocusCameraState() {
  return {
    position: {
      x: Number(camera.position.x.toFixed(4)),
      y: Number(camera.position.y.toFixed(4)),
      z: Number(camera.position.z.toFixed(4)),
    },
    target: {
      x: Number(controls.target.x.toFixed(4)),
      y: Number(controls.target.y.toFixed(4)),
      z: Number(controls.target.z.toFixed(4)),
    },
    orthoHalfHeight: Number.isFinite(orthoHalfHeight) ? Number(orthoHalfHeight.toFixed(4)) : null,
  };
}

function serializeFocusBox(box) {
  if (!box || box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    min: {
      x: Number(box.min.x.toFixed(4)),
      y: Number(box.min.y.toFixed(4)),
      z: Number(box.min.z.toFixed(4)),
    },
    max: {
      x: Number(box.max.x.toFixed(4)),
      y: Number(box.max.y.toFixed(4)),
      z: Number(box.max.z.toFixed(4)),
    },
    center: {
      x: Number(center.x.toFixed(4)),
      y: Number(center.y.toFixed(4)),
      z: Number(center.z.toFixed(4)),
    },
    size: {
      x: Number(size.x.toFixed(4)),
      y: Number(size.y.toFixed(4)),
      z: Number(size.z.toFixed(4)),
    },
  };
}

function frameSelectionTargets(targets, navKind = "entity", options = {}) {
  const normalizedTargets = Array.isArray(targets) ? targets.filter(Boolean) : [];
  if (normalizedTargets.length === 0) return false;
  let box = null;
  for (const target of normalizedTargets) {
    const targetBox = buildSelectionTargetBox(target);
    if (!targetBox) continue;
    if (!box) {
      box = targetBox.clone();
    } else {
      box.union(targetBox);
    }
  }
  if (!box) return false;
  const focusBefore = snapshotFocusCameraState();
  const anchor = new THREE.Object3D();
  anchor.position.copy(box.getCenter(new THREE.Vector3()));
  anchor.updateMatrixWorld(true);
  frameScene(anchor, box);
  const primaryTarget = options.primaryTarget || normalizedTargets[0];
  const entity = primaryTarget?.entity ?? null;
  const slice = primaryTarget?.slice ?? null;
  const entry = primaryTarget?.entry ?? null;
  const groupMemberIds = Array.isArray(options.groupMemberIds)
    ? options.groupMemberIds.filter((value) => Number.isFinite(value)).map((value) => Number.parseInt(value, 10))
    : null;
  lastFocusState = {
    navKind,
    targetType: options.targetType || primaryTarget?.type || "object",
    entityId: Number.isFinite(options.entityId) ? Number.parseInt(options.entityId, 10) : selectionTargetEntityId(primaryTarget),
    groupId: Number.isFinite(options.groupId) ? Number.parseInt(options.groupId, 10) : selectionGroupId(entity, slice),
    groupMemberIds,
    box: serializeFocusBox(box),
    cameraBefore: focusBefore,
    cameraAfter: snapshotFocusCameraState(),
  };
  return true;
}

function frameSelectionTarget(target, navKind = "entity") {
  if (!target) return false;
  return frameSelectionTargets([target], navKind, { primaryTarget: target });
}

function resolveSelectionTargetByEntityId(entityId) {
  const normalizedId = parsePreviewInt(entityId);
  if (normalizedId === null) return null;

  if (lineGroup?.children?.length) {
    for (const child of lineGroup.children) {
      if (!child || child.visible === false) continue;
      const id = parsePreviewInt(child.userData?.cadgfSlice?.id ?? child.userData?.cadgfEntity?.id);
      if (id === normalizedId) {
        return {
          type: "object",
          object: child,
          entity: child.userData?.cadgfEntity ?? entityIndex.get(normalizedId) ?? null,
          slice: child.userData?.cadgfSlice ?? null,
        };
      }
    }
  }

  let meshTarget = null;
  if (activeScene) {
    activeScene.traverse((child) => {
      if (meshTarget || !child?.isMesh || child.visible === false) return;
      const slices = Array.isArray(child.userData?.cadgfSlices) ? child.userData.cadgfSlices : [];
      const targetSlice = slices.find((slice) => parsePreviewInt(slice?.id) === normalizedId) || null;
      if (!targetSlice) return;
      meshTarget = {
        type: "object",
        object: child,
        entity: entityIndex.get(normalizedId) || null,
        slice: targetSlice,
      };
    });
  }
  if (meshTarget) return meshTarget;

  const textEntry = textFiltered.find((entry) => parsePreviewInt(entry?.id) === normalizedId)
    || textEntries.find((entry) => parsePreviewInt(entry?.id) === normalizedId);
  if (textEntry) {
    return { type: "text", entry: textEntry };
  }
  return null;
}

function getCurrentSelectionEntityId() {
  if (!selected) return null;
  if (selected?.isMesh) {
    return parsePreviewInt(selected.userData?.cadgfEntity?.id ?? selected.userData?.cadgfSlice?.id);
  }
  return parsePreviewInt(selected?.entity?.id ?? selected?.id);
}

function resolveSelectionTargetsByGroupId(groupId) {
  const normalizedGroupId = parsePreviewInt(groupId);
  if (normalizedGroupId === null) return [];
  const instance = instanceIndex.get(normalizedGroupId);
  const uniqueIds = instance && Array.isArray(instance.entity_ids)
    ? [...new Set(
      instance.entity_ids
        .map((value) => parsePreviewInt(value))
        .filter((value) => value !== null)
    )]
    : [...collectGroupEntityIds(normalizedGroupId, instance)].sort((a, b) => a - b);
  return uniqueIds
    .map((entityId) => resolveSelectionTargetByEntityId(entityId))
    .filter(Boolean);
}

function focusSelectionEntityId(entityId, navKind = "entity") {
  const target = resolveSelectionTargetByEntityId(entityId);
  if (!target) return false;
  if (target.type === "text") {
    setSelectionTextEntry(target.entry);
    frameSelectionTarget(target, navKind);
    return true;
  }
  target.object.userData.cadgfEntity = target.entity;
  target.object.userData.cadgfSlice = target.slice;
  setSelection(target.object);
  frameSelectionTarget(target, navKind);
  return true;
}

function focusSelectionGroupId(groupId, navKind = "group") {
  const normalizedGroupId = parsePreviewInt(groupId);
  if (normalizedGroupId === null) return false;
  const targets = resolveSelectionTargetsByGroupId(normalizedGroupId);
  if (targets.length === 0) return false;
  const currentEntityId = getCurrentSelectionEntityId();
  const primaryTarget = targets.find((target) => selectionTargetEntityId(target) === currentEntityId) || targets[0];
  if (primaryTarget.type === "text") {
    setSelectionTextEntry(primaryTarget.entry);
  } else {
    primaryTarget.object.userData.cadgfEntity = primaryTarget.entity;
    primaryTarget.object.userData.cadgfSlice = primaryTarget.slice;
    setSelection(primaryTarget.object);
  }
  const groupMemberIds = targets
    .map((target) => selectionTargetEntityId(target))
    .filter((value) => value !== null);
  return frameSelectionTargets(targets, navKind, {
    primaryTarget,
    targetType: "group",
    entityId: selectionTargetEntityId(primaryTarget),
    groupId: normalizedGroupId,
    groupMemberIds,
  });
}

function pushSelectionDetails(rows, entity, slice) {
  if (!entity && !slice) return;
  const entityId = entity?.id ?? slice?.id;
  const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice?.layer_id;
  const groupId = selectionGroupId(entity, slice);
  const instance = findSelectionInstance(entity, slice);
  const block = findSelectionBlock(entity, slice, instance);
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
  if (groupId !== null) {
    rows.push(
      `<div class="selection__row"><span>Group ID</span><strong class="selection__chips"><button type="button" class="selection__chip" data-nav-kind="group" data-group-id="${groupId}">${groupId}</button></strong></div>`
    );
  }
  pushSelectionRow(rows, "Instance Summary", formatInstanceSummary(instance));
  const instanceEntityCount = Array.isArray(instance?.entity_ids) ? instance.entity_ids.filter((value) => Number.isFinite(value)).length : null;
  if (instanceEntityCount !== null) {
    rows.push(`<div class="selection__row"><span>Instance Fragment Count</span><strong>${instanceEntityCount}</strong></div>`);
  }
  pushSelectionRow(rows, "Instance Entity IDs", formatEntityIdList(instance?.entity_ids));
  const instanceMemberChips = formatEntityIdChips(instance?.entity_ids, "instance-member");
  if (instanceMemberChips) {
    rows.push(`<div class="selection__row"><span>Instance Member IDs</span><strong class="selection__chips">${instanceMemberChips}</strong></div>`);
  }
  pushSelectionRow(rows, "Block Summary", formatBlockSummary(block));
  const blockInstanceCount = parsePreviewInt(block?.instance_count);
  if (blockInstanceCount !== null) {
    rows.push(`<div class="selection__row"><span>Block Instance Count</span><strong>${blockInstanceCount}</strong></div>`);
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
  pushSelectionRow(rows, "Line Type", selectionValue(entity, slice, "line_type"));
  pushSelectionRow(rows, "Line Weight", selectionValue(entity, slice, "line_weight"));
  pushSelectionRow(rows, "Line Type Scale", selectionValue(entity, slice, "line_type_scale"));
  const origin = buildSelectionOrigin(entity, slice);
  pushSelectionRow(rows, "Origin", origin);
  const editMode = selectionValue(entity, slice, "edit_mode");
  if (editMode === "proxy") {
    rows.push("<div class=\"selection__note\">Derived proxy from DWG/DXF source; preview only.</div>");
  } else if (editMode === "exploded") {
    rows.push("<div class=\"selection__note\">Exploded source fragment; provenance retained in metadata.</div>");
  }
  pushSelectionRow(rows, "Block Name", selectionValue(entity, slice, "block_name"));
  pushSelectionRow(rows, "Hatch ID", selectionValue(entity, slice, "hatch_id"));
  pushSelectionRow(rows, "Hatch Pattern", selectionValue(entity, slice, "hatch_pattern"));
  pushSelectionRow(rows, "Text Kind", selectionValue(entity, slice, "text_kind"));
  pushSelectionRow(rows, "Dim Type", selectionValue(entity, slice, "dim_type"));
  pushSelectionRow(rows, "Dim Style", selectionValue(entity, slice, "dim_style"));
  pushSelectionRow(rows, "Space", selectionValue(entity, slice, "space"));
  pushSelectionRow(rows, "Layout", selectionValue(entity, slice, "layout") ?? selectionValue(entity, slice, "layout_name"));
}

function setSelection(mesh) {
  clearSelection();
  selected = mesh;
  const entity = mesh?.userData?.cadgfEntity ?? null;
  const slice = mesh?.userData?.cadgfSlice ?? null;
  const highlightInfo = buildHighlightInfo(entity, slice);
  applySelectionHighlights(highlightInfo, mesh, null);

  const geometry = mesh.geometry;
  const verts = geometry?.attributes?.position?.count ?? 0;
  const tris = geometry?.index ? geometry.index.count / 3 : verts / 3;
  const rows = [
    `<div class="selection__row"><span>Name</span><strong>${mesh.name || "Mesh"}</strong></div>`,
    `<div class="selection__row"><span>Vertices</span><strong>${verts}</strong></div>`,
    `<div class="selection__row"><span>Triangles</span><strong>${Math.round(tris)}</strong></div>`
  ];

  pushHighlightSummary(rows, highlightInfo);
  pushSelectionDetails(rows, entity, slice);
  selectionInfoEl.innerHTML = rows.join("");
}

function entrySelectionKey(entry) {
  if (!entry) return "";
  const x = Number.isFinite(entry.position?.x) ? entry.position.x.toFixed(4) : "na";
  const y = Number.isFinite(entry.position?.y) ? entry.position.y.toFixed(4) : "na";
  const clip = entry.clip
    ? `${entry.clip.minX.toFixed(3)}:${entry.clip.minY.toFixed(3)}:${entry.clip.maxX.toFixed(3)}:${entry.clip.maxY.toFixed(3)}`
    : "none";
  return `${entry.id ?? "na"}:${entry.kind ?? "text"}:${x}:${y}:${clip}`;
}

function setSelectionTextEntry(entry) {
  clearSelection();
  if (!entry) return;
  selected = entry;
  selectedTextEntryKey = entrySelectionKey(entry);
  const entity = entry.entity ?? entityIndex.get(entry.id) ?? null;
  const highlightInfo = buildHighlightInfo(entity, null);
  applySelectionHighlights(highlightInfo, null, selectedTextEntryKey);
  const rows = [
    `<div class="selection__row"><span>Name</span><strong>${entity?.name || `text_${entry.id ?? "entry"}`}</strong></div>`,
    `<div class="selection__row"><span>Value</span><strong>${entry.value || ""}</strong></div>`,
    `<div class="selection__row"><span>Kind</span><strong>${entry.kind || "text"}</strong></div>`
  ];
  if (Number.isFinite(entry.height) && entry.height > 0) {
    rows.push(`<div class="selection__row"><span>Height</span><strong>${entry.height.toFixed(3)}</strong></div>`);
  }
  pushHighlightSummary(rows, highlightInfo);
  pushSelectionDetails(rows, entity, null);
  selectionInfoEl.innerHTML = rows.join("");
}

selectionInfoEl?.addEventListener("click", (event) => {
  const groupButton = event.target instanceof HTMLElement
    ? event.target.closest("[data-group-id]")
    : null;
  if (groupButton) {
    const groupId = Number.parseInt(groupButton.getAttribute("data-group-id") || "", 10);
    if (!Number.isFinite(groupId)) return;
    const navKind = groupButton.getAttribute("data-nav-kind") || "group";
    focusSelectionGroupId(groupId, navKind);
    return;
  }
  const button = event.target instanceof HTMLElement
    ? event.target.closest("[data-entity-id]")
    : null;
  if (!button) return;
  const entityId = Number.parseInt(button.getAttribute("data-entity-id") || "", 10);
  if (!Number.isFinite(entityId)) return;
  const navKind = button.getAttribute("data-nav-kind") || "entity";
  focusSelectionEntityId(entityId, navKind);
});

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
  lastFocusState = null;
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
    captureMeshMaterialBase(material);
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
    captureLineMaterialBase(material);
    lineMaterials.push(material);
    const line = new LineSegments2Ref(geometry, material);
    line.name = slice?.name || `line_${slice?.id ?? lineGroup.children.length + 1}`;
    line.userData.cadgfSlice = slice;
    line.userData.cadgfEntity = entity;
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
    rebuildSelectableObjects();
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
  rebuildSelectableObjects();
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
  const directSlice = hit.object.userData?.cadgfSlice;
  if (directSlice && typeof directSlice === "object") {
    const directEntity = hit.object.userData?.cadgfEntity ?? entityIndex.get(directSlice.id) ?? null;
    return { entity: directEntity, slice: directSlice };
  }
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

function frameTextEntries() {
  if (!textEntries.length) return;
  const box = new THREE.Box3();
  let hasBounds = false;
  textEntries.forEach((entry) => {
    if (!entry?.position) return;
    const width = estimateTextWidthWorld(entry);
    const height = (entry.height > 0 ? entry.height : TEXT_DEFAULT_HEIGHT_WORLD) * Math.max(1, entry.lines || 1) * TEXT_LINE_HEIGHT;
    box.expandByPoint(entry.position);
    box.expandByPoint(new THREE.Vector3(entry.position.x + width, entry.position.y + height, entry.position.z || 0));
    hasBounds = true;
  });
  if (!hasBounds) return;
  const sizeVec = box.getSize(new THREE.Vector3());
  if (sizeVec.lengthSq() === 0) {
    box.expandByPoint(box.min.clone().addScalar(1));
  }
  const anchor = new THREE.Object3D();
  const center = box.getCenter(new THREE.Vector3());
  anchor.position.copy(center);
  anchor.updateMatrixWorld(true);
  frameScene(anchor, box);
}

function frameScene(object, providedBox = null) {
  const box = providedBox ?? new THREE.Box3().setFromObject(object);
  const sizeVec = box.getSize(new THREE.Vector3());
  const size = Math.max(sizeVec.length(), 1);
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
      activeScene.traverse((child) => {
        if (child.isMesh) {
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
      rebuildSelectableObjects();
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
  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;
  pointer.x = (localX / rect.width) * 2 - 1;
  pointer.y = -(localY / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(selectable, true);
  if (hits.length === 0) {
    const textHit = resolveTextEntryHit(localX, localY);
    if (textHit) {
      setSelectionTextEntry(textHit);
      return;
    }
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
      gltfUrlInput.value = "";
      setStatus("Failed to load manifest.", true);
      return;
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
