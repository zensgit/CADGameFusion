import * as THREE from "./assets/vendor/three/build/three.module.js";
import { OrbitControls } from "./assets/vendor/three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "./assets/vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { LineSegments2 } from "./assets/vendor/three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "./assets/vendor/three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "./assets/vendor/three/examples/jsm/lines/LineMaterial.js";

const canvas = document.getElementById("viewport");
const statusEl = document.getElementById("status");
const gltfUrlInput = document.getElementById("gltf-url");
const loadBtn = document.getElementById("load-btn");
const openCadBtn = document.getElementById("open-cad-btn");
const fitMainBtn = document.getElementById("fit-main-btn");
const fitAllBtn = document.getElementById("fit-all-btn");
const spaceAutoBtn = document.getElementById("space-auto-btn");
const spaceModelBtn = document.getElementById("space-model-btn");
const spacePaperBtn = document.getElementById("space-paper-btn");
const spaceAllBtn = document.getElementById("space-all-btn");
const spaceCountModelEl = document.getElementById("space-count-model");
const spaceCountPaperEl = document.getElementById("space-count-paper");
const spaceCountUnknownEl = document.getElementById("space-count-unknown");
const contrastSoftBtn = document.getElementById("contrast-soft-btn");
const contrastHighBtn = document.getElementById("contrast-high-btn");
const contrastDarkBtn = document.getElementById("contrast-dark-btn");
const outlierHideBtn = document.getElementById("outlier-hide-btn");
const outlierShowBtn = document.getElementById("outlier-show-btn");
const textScaleInput = document.getElementById("text-scale");
const textScaleValueEl = document.getElementById("text-scale-value");
const meshCountEl = document.getElementById("mesh-count");
const vertexCountEl = document.getElementById("vertex-count");
const triangleCountEl = document.getElementById("triangle-count");
const diagEntityCountEl = document.getElementById("diag-entity-count");
const diagTextCountEl = document.getElementById("diag-text-count");
const diagTextVisibleEl = document.getElementById("diag-text-visible");
const diagBoundsEl = document.getElementById("diag-bounds");
const diagFrameSourceEl = document.getElementById("diag-frame-source");
const diagFrameSizeEl = document.getElementById("diag-frame-size");
const diagFrameDistanceEl = document.getElementById("diag-frame-distance");
const diagFrameAspectEl = document.getElementById("diag-frame-aspect");
const selectionInfoEl = document.getElementById("selection-info");
const annotationListEl = document.getElementById("annotation-list");
const layerListEl = document.getElementById("layer-list");
const diffPanelEl = document.getElementById("diff-panel");
const diffEmptyEl = document.getElementById("diff-empty");
const diffControlsEl = document.getElementById("diff-controls");
const diffToggleInputs = Array.from(document.querySelectorAll("[data-diff]"));
const diffOnlyBtn = document.getElementById("diff-only-btn");
const diffAllBtn = document.getElementById("diff-all-btn");
const diffCountEls = {
  added: document.getElementById("diff-count-added"),
  removed: document.getElementById("diff-count-removed"),
  modified_left: document.getElementById("diff-count-modified-left"),
  modified_right: document.getElementById("diff-count-modified-right"),
  unchanged: document.getElementById("diff-count-unchanged")
};
const metaProjectIdEl = document.getElementById("meta-project-id");
const metaDocumentLabelEl = document.getElementById("meta-document-label");
const metaDocumentIdEl = document.getElementById("meta-document-id");
const metaManifestEl = document.getElementById("meta-manifest");
const metaRouterBaseEl = document.getElementById("meta-router-base");
const metaLoadManifestEl = document.getElementById("meta-load-manifest");
const metaLoadGltfEl = document.getElementById("meta-load-gltf");
const metaLoadPreviewEl = document.getElementById("meta-load-preview");
const metaLoadViewerEl = document.getElementById("meta-load-viewer");
const previewCadBtn = document.getElementById("preview-cad-btn");
const previewPdfBtn = document.getElementById("preview-pdf-btn");
const pdfPreviewEl = document.getElementById("pdf-preview");
const pdfFrameEl = document.getElementById("pdf-frame");
const hudEl = document.querySelector(".hud");
const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsForm = document.getElementById("settings-form");
const settingsCloseBtn = document.getElementById("settings-close");
const settingsCancelBtn = document.getElementById("settings-cancel");
const settingsSaveBtn = document.getElementById("settings-save");
const settingsResetBtn = document.getElementById("settings-reset");
const settingsTestRouterBtn = document.getElementById("settings-test-router");
const settingsTestDwgBtn = document.getElementById("settings-test-dwg");
const settingsStatusEl = document.getElementById("settings-status");
const settingsBackdrop = settingsModal?.querySelector("[data-modal-close]");
const settingsFields = {
  routerUrl: document.getElementById("settings-router-url"),
  routerEmit: document.getElementById("settings-router-emit"),
  routerPlugin: document.getElementById("settings-router-plugin"),
  routerConvertCli: document.getElementById("settings-router-convert-cli"),
  routerAuthToken: document.getElementById("settings-router-auth-token"),
  projectId: document.getElementById("settings-project-id"),
  documentLabelPrefix: document.getElementById("settings-document-prefix"),
  routerAutoStart: document.getElementById("settings-router-auto-start"),
  routerStartTimeoutMs: document.getElementById("settings-router-start-timeout"),
  routerTimeoutMs: document.getElementById("settings-router-timeout"),
  previewThresholdMb: document.getElementById("settings-preview-threshold"),
  routerStartCmd: document.getElementById("settings-router-start-cmd"),
  dwgConvertCmd: document.getElementById("settings-dwg-convert-cmd"),
  dwgServicePath: document.getElementById("settings-dwg-service-path"),
  dwg2dxfBin: document.getElementById("settings-dwg2dxf-bin"),
  dwgTimeoutMs: document.getElementById("settings-dwg-timeout"),
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
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
scene.add(grid);

const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let activeScene = null;
let selectable = [];
let lineRenderables = [];
let wideLineRenderables = [];
let wideLineMaterials = new Set();
let selected = null;
const annotationGroup = new THREE.Group();
scene.add(annotationGroup);
const textGroup = new THREE.Group();
scene.add(textGroup);
const hatchGroup = new THREE.Group();
hatchGroup.name = "hatch-group";
scene.add(hatchGroup);
const annotations = [];
const textSprites = [];
const viewportTextSprites = [];
let hatchMeshes = [];
let meshMetadata = null;
let documentData = null;
let entityIndex = new Map();
let layerColors = new Map();
let layerNames = new Map();
let layerMeta = new Map();
let lineTypePatterns = new Map();
let lineTypeLengths = new Map();
let viewportList = [];
let primaryViewport = null;
let viewportOverlayGroup = null;
let viewportOverlayTemplate = null;
let manifestBaseOverride = "";
const loadDetails = {
  routerBase: "",
  manifestUrl: "",
  gltfUrl: "",
  previewUrl: "",
  viewerUrl: "",
};
let lastFrameSource = "n/a";
let hideOutliers = true;
let clipBounds = null;
let outlierClipPlanes = null;
let entityBounds = new Map();
let outlierEntityIds = new Set();
let meshSlices = [];
let metadataApplied = false;
let openCadRequestId = null;
let openCadPreviewLineOnly = false;
let sceneBounds = { full: null, main: null };
let frameBoundsBySpace = { model: null, paper: null, all: null };
let textHeightFallback = 200.0;  // Much larger for CAD drawings with large coordinates
let renderContrast = "dark";
let textScale = 15.0;  // Significantly larger text scale for visibility
let spaceMode = "auto";
let spaceStats = { model: 0, paper: 0, unknown: 0 };
let spaceBounds = { model: null, paper: null };
let resolvedSpace = null;
let activeModelView = null;
let paperSettings = null;
let previewMode = "cad";
let previewPdfUrl = "";
const diffFilters = new Map();
const diffStatusOrder = ["added", "removed", "modified_left", "modified_right", "unchanged"];
const DEFAULT_TEXT_FONT_FAMILY = "\"Noto Sans CJK SC\", \"PingFang SC\", \"Microsoft YaHei\", \"Noto Sans\", \"Helvetica Neue\", Arial, sans-serif";
const LINE_TYPE_PRESETS = [
  { match: ["DASHDOT", "DASH DOT", "DOTDASH"], dash: 1.2, gap: 0.6 },
  { match: ["DASHED", "DASH"], dash: 1.0, gap: 0.5 },
  { match: ["DOT"], dash: 0.2, gap: 0.4 },
];

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#c0392b" : "#5f6b73";
}

function setSettingsStatus(text, isError = false) {
  if (!settingsStatusEl) return;
  settingsStatusEl.textContent = text;
  settingsStatusEl.style.color = isError ? "#c0392b" : "#5f6b73";
}

const SETTINGS_STORAGE_KEY = "vemcad-desktop-settings-v1";
const DEFAULT_DESKTOP_SETTINGS = {
  routerAutoStart: "on",
  dwgHideUi: null,
};

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDesktopSettings(value) {
  const normalized = { ...DEFAULT_DESKTOP_SETTINGS };
  if (!value || typeof value !== "object") {
    return normalized;
  }
  [
    "routerUrl",
    "routerEmit",
    "routerPlugin",
    "routerConvertCli",
    "routerAuthToken",
    "projectId",
    "documentLabelPrefix",
    "routerAutoStart",
    "routerStartTimeoutMs",
    "routerTimeoutMs",
    "previewThresholdMb",
    "routerStartCmd",
    "dwgConvertCmd",
    "dwgServicePath",
    "dwg2dxfBin",
    "dwgTimeoutMs",
    "dwgHideUi",
    "dwgProcessName",
  ].forEach((key) => {
    if (key in value) {
      normalized[key] = value[key];
    }
  });
  if (!["default", "on", "off"].includes(normalized.routerAutoStart)) {
    normalized.routerAutoStart = "default";
  }
  return normalized;
}

function isValueEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function isSettingsEmpty(settings) {
  const normalized = normalizeDesktopSettings(settings);
  const keys = Object.keys(normalized).filter((key) => key !== "routerAutoStart");
  const hasValues = keys.some((key) => !isValueEmpty(normalized[key]));
  if (hasValues) {
    return false;
  }
  return normalized.routerAutoStart === "default";
}

function mergeSettings(baseSettings, fallbackSettings) {
  const merged = normalizeDesktopSettings(baseSettings);
  const fallback = normalizeDesktopSettings(fallbackSettings);
  Object.keys(fallback).forEach((key) => {
    if (isValueEmpty(merged[key]) && !isValueEmpty(fallback[key])) {
      merged[key] = fallback[key];
    }
  });
  const normalized = normalizeDesktopSettings(merged);
  const fallbackAutoStart = fallback.routerAutoStart || "default";
  if (normalized.routerAutoStart === "off" && fallbackAutoStart !== "off") {
    // Keep router auto-start on to avoid manual startup steps in desktop usage.
    normalized.routerAutoStart = "on";
  }
  return normalized;
}

function loadDesktopSettings() {
  if (!window.localStorage) {
    return normalizeDesktopSettings({});
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return normalizeDesktopSettings({});
    }
    return normalizeDesktopSettings(JSON.parse(raw));
  } catch {
    return normalizeDesktopSettings({});
  }
}

function saveDesktopSettings(settings) {
  if (!window.localStorage) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
}

function setFieldValue(field, value) {
  if (!field) return;
  field.value = value ?? "";
}

function getFieldValue(field) {
  return field ? sanitizeText(field.value) : "";
}

function applySettingsToForm(settings) {
  const normalized = normalizeDesktopSettings(settings);
  setFieldValue(settingsFields.routerUrl, normalized.routerUrl || "");
  setFieldValue(settingsFields.routerEmit, normalized.routerEmit || "");
  setFieldValue(settingsFields.routerPlugin, normalized.routerPlugin || "");
  setFieldValue(settingsFields.routerConvertCli, normalized.routerConvertCli || "");
  setFieldValue(settingsFields.routerAuthToken, normalized.routerAuthToken || "");
  setFieldValue(settingsFields.projectId, normalized.projectId || "");
  setFieldValue(settingsFields.documentLabelPrefix, normalized.documentLabelPrefix || "");
  if (settingsFields.routerAutoStart) {
    settingsFields.routerAutoStart.value = normalized.routerAutoStart || "default";
  }
  setFieldValue(settingsFields.routerStartTimeoutMs, normalized.routerStartTimeoutMs || "");
  setFieldValue(settingsFields.routerTimeoutMs, normalized.routerTimeoutMs || "");
  setFieldValue(settingsFields.previewThresholdMb, normalized.previewThresholdMb || "");
  setFieldValue(settingsFields.routerStartCmd, normalized.routerStartCmd || "");
  setFieldValue(settingsFields.dwgConvertCmd, normalized.dwgConvertCmd || "");
  setFieldValue(settingsFields.dwgServicePath, normalized.dwgServicePath || "");
  setFieldValue(settingsFields.dwg2dxfBin, normalized.dwg2dxfBin || "");
  setFieldValue(settingsFields.dwgTimeoutMs, normalized.dwgTimeoutMs || "");
}

async function hydrateSettingsForModal() {
  const stored = loadDesktopSettings();
  let defaults = {};
  if (desktopBridge?.getDefaultSettings) {
    try {
      defaults = await desktopBridge.getDefaultSettings();
    } catch {
      defaults = {};
    }
  }
  const merged = mergeSettings(stored, defaults);
  if (isSettingsEmpty(stored) && !isSettingsEmpty(merged)) {
    saveDesktopSettings(merged);
  }
  applySettingsToForm(merged);
}

function readSettingsFromForm() {
  return normalizeDesktopSettings({
    routerUrl: getFieldValue(settingsFields.routerUrl),
    routerEmit: getFieldValue(settingsFields.routerEmit),
    routerPlugin: getFieldValue(settingsFields.routerPlugin),
    routerConvertCli: getFieldValue(settingsFields.routerConvertCli),
    routerAuthToken: getFieldValue(settingsFields.routerAuthToken),
    projectId: getFieldValue(settingsFields.projectId),
    documentLabelPrefix: getFieldValue(settingsFields.documentLabelPrefix),
    routerAutoStart: getFieldValue(settingsFields.routerAutoStart) || "default",
    routerStartTimeoutMs: getFieldValue(settingsFields.routerStartTimeoutMs),
    routerTimeoutMs: getFieldValue(settingsFields.routerTimeoutMs),
    previewThresholdMb: getFieldValue(settingsFields.previewThresholdMb),
    routerStartCmd: getFieldValue(settingsFields.routerStartCmd),
    dwgConvertCmd: getFieldValue(settingsFields.dwgConvertCmd),
    dwgServicePath: getFieldValue(settingsFields.dwgServicePath),
    dwg2dxfBin: getFieldValue(settingsFields.dwg2dxfBin),
    dwgTimeoutMs: getFieldValue(settingsFields.dwgTimeoutMs),
  });
}

async function openSettingsModal() {
  if (!settingsModal) return;
  await hydrateSettingsForModal();
  setSettingsStatus("Ready.");
  settingsModal.classList.remove("is-hidden");
  document.body.style.overflow = "hidden";
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.add("is-hidden");
  document.body.style.overflow = "";
}

async function resolveDesktopSettings() {
  const stored = loadDesktopSettings();
  let defaults = {};
  if (desktopBridge?.getDefaultSettings) {
    try {
      defaults = await desktopBridge.getDefaultSettings();
    } catch {
      defaults = {};
    }
  }
  const merged = mergeSettings(stored, defaults);
  if (merged.routerAutoStart === "default") {
    merged.routerAutoStart = "on";
  }
  const autoStartForced = stored.routerAutoStart === "off" && merged.routerAutoStart === "on";
  if (autoStartForced || (isSettingsEmpty(stored) && !isSettingsEmpty(merged))) {
    saveDesktopSettings(merged);
  }
  return merged;
}

async function hydrateManifestBaseOverride() {
  if (manifestBaseOverride) return;
  if (!desktopBridge?.getDefaultSettings) return;
  try {
    const defaults = await resolveDesktopSettings();
    if (defaults?.routerUrl && isAbsoluteUrl(defaults.routerUrl)) {
      manifestBaseOverride = defaults.routerUrl;
    }
  } catch {
    // Ignore default settings failures.
  }
  if (manifestBaseOverride) {
    updateLoadDetails({ routerBase: manifestBaseOverride });
  } else {
    updateLoadDetails({ routerBase: resolveBaseUrl() });
  }
}

function resetMetadataState() {
  meshMetadata = null;
  documentData = null;
  viewportList = [];
  activeModelView = null;
  entityIndex = new Map();
  layerColors = new Map();
  layerNames = new Map();
  layerMeta = new Map();
  entityBounds = new Map();
  clipBounds = null;
  outlierClipPlanes = null;
  frameBoundsBySpace = { model: null, paper: null, all: null };
  clearViewportOverlays();
  updateLoadDetails({ manifestUrl: "", gltfUrl: "", previewUrl: "", viewerUrl: window.location.href });
  setPreviewUrl("");
  setPreviewMode("cad");
  meshSlices = [];
  metadataApplied = false;
  renderLayerList();
  updateDiffPanel();
  updateSpaceStats();
  resolvedSpace = resolveSpaceSelection();
  updateSpaceControls();
  updateDiagnostics();
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

const contrastProfiles = {
  soft: {
    background: 0xf6f2ea,
    clearAlpha: 0.0,
    minContrast: 2.2,
    textContrast: 3.2,
    fallbackDark: 0x1e2329,
    fallbackLight: 0xf4f7fb,
    lineColor: 0x1e2730,
    gridOpacity: 0.32,
    isDark: false,
  },
  high: {
    background: 0xfafafa,
    clearAlpha: 1.0,
    minContrast: 4.0,
    textContrast: 4.5,
    fallbackDark: 0x121518,
    fallbackLight: 0xffffff,
    lineColor: 0x111418,
    gridOpacity: 0.18,
    isDark: false,
  },
  dark: {
    background: 0x1e2430,
    clearAlpha: 1.0,
    minContrast: 1.5,
    textContrast: 2.0,
    fallbackDark: 0x1e2329,
    fallbackLight: 0xffffff,
    lineColor: 0xffffff,
    gridOpacity: 0.15,
    isDark: true,
  },
};

function getContrastProfile() {
  return contrastProfiles[renderContrast] || contrastProfiles.soft;
}

function colorToRgb(color) {
  const safe = Number.isFinite(color) ? color : 0;
  return {
    r: (safe >> 16) & 0xff,
    g: (safe >> 8) & 0xff,
    b: safe & 0xff,
  };
}

function rgbToColorInt(r, g, b) {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function relativeLuminance(color) {
  const { r, g, b } = colorToRgb(color);
  const toLinear = (value) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };
  const rLin = toLinear(r);
  const gLin = toLinear(g);
  const bLin = toLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(l1, l2) {
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

function mixColor(a, b, t) {
  const aRgb = colorToRgb(a);
  const bRgb = colorToRgb(b);
  const mix = (av, bv) => Math.round(av + (bv - av) * t);
  return rgbToColorInt(
    mix(aRgb.r, bRgb.r),
    mix(aRgb.g, bRgb.g),
    mix(aRgb.b, bRgb.b)
  );
}

function ensureContrast(color, minRatio) {
  if (!Number.isFinite(color)) return color;
  const profile = getContrastProfile();
  const bgLum = relativeLuminance(profile.background);
  const fgLum = relativeLuminance(color);
  const ratio = contrastRatio(fgLum, bgLum);
  if (ratio >= minRatio) return color;

  const preferDark = bgLum > 0.5;
  const target = preferDark ? profile.fallbackDark : profile.fallbackLight;
  let candidate = color;
  for (let i = 0; i < 5; i += 1) {
    candidate = mixColor(candidate, target, 0.35);
    const nextRatio = contrastRatio(relativeLuminance(candidate), bgLum);
    if (nextRatio >= minRatio) return candidate;
  }
  return target;
}

function adjustColorForCanvas(color) {
  const profile = getContrastProfile();
  // In dark mode, preserve original CAD colors without contrast adjustment
  if (profile.isDark) {
    return Number.isFinite(color) ? color : 0xffffff;
  }
  const minRatio = profile.minContrast || 2.2;
  return ensureContrast(color, minRatio);
}

function resolveTextColor(color) {
  const profile = getContrastProfile();
  // In dark mode, preserve original CAD colors for text
  if (profile.isDark) {
    return Number.isFinite(color) ? color : 0xffffff;
  }
  // Force dark color for text visibility on light backgrounds
  if (!Number.isFinite(color)) return 0x1a1a1a;
  const bgLum = relativeLuminance(profile.background);

  // If background is light (>0.5 luminance), ensure text is dark enough
  if (bgLum > 0.4) {
    const fgLum = relativeLuminance(color);
    // If text color is too light (luminance > 0.6), force to dark
    if (fgLum > 0.6) {
      return 0x1a1a1a;  // Dark gray for readability
    }
  }

  const minRatio = profile.textContrast || Math.max(profile.minContrast || 2.2, 3.2);
  return ensureContrast(color, minRatio);
}

function resolveLineStyleColor() {
  const profile = getContrastProfile();
  const minRatio = profile.minContrast || 2.2;
  return colorIntToHex(ensureContrast(profile.lineColor, minRatio));
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

  let resolved = layerColor;
  if (source === "BYLAYER") {
    resolved = layerColor;
  } else if (source === "INDEX") {
    resolved = aciColor ?? (entityColor || layerColor);
  } else if (source === "TRUECOLOR") {
    resolved = entityColor || aciColor || layerColor;
  } else if (source === "BYBLOCK") {
    resolved = entityColor || aciColor || layerColor;
  } else {
    resolved = entityColor || aciColor || layerColor;
  }
  return adjustColorForCanvas(resolved);
}

function getDiffStatus(entity) {
  return typeof entity?.diff_status === "string" ? entity.diff_status : "";
}

function isDiffVisible(status) {
  if (!status) return true;
  return diffFilters.get(status) ?? true;
}

function setDiffFilter(status, enabled) {
  diffFilters.set(status, enabled);
  const input = diffToggleInputs.find((item) => item.dataset.diff === status);
  if (input) {
    input.checked = enabled;
  }
}

function applyDiffFilters() {
  metadataApplied = false;
  tryApplyMetadata();
  renderTextEntities();
  refreshWideLines();
  refreshHatchMeshes();
}

function updateDiffPanel() {
  if (!diffPanelEl || !diffEmptyEl || !diffControlsEl) return;
  const counts = new Map(diffStatusOrder.map((status) => [status, 0]));
  let hasDiff = false;
  if (Array.isArray(documentData?.entities)) {
    documentData.entities.forEach((entity) => {
      const status = getDiffStatus(entity);
      if (counts.has(status)) {
        counts.set(status, counts.get(status) + 1);
        hasDiff = true;
      }
    });
  }
  diffStatusOrder.forEach((status) => {
    const el = diffCountEls[status];
    if (el) {
      el.textContent = counts.get(status).toString();
    }
  });
  diffEmptyEl.classList.toggle("is-hidden", hasDiff);
  diffControlsEl.classList.toggle("is-hidden", !hasDiff);
}

function normalizeTextValue(value) {
  if (typeof value !== "string") return "";
  let out = value.replace(/\\P/g, "\n").replace(/\\X/g, "\n").replace(/\\~+/g, " ").replace(/\r\n?/g, "\n");
  out = out.replace(/%%[cC]/g, "dia");
  out = out.replace(/%%[dD]/g, "deg");
  out = out.replace(/%%[pP]/g, "+/-");
  out = out.replace(/%%/g, "%");
  out = out.replace(/\\S([^;]*);/g, (_match, inner) => {
    const sep = inner.includes("#") ? "#" : (inner.includes("^") ? "^" : null);
    if (!sep) return inner;
    const parts = inner.split(sep);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return inner;
  });
  out = out.replace(/\\[A-Za-z][^;]*;/g, "");
  out = out.replace(/\\[A-Za-z]/g, "");
  out = out.replace(/[{}]/g, "");
  return out;
}

function resolveTextFontFamily(styleName) {
  const normalized = typeof styleName === "string" ? styleName.trim().toLowerCase() : "";
  if (!normalized) return DEFAULT_TEXT_FONT_FAMILY;
  if (normalized.includes("romans") || normalized.includes("roman") || normalized.includes("times")) {
    return "\"Times New Roman\", \"Songti SC\", serif";
  }
  if (normalized.includes("gothic") || normalized.includes("arial") || normalized.includes("helv")) {
    return DEFAULT_TEXT_FONT_FAMILY;
  }
  if (normalized.includes("simplex") || normalized.includes("iso")) {
    return DEFAULT_TEXT_FONT_FAMILY;
  }
  return DEFAULT_TEXT_FONT_FAMILY;
}

function sanitizeFontFamily(value) {
  if (typeof value !== "string") return DEFAULT_TEXT_FONT_FAMILY;
  const cleaned = value.replace(/[\r\n]/g, " ").trim();
  return cleaned || DEFAULT_TEXT_FONT_FAMILY;
}

function getEntityMetaValue(entityId, key) {
  if (!Number.isFinite(entityId)) return null;
  const meta = documentData?.metadata?.meta;
  if (!meta || typeof meta !== "object") return null;
  const value = meta[`dxf.entity.${entityId}.${key}`];
  return typeof value === "string" ? value : null;
}

function resolveTextAttachmentCenter(attachment) {
  switch (attachment) {
    case 1: return { x: 0, y: 1 };
    case 2: return { x: 0.5, y: 1 };
    case 3: return { x: 1, y: 1 };
    case 4: return { x: 0, y: 0.5 };
    case 5: return { x: 0.5, y: 0.5 };
    case 6: return { x: 1, y: 0.5 };
    case 7: return { x: 0, y: 0 };
    case 8: return { x: 0.5, y: 0 };
    case 9: return { x: 1, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

function getEntitySpace(entity) {
  const space = entity?.space;
  if (!Number.isFinite(space)) return null;
  return space === 0 || space === 1 ? space : null;
}

function readDefaultSpace(doc) {
  const meta = doc?.metadata?.meta;
  if (!meta || typeof meta !== "object") return null;
  const raw = meta["dxf.default_space"];
  if (raw === "1" || raw === 1) return 1;
  if (raw === "0" || raw === 0) return 0;
  return null;
}

function parseMetaNumber(meta, key) {
  if (!meta || typeof meta !== "object") return null;
  const raw = meta[key];
  if (raw === null || raw === undefined) return null;
  const num = Number.parseFloat(raw);
  return Number.isFinite(num) ? num : null;
}

function readPaperSettings(doc) {
  const meta = doc?.metadata?.meta;
  if (!meta || typeof meta !== "object") return null;
  const plimMinX = parseMetaNumber(meta, "dxf.paper.plim_min_x");
  const plimMinY = parseMetaNumber(meta, "dxf.paper.plim_min_y");
  const plimMaxX = parseMetaNumber(meta, "dxf.paper.plim_max_x");
  const plimMaxY = parseMetaNumber(meta, "dxf.paper.plim_max_y");
  const limMinX = parseMetaNumber(meta, "dxf.paper.lim_min_x");
  const limMinY = parseMetaNumber(meta, "dxf.paper.lim_min_y");
  const limMaxX = parseMetaNumber(meta, "dxf.paper.lim_max_x");
  const limMaxY = parseMetaNumber(meta, "dxf.paper.lim_max_y");
  const pinsBaseX = parseMetaNumber(meta, "dxf.paper.pinsbase_x") ?? 0;
  const pinsBaseY = parseMetaNumber(meta, "dxf.paper.pinsbase_y") ?? 0;
  const paperScale = parseMetaNumber(meta, "dxf.paper.psvpscale") ?? 1;

  const hasPlim =
    Number.isFinite(plimMinX) && Number.isFinite(plimMinY) &&
    Number.isFinite(plimMaxX) && Number.isFinite(plimMaxY);
  const hasLim =
    Number.isFinite(limMinX) && Number.isFinite(limMinY) &&
    Number.isFinite(limMaxX) && Number.isFinite(limMaxY);

  if (!hasPlim && !hasLim) return null;

  return {
    plim: hasPlim ? { min: { x: plimMinX, y: plimMinY }, max: { x: plimMaxX, y: plimMaxY } } : null,
    lim: hasLim ? { min: { x: limMinX, y: limMinY }, max: { x: limMaxX, y: limMaxY } } : null,
    pinsBase: { x: pinsBaseX, y: pinsBaseY },
    scale: Number.isFinite(paperScale) && paperScale > 0 ? paperScale : 1,
  };
}


function readLineTypePatterns(doc) {
  const meta = doc?.metadata?.meta;
  const patterns = new Map();
  const lengths = new Map();
  if (!meta || typeof meta !== "object") return { patterns, lengths };
  const prefix = "dxf.linetype.";
  const patternSuffix = ".pattern";
  const lengthSuffix = ".length";
  Object.entries(meta).forEach(([key, value]) => {
    if (!key.startsWith(prefix)) return;
    if (key.endsWith(patternSuffix)) {
      const name = key.slice(prefix.length, -patternSuffix.length);
      const normalized = normalizeLineType(name);
      if (!normalized) return;
      const raw = typeof value === "string" ? value : (Number.isFinite(value) ? String(value) : "");
      const parts = raw.split(",").map((item) => Number.parseFloat(item)).filter((num) => Number.isFinite(num));
      if (parts.length > 0) {
        patterns.set(normalized, parts);
      }
      return;
    }
    if (key.endsWith(lengthSuffix)) {
      const name = key.slice(prefix.length, -lengthSuffix.length);
      const normalized = normalizeLineType(name);
      if (!normalized) return;
      const raw = typeof value === "string" ? value : (Number.isFinite(value) ? String(value) : "");
      const length = Number.parseFloat(raw);
      if (Number.isFinite(length)) {
        lengths.set(normalized, length);
      }
    }
  });
  return { patterns, lengths };
}

function buildPaperFrameBounds(limit, pins, scale) {
  if (!limit || !pins) return null;
  const min = limit.min;
  const max = limit.max;
  if (!min || !max) return null;
  const sizeX = max.x - min.x;
  const sizeY = max.y - min.y;
  if (!Number.isFinite(sizeX) || !Number.isFinite(sizeY) || sizeX <= 0 || sizeY <= 0) return null;
  const minX = (min.x - pins.x) / scale;
  const minY = (min.y - pins.y) / scale;
  const maxX = (max.x - pins.x) / scale;
  const maxY = (max.y - pins.y) / scale;
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return new THREE.Box3(
    new THREE.Vector3(minX, minY, 0),
    new THREE.Vector3(maxX, maxY, 0)
  );
}

function scorePaperFrame(candidate, reference) {
  if (!candidate || candidate.isEmpty()) return Number.POSITIVE_INFINITY;
  if (!reference || reference.isEmpty()) return 0;
  const areaCandidate = getSpaceArea(candidate);
  const areaReference = getSpaceArea(reference);
  if (!Number.isFinite(areaCandidate) || !Number.isFinite(areaReference) || areaCandidate <= 0 || areaReference <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const ratio = areaCandidate / areaReference;
  let score = Math.abs(Math.log(ratio));
  if (!candidate.containsBox(reference)) {
    score += 2;
  }
  return score;
}

function readViewportList(doc) {
  const meta = doc?.metadata?.meta;
  if (!meta || typeof meta !== "object") return [];
  const countRaw = meta["dxf.viewport.count"];
  const count = Number.parseInt(countRaw, 10);
  if (!Number.isFinite(count) || count <= 0) return [];
  let viewports = [];
  for (let i = 0; i < count; i += 1) {
    const base = `dxf.viewport.${i}.`;
    const space = Number.parseInt(meta[`${base}space`], 10);
    if (space !== 1) continue;
    const centerX = parseMetaNumber(meta, `${base}center_x`);
    const centerY = parseMetaNumber(meta, `${base}center_y`);
    const width = parseMetaNumber(meta, `${base}width`);
    const height = parseMetaNumber(meta, `${base}height`);
    const viewCenterX = parseMetaNumber(meta, `${base}view_center_x`);
    const viewCenterY = parseMetaNumber(meta, `${base}view_center_y`);
    const viewHeight = parseMetaNumber(meta, `${base}view_height`);
    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) continue;
    if (!Number.isFinite(viewCenterX) || !Number.isFinite(viewCenterY)) continue;
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) continue;
    if (!Number.isFinite(viewHeight) || viewHeight <= 0) continue;
    const twistDeg = parseMetaNumber(meta, `${base}twist_deg`) ?? 0;
    const id = Number.parseInt(meta[`${base}id`], 10);
    const layout = typeof meta[`${base}layout`] === "string" ? meta[`${base}layout`] : "";
    viewports.push({
      id: Number.isFinite(id) ? id : null,
      center: { x: centerX, y: centerY },
      width,
      height,
      viewCenter: { x: viewCenterX, y: viewCenterY },
      viewHeight,
      twistDeg,
      layout,
    });
  }
  if (viewports.length > 1) {
    const filtered = viewports.filter((viewport) => viewport.id !== 1);
    if (filtered.length > 0) {
      viewports = filtered;
    }
  }
  return viewports;
}

function buildViewportBounds(viewport) {
  if (!viewport) return null;
  const halfW = viewport.width * 0.5;
  const halfH = viewport.height * 0.5;
  if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) return null;
  if (halfW <= 0 || halfH <= 0) return null;
  return new THREE.Box3(
    new THREE.Vector3(viewport.center.x - halfW, viewport.center.y - halfH, 0),
    new THREE.Vector3(viewport.center.x + halfW, viewport.center.y + halfH, 0)
  );
}

function computeBoundsOverlapArea(a, b) {
  if (!a || !b || a.isEmpty() || b.isEmpty()) return 0;
  const minX = Math.max(a.min.x, b.min.x);
  const minY = Math.max(a.min.y, b.min.y);
  const maxX = Math.min(a.max.x, b.max.x);
  const maxY = Math.min(a.max.y, b.max.y);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function filterPaperViewports(viewports, paperFrame) {
  if (!Array.isArray(viewports) || viewports.length === 0) return [];
  if (!paperFrame || paperFrame.isEmpty()) return viewports;
  const filtered = viewports.filter((viewport) => {
    const bounds = buildViewportBounds(viewport);
    const area = getSpaceArea(bounds);
    if (!bounds || area <= 0) return false;
    const overlap = computeBoundsOverlapArea(bounds, paperFrame);
    return overlap / area >= 0.02;
  });
  return filtered.length > 0 ? filtered : viewports;
}

function selectPrimaryViewport(viewports, paperFrame) {
  if (!Array.isArray(viewports) || viewports.length === 0) return null;
  if (viewports.length === 1) return viewports[0];
  let best = null;
  let bestScore = -Infinity;
  viewports.forEach((viewport) => {
    const bounds = buildViewportBounds(viewport);
    const area = getSpaceArea(bounds);
    if (!bounds || area <= 0) return;
    let score = area;
    if (paperFrame && !paperFrame.isEmpty()) {
      const overlap = computeBoundsOverlapArea(bounds, paperFrame);
      const ratio = area > 0 ? overlap / area : 0;
      score = ratio * 1000 + area;
    }
    if (score > bestScore) {
      bestScore = score;
      best = viewport;
    }
  });
  return best || viewports[0];
}

function readActiveModelView(doc) {
  const meta = doc?.metadata?.meta;
  if (!meta || typeof meta !== "object") return null;
  const centerX = parseMetaNumber(meta, "dxf.vport.active.center_x");
  const centerY = parseMetaNumber(meta, "dxf.vport.active.center_y");
  const viewHeight = parseMetaNumber(meta, "dxf.vport.active.view_height");
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;
  if (!Number.isFinite(viewHeight) || viewHeight <= 0) return null;
  const aspect = parseMetaNumber(meta, "dxf.vport.active.aspect");
  return {
    center: { x: centerX, y: centerY },
    viewHeight,
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : null,
  };
}

function resolveActiveModelViewBounds(spaceFilter) {
  if (spaceFilter !== 0 || !activeModelView) return null;
  const height = activeModelView.viewHeight;
  if (!Number.isFinite(height) || height <= 0) return null;
  const aspect = activeModelView.aspect || (camera?.aspect || 1);
  const width = height * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const center = activeModelView.center;
  return new THREE.Box3(
    new THREE.Vector3(center.x - halfW, center.y - halfH, 0),
    new THREE.Vector3(center.x + halfW, center.y + halfH, 0)
  );
}

function resolvePaperFrameBounds() {
  if (!paperSettings) return null;
  const scale = paperSettings.scale || 1;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const pins = paperSettings.pinsBase || { x: 0, y: 0 };
  const plimBounds = buildPaperFrameBounds(paperSettings.plim, pins, scale);
  const limBounds = buildPaperFrameBounds(paperSettings.lim, pins, scale);
  if (!plimBounds) return limBounds;
  if (!limBounds) return plimBounds;
  const reference = (spaceBounds?.paper && !spaceBounds.paper.isEmpty())
    ? spaceBounds.paper
    : (spaceBounds?.model && !spaceBounds.model.isEmpty() ? spaceBounds.model : null);
  const scorePlim = scorePaperFrame(plimBounds, reference);
  const scoreLim = scorePaperFrame(limBounds, reference);
  if (scorePlim === scoreLim) {
    const areaPlim = getSpaceArea(plimBounds);
    const areaLim = getSpaceArea(limBounds);
    return areaLim >= areaPlim ? limBounds : plimBounds;
  }
  return scorePlim < scoreLim ? plimBounds : limBounds;
}

function updateSpaceStats() {
  let model = 0;
  let paper = 0;
  let unknown = 0;
  if (Array.isArray(documentData?.entities)) {
    documentData.entities.forEach((entity) => {
      const space = getEntitySpace(entity);
      if (space === 0) {
        model += 1;
      } else if (space === 1) {
        paper += 1;
      } else {
        unknown += 1;
      }
    });
  }
  let viewportBounds = null;
  if (viewportList.length > 0) {
    viewportBounds = new THREE.Box3();
    viewportList.forEach((viewport) => {
      const halfW = viewport.width * 0.5;
      const halfH = viewport.height * 0.5;
      if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) return;
      const min = new THREE.Vector3(viewport.center.x - halfW, viewport.center.y - halfH, 0);
      const max = new THREE.Vector3(viewport.center.x + halfW, viewport.center.y + halfH, 0);
      viewportBounds.union(new THREE.Box3(min, max));
    });
    if (viewportBounds.isEmpty()) {
      viewportBounds = null;
    }
  }
  if (viewportList.length > 0 && paper === 0) {
    paper = viewportList.length;
  }
  spaceStats = { model, paper, unknown };
  const paperBounds = computeDocumentRobustBounds(1);
  spaceBounds = {
    model: computeDocumentRobustBounds(0),
    paper: paperBounds && !paperBounds.isEmpty() ? paperBounds : viewportBounds,
  };
  if (spaceCountModelEl) spaceCountModelEl.textContent = model.toString();
  if (spaceCountPaperEl) spaceCountPaperEl.textContent = paper.toString();
  if (spaceCountUnknownEl) spaceCountUnknownEl.textContent = unknown.toString();
  if (documentData) {
    clipBounds = computeDocumentClipBounds(resolvedSpace);
    refreshOutlierClipPlanes();
  }
}

function getSpaceArea(bounds) {
  if (!bounds || bounds.isEmpty()) return 0;
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y)) return 0;
  return Math.abs(size.x * size.y);
}

function chooseBounds(primary, fallback, minRatio = 0.2, maxRatio = 5.0) {
  if (!primary || primary.isEmpty()) return fallback;
  if (!fallback || fallback.isEmpty()) return primary;
  const primaryArea = getSpaceArea(primary);
  const fallbackArea = getSpaceArea(fallback);
  if (primaryArea > 0 && fallbackArea > 0) {
    if (primaryArea < fallbackArea * minRatio) {
      return fallback;
    }
    if (primaryArea > fallbackArea * maxRatio) {
      return fallback;
    }
  }
  const primaryCenter = primary.getCenter(new THREE.Vector3());
  const fallbackCenter = fallback.getCenter(new THREE.Vector3());
  const fallbackSize = fallback.getSize(new THREE.Vector3());
  const fallbackSpan = Math.max(fallbackSize.x, fallbackSize.y);
  if (fallbackSpan > 0) {
    const offset = primaryCenter.distanceTo(fallbackCenter);
    if (offset > fallbackSpan * 0.2 && primaryArea < fallbackArea * 0.8) {
      return fallback;
    }
  }
  return primary;
}

function isOversizedBounds(candidate, reference, maxRatio) {
  if (!candidate || candidate.isEmpty()) return false;
  if (!reference || reference.isEmpty()) return false;
  const candidateArea = getSpaceArea(candidate);
  const referenceArea = getSpaceArea(reference);
  if (candidateArea <= 0 || referenceArea <= 0) return false;
  return candidateArea > referenceArea * maxRatio;
}

function computeSpaceScore(space) {
  const count = spaceStats[space] || 0;
  if (!count) return 0;
  const bounds = spaceBounds[space];
  const area = getSpaceArea(bounds);
  if (!Number.isFinite(area) || area <= 0) return count;
  return count * Math.log10(area + 10);
}

function resolveSpaceSelection() {
  if (spaceMode === "all") return null;
  if (spaceMode === "model") return 0;
  if (spaceMode === "paper") return 1;
  const defaultSpace = readDefaultSpace(documentData);
  const modelScore = computeSpaceScore("model");
  const paperScore = computeSpaceScore("paper");
  if (defaultSpace !== null) {
    const defaultScore = defaultSpace === 0 ? modelScore : paperScore;
    const altScore = defaultSpace === 0 ? paperScore : modelScore;
    if (defaultScore > 0 && defaultScore >= altScore * 0.5) {
      return defaultSpace;
    }
  }
  if (paperScore > modelScore) return 1;
  if (modelScore > 0) return 0;
  if (paperScore > 0) return 1;
  return null;
}

function updateSpaceControls() {
  const buttons = [
    { btn: spaceAutoBtn, mode: "auto" },
    { btn: spaceModelBtn, mode: "model" },
    { btn: spacePaperBtn, mode: "paper" },
    { btn: spaceAllBtn, mode: "all" },
  ];
  buttons.forEach(({ btn, mode }) => {
    if (!btn) return;
    btn.classList.toggle("is-active", spaceMode === mode);
  });
}

function isLayerRenderable(layerId) {
  if (!Number.isFinite(layerId)) return true;
  const meta = layerMeta.get(layerId);
  if (!meta) return true;
  if (meta.visible === 0) return false;
  if (meta.frozen === 1) return false;
  if (meta.construction === 1) return false;
  if (meta.printable === 0) return false;
  return true;
}

function isBoundsVisible(entity) {
  if (!hideOutliers || !clipBounds || clipBounds.isEmpty()) return true;
  if (!entity || !Number.isFinite(entity.id)) return true;
  if (outlierEntityIds.has(entity.id)) return false;
  const bounds = entityBounds.get(entity.id);
  if (!bounds) return true;
  const minX = bounds.min.x;
  const minY = bounds.min.y;
  const maxX = bounds.max.x;
  const maxY = bounds.max.y;
  if (maxX < clipBounds.min.x || minX > clipBounds.max.x) return false;
  if (maxY < clipBounds.min.y || minY > clipBounds.max.y) return false;
  return true;
}

function isEntityVisible(entity, slice = null) {
  const diffVisible = isDiffVisible(getDiffStatus(entity));
  const spaceVisible = isSpaceVisible(entity, slice);
  const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice?.layer_id;
  const layerVisible = isLayerRenderable(layerId);
  return diffVisible && spaceVisible && layerVisible && isBoundsVisible(entity);
}

function setSpaceMode(mode) {
  spaceMode = mode;
  resolvedSpace = resolveSpaceSelection();
  updateSpaceControls();
  clipBounds = computeDocumentClipBounds(resolvedSpace);
  refreshOutlierClipPlanes();
  metadataApplied = false;
  tryApplyMetadata();
  renderTextEntities();
  refreshWideLines();
  refreshHatchMeshes();
  refreshViewportOverlays();
  frameSpace();
}

function isSpaceVisible(entity, slice = null) {
  const space = getEntitySpace(entity) ?? (Number.isFinite(slice?.space) ? slice.space : null);
  if (resolvedSpace === null) return true;
  if (!Number.isFinite(space)) return true;
  return space === resolvedSpace;
}

function isSpaceVisibleFor(spaceFilter, entity, slice = null) {
  const space = getEntitySpace(entity) ?? (Number.isFinite(slice?.space) ? slice.space : null);
  if (spaceFilter === null) return true;
  if (!Number.isFinite(space)) return true;
  return space === spaceFilter;
}

function isEntityVisibleForSpace(entity, slice, spaceFilter) {
  const diffVisible = isDiffVisible(getDiffStatus(entity));
  const spaceVisible = isSpaceVisibleFor(spaceFilter, entity, slice);
  const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice?.layer_id;
  const layerVisible = isLayerRenderable(layerId);
  return diffVisible && spaceVisible && layerVisible;
}

function clearTextSprites() {
  if (!textGroup) return;
  textSprites.forEach((entry) => {
    if (entry?.sprite) {
      textGroup.remove(entry.sprite);
    }
    if (entry?.material) {
      entry.material.map?.dispose();
      entry.material.dispose();
    }
  });
  textSprites.length = 0;
  textGroup.clear();
}

function clearHatchMeshes() {
  if (hatchGroup) hatchGroup.clear();
  hatchMeshes.forEach((mesh) => {
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
  hatchMeshes = [];
}

function clearViewportTextSprites() {
  viewportTextSprites.forEach((entry) => {
    if (entry?.sprite && entry?.parent) {
      entry.parent.remove(entry.sprite);
    }
    if (entry?.material) {
      entry.material.map?.dispose();
      entry.material.dispose();
    }
  });
  viewportTextSprites.length = 0;
}

function disposeOverlayGroup(group) {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh || isLineObject(child)) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat?.dispose());
      } else {
        child.material?.dispose?.();
      }
    }
  });
}

function clearViewportOverlays() {
  clearViewportTextSprites();
  if (viewportOverlayGroup) {
    disposeOverlayGroup(viewportOverlayGroup);
    scene.remove(viewportOverlayGroup);
  }
  viewportOverlayGroup = null;
  viewportOverlayTemplate = null;
}

function wrapLineToWidth(line, ctx, maxWidth) {
  if (!line) return [""];
  if (ctx.measureText(line).width <= maxWidth) return [line];
  const out = [];
  let buffer = "";
  for (const ch of line) {
    const next = buffer + ch;
    if (buffer && ctx.measureText(next).width > maxWidth) {
      out.push(buffer);
      buffer = ch;
    } else {
      buffer = next;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

function createTextSprite(text, height, rotation, colorHex, visible, layout = {}) {
  const safeText = normalizeTextValue(text).trim();
  if (!safeText) return null;
  const fontPx = 64;
  const lineHeight = Math.round(fontPx * 1.2);
  const padding = Math.round(fontPx * 0.25);
  const fontFamily = sanitizeFontFamily(layout.fontFamily || DEFAULT_TEXT_FONT_FAMILY);
  const rawLines = safeText.split("\n");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.font = `${fontPx}px ${fontFamily}`;
  const widthWorld = Number.isFinite(layout.width) ? layout.width : null;
  let maxAspect = 18;
  if (Number.isFinite(widthWorld) && Number.isFinite(height) && height > 0) {
    const ratio = widthWorld / height;
    if (Number.isFinite(ratio) && ratio > 0) {
      maxAspect = Math.min(Math.max(ratio, 0.5), 60);
    }
  }
  const maxLineWidthPx = Math.round(fontPx * maxAspect);
  const lines = [];
  rawLines.forEach((line) => {
    lines.push(...wrapLineToWidth(line, ctx, maxLineWidthPx));
  });
  let maxWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  });
  canvas.width = Math.ceil(maxWidth + padding * 2);
  canvas.height = Math.ceil(lineHeight * lines.length + padding * 2);

  ctx.font = `${fontPx}px ${fontFamily}`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = "bottom";
  const startY = canvas.height - padding;
  lines.forEach((line, idx) => {
    const y = startY - (lines.length - 1 - idx) * lineHeight;
    ctx.fillText(line, padding, y);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: visible ? 1 : 0.15
  });
  material.rotation = rotation || 0;

  const sprite = new THREE.Sprite(material);
  const baseHeight = Number.isFinite(height) && height > 0 ? height : textHeightFallback;
  const minHeight = Math.max(textHeightFallback * 0.05, 0.3);
  const safeHeight = Math.max(baseHeight, minHeight) * textScale;
  const aspect = canvas.width > 0 ? canvas.width / canvas.height : 1;
  sprite.scale.set(safeHeight * aspect, safeHeight, 1);
  if (Number.isFinite(layout.attachment)) {
    const anchor = resolveTextAttachmentCenter(layout.attachment);
    sprite.center.set(anchor.x, anchor.y);
  } else {
    sprite.center.set(0, 0);
  }
  sprite.renderOrder = 10;
  return { sprite, material };
}

function renderTextEntities() {
  clearTextSprites();
  if (!documentData || !Array.isArray(documentData.entities)) return;
  documentData.entities.forEach((entity) => {
    const textInfo = entity?.text;
    if (!textInfo || !Array.isArray(textInfo.pos)) return;
    const value = normalizeTextValue(textInfo.value || "");
    if (!value) return;
    const [x, y] = textInfo.pos;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const height = Number.isFinite(textInfo.h) ? textInfo.h : 0;
    const rotation = Number.isFinite(textInfo.rot) ? textInfo.rot : 0;
    const fallbackLayerColor = Number.isFinite(textInfo.layer_color) ? textInfo.layer_color : null;
    const resolvedColor = resolveEntityColor(entity ?? {}, entity?.layer_id, fallbackLayerColor);
    const textColor = resolveTextColor(resolvedColor);
    const colorHex = colorIntToHex(textColor);
    const diffStatus = getDiffStatus(entity);
    const visible = isEntityVisible(entity);
    const metaWidth = getEntityMetaValue(entity?.id, "text_width");
    const metaAttachment = getEntityMetaValue(entity?.id, "text_attachment");
    const metaStyle = getEntityMetaValue(entity?.id, "text_style");
    const width = metaWidth !== null ? Number.parseFloat(metaWidth) : null;
    const attachment = metaAttachment !== null ? Number.parseInt(metaAttachment, 10) : null;
    const fontFamily = resolveTextFontFamily(metaStyle);
    const layout = {
      width: Number.isFinite(width) ? width : null,
      attachment: Number.isFinite(attachment) ? attachment : null,
      fontFamily,
    };
    const spriteEntry = createTextSprite(value, height, rotation, colorHex, visible, layout);
    if (!spriteEntry) return;
    const { sprite, material } = spriteEntry;
    sprite.position.set(x, y, 0);
    textGroup.add(sprite);
    textSprites.push({ sprite, material });
  });
  updateDiagnostics();
}

function parseHatchIdFromName(name) {
  if (typeof name !== "string") return null;
  const match = name.match(/__cadgf_hatch:(\d+)/);
  if (!match) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) ? id : null;
}

function polylineToVector2(points) {
  return points.map((pt) => new THREE.Vector2(pt[0], pt[1]));
}

function computeSignedArea(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [x1, y1] = points[j];
    const [x2, y2] = points[i];
    area += x1 * y2 - x2 * y1;
  }
  return area * 0.5;
}

function refreshHatchMeshes() {
  clearHatchMeshes();
  if (!hatchGroup || !documentData || !Array.isArray(documentData.entities)) return;
  const hatchMap = new Map();
  documentData.entities.forEach((entity) => {
    const hatchId = parseHatchIdFromName(entity?.name);
    if (!Number.isFinite(hatchId)) return;
    if (!Array.isArray(entity.polyline)) return;
    const points = entity.polyline.filter((pt) =>
      Array.isArray(pt) &&
      pt.length >= 2 &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
    );
    if (points.length < 3) return;
    if (!hatchMap.has(hatchId)) hatchMap.set(hatchId, []);
    hatchMap.get(hatchId).push({ entity, points });
  });
  hatchMap.forEach((loops, hatchId) => {
    const loopsWithArea = loops
      .map((loop) => ({ ...loop, area: computeSignedArea(loop.points) }))
      .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    const outer = loopsWithArea[0];
    if (!outer) return;
    const visible = isEntityVisible(outer.entity);
    if (!visible) return;
    const colorInt = resolveEntityColor(outer.entity ?? {}, outer.entity?.layer_id ?? null, null);
    const material = new THREE.MeshBasicMaterial({
      color: colorInt,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    });
    applyOutlierClipping(material);
    const outerVec = polylineToVector2(outer.points);
    if (!THREE.ShapeUtils.isClockWise(outerVec)) outerVec.reverse();
    const shape = new THREE.Shape(outerVec);
    loopsWithArea.slice(1).forEach((loop) => {
      const holeVec = polylineToVector2(loop.points);
      if (THREE.ShapeUtils.isClockWise(holeVec)) holeVec.reverse();
      shape.holes.push(new THREE.Path(holeVec));
    });
    const geometry = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -1;
    mesh.userData.cadgfHatch = { id: hatchId, entityId: outer.entity?.id ?? null };
    hatchGroup.add(mesh);
    hatchMeshes.push(mesh);
  });
}

function refreshHatchOutlierClipping() {
  if (!Array.isArray(hatchMeshes) || hatchMeshes.length === 0) return;
  hatchMeshes.forEach((mesh) => {
    const material = mesh?.material;
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach((mat) => applyOutlierClipping(mat));
    } else {
      applyOutlierClipping(material);
    }
  });
}

function buildViewportTransform(viewport) {
  if (!viewport) return null;
  const scale = viewport.height / viewport.viewHeight;
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const twistRad = Number.isFinite(viewport.twistDeg) ? viewport.twistDeg * (Math.PI / 180) : 0;
  const cos = Math.cos(twistRad);
  const sin = Math.sin(twistRad);
  const m00 = cos * scale;
  const m01 = -sin * scale;
  const m10 = sin * scale;
  const m11 = cos * scale;
  const tx = viewport.center.x - (m00 * viewport.viewCenter.x + m01 * viewport.viewCenter.y);
  const ty = viewport.center.y - (m10 * viewport.viewCenter.x + m11 * viewport.viewCenter.y);
  const matrix = new THREE.Matrix4();
  matrix.set(
    m00, m01, 0, tx,
    m10, m11, 0, ty,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
  return { matrix, scale, twistRad, m00, m01, m10, m11, tx, ty };
}

function buildViewportClipPlanes(viewport, transform) {
  if (!viewport || !transform) return [];
  const halfW = viewport.width * 0.5;
  const halfH = viewport.height * 0.5;
  if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) return [];
  const cos = Math.cos(transform.twistRad || 0);
  const sin = Math.sin(transform.twistRad || 0);
  const ux = new THREE.Vector3(cos, sin, 0);
  const uy = new THREE.Vector3(-sin, cos, 0);
  const center = new THREE.Vector3(viewport.center.x, viewport.center.y, 0);
  const rightPoint = center.clone().add(ux.clone().multiplyScalar(halfW));
  const leftPoint = center.clone().add(ux.clone().multiplyScalar(-halfW));
  const topPoint = center.clone().add(uy.clone().multiplyScalar(halfH));
  const bottomPoint = center.clone().add(uy.clone().multiplyScalar(-halfH));
  return [
    new THREE.Plane().setFromNormalAndCoplanarPoint(ux.clone(), rightPoint),
    new THREE.Plane().setFromNormalAndCoplanarPoint(ux.clone().negate(), leftPoint),
    new THREE.Plane().setFromNormalAndCoplanarPoint(uy.clone(), topPoint),
    new THREE.Plane().setFromNormalAndCoplanarPoint(uy.clone().negate(), bottomPoint)
  ];
}

function applyViewportClipping(group, viewport, transform) {
  const planesWorld = buildViewportClipPlanes(viewport, transform);
  if (!planesWorld.length) return;
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (!(child.isMesh || isLineObject(child) || child.isSprite)) return;
    if (!child.material) return;
    const inverse = new THREE.Matrix4().copy(child.matrixWorld).invert();
    const localPlanes = planesWorld.map((plane) => plane.clone().applyMatrix4(inverse));
    const applyToMaterial = (material) => {
      material.clippingPlanes = localPlanes;
      material.clipIntersection = true;
      material.needsUpdate = true;
    };
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        if (material) applyToMaterial(material);
      });
    } else {
      applyToMaterial(child.material);
    }
  });
}

function buildViewportOverlayTemplate() {
  if (!activeScene) return null;
  const template = activeScene.clone(true);
  template.traverse((child) => {
    if (child.isMesh) {
      applyEntityMaterialsForSpace(child, 0);
    } else if (isLineObject(child)) {
      child.visible = true;
      applyLineSliceMaterialsForSpace(child, 0);
    }
  });
  return template;
}

function renderViewportTextEntities(transform, group) {
  if (!documentData || !Array.isArray(documentData.entities)) return;
  documentData.entities.forEach((entity) => {
    if (getEntitySpace(entity) !== 0) return;
    const textInfo = entity?.text;
    if (!textInfo || !Array.isArray(textInfo.pos)) return;
    const value = normalizeTextValue(textInfo.value || "");
    if (!value) return;
    const [x, y] = textInfo.pos;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const height = Number.isFinite(textInfo.h) ? textInfo.h : 0;
    const rotation = Number.isFinite(textInfo.rot) ? textInfo.rot : 0;
    const fallbackLayerColor = Number.isFinite(textInfo.layer_color) ? textInfo.layer_color : null;
    const resolvedColor = resolveEntityColor(entity ?? {}, entity?.layer_id, fallbackLayerColor);
    const textColor = resolveTextColor(resolvedColor);
    const colorHex = colorIntToHex(textColor);
    const visible = isEntityVisibleForSpace(entity, null, 0);
    const metaWidth = getEntityMetaValue(entity?.id, "text_width");
    const metaAttachment = getEntityMetaValue(entity?.id, "text_attachment");
    const metaStyle = getEntityMetaValue(entity?.id, "text_style");
    const width = metaWidth !== null ? Number.parseFloat(metaWidth) : null;
    const attachment = metaAttachment !== null ? Number.parseInt(metaAttachment, 10) : null;
    const fontFamily = resolveTextFontFamily(metaStyle);
    const layout = {
      width: Number.isFinite(width) ? width * transform.scale : null,
      attachment: Number.isFinite(attachment) ? attachment : null,
      fontFamily,
    };
    const spriteEntry = createTextSprite(
      value,
      height * transform.scale,
      rotation + transform.twistRad,
      colorHex,
      visible,
      layout
    );
    if (!spriteEntry) return;
    const { sprite, material } = spriteEntry;
    const x2 = transform.m00 * x + transform.m01 * y + transform.tx;
    const y2 = transform.m10 * x + transform.m11 * y + transform.ty;
    sprite.position.set(x2, y2, 0);
    group.add(sprite);
    viewportTextSprites.push({ sprite, material, parent: group });
  });
}

function refreshViewportOverlays() {
  clearViewportOverlays();
  primaryViewport = null;
  if (!activeScene || resolvedSpace !== 1 || viewportList.length === 0) return;
  const paperFrame = resolvePaperFrameBounds();
  const filteredViewports = filterPaperViewports(viewportList, paperFrame);
  const selectedViewport = selectPrimaryViewport(filteredViewports, paperFrame);
  if (!selectedViewport) return;
  primaryViewport = selectedViewport;
  const template = buildViewportOverlayTemplate();
  if (!template) return;
  viewportOverlayTemplate = template;
  viewportOverlayGroup = new THREE.Group();
  viewportOverlayGroup.name = "viewport-overlays";
  const transform = buildViewportTransform(selectedViewport);
  if (!transform) return;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(transform.matrix);
  const modelClone = template.clone(true);
  group.add(modelClone);
  renderViewportTextEntities(transform, group);
  group.updateMatrixWorld(true);
  applyViewportClipping(group, selectedViewport, transform);
  viewportOverlayGroup.add(group);
  scene.add(viewportOverlayGroup);
}

function computeEntityBounds(entity) {
  if (!entity) return null;
  const bounds = new THREE.Box3();
  let hasBounds = false;
  const expandPoint = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const point = new THREE.Vector3(x, y, 0);
    if (!hasBounds) {
      bounds.min.copy(point);
      bounds.max.copy(point);
      hasBounds = true;
    } else {
      bounds.expandByPoint(point);
    }
  };
  const type = entity.type;
  if (type === 0 && Array.isArray(entity.polyline)) {
    entity.polyline.forEach((pt) => {
      if (Array.isArray(pt)) expandPoint(pt[0], pt[1]);
    });
  } else if (type === 1 && Array.isArray(entity.point)) {
    expandPoint(entity.point[0], entity.point[1]);
  } else if (type === 2 && Array.isArray(entity.line)) {
    entity.line.forEach((pt) => {
      if (Array.isArray(pt)) expandPoint(pt[0], pt[1]);
    });
  } else if (type === 3 && entity.arc) {
    const center = entity.arc.c;
    const radius = entity.arc.r;
    if (Array.isArray(center) && Number.isFinite(radius)) {
      const steps = 16;
      let start = entity.arc.a0;
      let end = entity.arc.a1;
      if (entity.arc.cw) {
        if (end > start) end -= Math.PI * 2;
      } else if (end < start) {
        end += Math.PI * 2;
      }
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const angle = start + (end - start) * t;
        expandPoint(center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius);
      }
    }
  } else if (type === 4 && entity.circle) {
    const center = entity.circle.c;
    const radius = entity.circle.r;
    if (Array.isArray(center) && Number.isFinite(radius)) {
      expandPoint(center[0] - radius, center[1] - radius);
      expandPoint(center[0] + radius, center[1] + radius);
    }
  } else if (type === 5 && entity.ellipse) {
    const center = entity.ellipse.c;
    if (Array.isArray(center)) {
      const rx = entity.ellipse.rx;
      const ry = entity.ellipse.ry;
      if (Number.isFinite(rx) && Number.isFinite(ry) && rx > 0 && ry > 0) {
        let start = Number.isFinite(entity.ellipse.a0) ? entity.ellipse.a0 : 0;
        let end = Number.isFinite(entity.ellipse.a1) ? entity.ellipse.a1 : Math.PI * 2;
        if (end < start) end += Math.PI * 2;
        const steps = 20;
        const cosRot = Math.cos(entity.ellipse.rot || 0);
        const sinRot = Math.sin(entity.ellipse.rot || 0);
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const angle = start + (end - start) * t;
          const x = Math.cos(angle) * rx;
          const y = Math.sin(angle) * ry;
          const xr = x * cosRot - y * sinRot;
          const yr = x * sinRot + y * cosRot;
          expandPoint(center[0] + xr, center[1] + yr);
        }
      }
    }
  } else if (type === 6 && entity.spline?.control) {
    entity.spline.control.forEach((pt) => {
      if (Array.isArray(pt)) expandPoint(pt[0], pt[1]);
    });
  } else if (type === 7 && entity.text?.pos) {
    const pos = entity.text.pos;
    if (Array.isArray(pos)) expandPoint(pos[0], pos[1]);
  }
  return hasBounds ? bounds : null;
}


function ingestDocumentData(doc) {
  documentData = doc;
  viewportList = readViewportList(doc);
  activeModelView = readActiveModelView(doc);
  paperSettings = readPaperSettings(doc);
  const lineTypeData = readLineTypePatterns(doc);
  lineTypePatterns = lineTypeData.patterns;
  lineTypeLengths = lineTypeData.lengths;
  entityIndex = new Map();
  layerColors = new Map();
  entityBounds = new Map();
  if (Array.isArray(doc?.layers)) {
    doc.layers.forEach((layer) => {
    if (layer && Number.isFinite(layer.id)) {
      layerColors.set(layer.id, Number.isFinite(layer.color) ? layer.color : 0);
      layerNames.set(layer.id, typeof layer.name === "string" ? layer.name : "");
      layerMeta.set(layer.id, {
        visible: Number.isFinite(layer.visible) ? layer.visible : 1,
        frozen: Number.isFinite(layer.frozen) ? layer.frozen : 0,
        printable: Number.isFinite(layer.printable) ? layer.printable : 1,
        construction: Number.isFinite(layer.construction) ? layer.construction : 0,
      });
    }
  });
  }
  if (Array.isArray(doc?.entities)) {
    doc.entities.forEach((entity) => {
      if (entity && Number.isFinite(entity.id)) {
        entityIndex.set(entity.id, entity);
        const bounds = computeEntityBounds(entity);
        if (bounds) {
          entityBounds.set(entity.id, bounds);
        }
      }
    });
  }
  updateDiffPanel();
  updateSpaceStats();
  resolvedSpace = resolveSpaceSelection();
  updateSpaceControls();
  updateFrameBounds();
  clipBounds = computeDocumentClipBounds(resolvedSpace);
  refreshOutlierClipPlanes();
  updateDiagnostics();
  if (meshSlices.length > 0) {
    metadataApplied = false;
    tryApplyMetadata();
  }
  // Update textHeightFallback BEFORE rendering text entities
  const docBoundsForText = computeDocumentBounds(resolvedSpace);
  if (docBoundsForText && !docBoundsForText.isEmpty()) {
    updateTextHeightFallback(docBoundsForText);
  }
  renderTextEntities();
  refreshHatchMeshes();
  refreshViewportOverlays();
  if (activeScene) {
    frameSpace();
  }
}

function ingestMeshMetadata(meta) {
  meshMetadata = meta;
  meshSlices = Array.isArray(meta?.entities) ? meta.entities : [];
  refreshWideLines();
  refreshViewportOverlays();
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

function isAbsoluteUrl(url) {
  if (!url) return false;
  return /^(?:https?:|file:)/i.test(url);
}

function resolveBaseUrl() {
  if (manifestBaseOverride) {
    return manifestBaseOverride.endsWith("/") ? manifestBaseOverride : `${manifestBaseOverride}/`;
  }
  const origin = window.location.origin;
  if (origin && origin !== "null") {
    return `${origin}/`;
  }
  if (window.location.href) {
    const idx = window.location.href.lastIndexOf("/");
    if (idx >= 0) {
      return window.location.href.slice(0, idx + 1);
    }
  }
  return `${window.location.protocol}//${window.location.host}/`;
}

function resolveManifestUrl(manifestParam) {
  if (!manifestParam) return "";
  if (isAbsoluteUrl(manifestParam)) {
    return manifestParam;
  }
  return resolveUrl(resolveBaseUrl(), manifestParam);
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

function updatePreviewControls() {
  const hasPdf = !!previewPdfUrl;
  const showPdf = previewMode === "pdf" && hasPdf;
  if (pdfPreviewEl) {
    pdfPreviewEl.classList.toggle("is-active", showPdf);
  }
  canvas.classList.toggle("is-hidden", showPdf);
  if (hudEl) {
    hudEl.classList.toggle("is-hidden", showPdf);
  }
  if (previewCadBtn) {
    previewCadBtn.classList.toggle("is-active", !showPdf);
  }
  if (previewPdfBtn) {
    previewPdfBtn.classList.toggle("is-active", showPdf);
    previewPdfBtn.disabled = !hasPdf;
  }
  if (pdfFrameEl && showPdf) {
    pdfFrameEl.src = previewPdfUrl;
  }
}

function setPreviewMode(mode) {
  previewMode = mode === "pdf" ? "pdf" : "cad";
  if (!previewPdfUrl && previewMode === "pdf") {
    previewMode = "cad";
  }
  updatePreviewControls();
}

function setPreviewUrl(url) {
  previewPdfUrl = url || "";
  if (!previewPdfUrl && previewMode === "pdf") {
    previewMode = "cad";
  }
  updatePreviewControls();
}

function updateLoadDetails(partial = {}) {
  Object.assign(loadDetails, partial);
  setMetaValue(metaRouterBaseEl, loadDetails.routerBase);
  setMetaLink(metaLoadManifestEl, loadDetails.manifestUrl);
  setMetaValue(metaLoadGltfEl, loadDetails.gltfUrl);
  setMetaLink(metaLoadPreviewEl, loadDetails.previewUrl);
  setMetaValue(metaLoadViewerEl, loadDetails.viewerUrl);
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
  updateLoadDetails({ manifestUrl });
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
  updateLoadDetails({ manifestUrl, viewerUrl: window.location.href });
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Manifest request failed (${response.status}).`);
  }
  const manifest = await response.json();
  updateDocumentMeta(params, extractManifestMeta(manifest));
  loadManifestArtifacts(manifestUrl, manifest).catch((error) => {
    console.error(error);
  });
  const previewName = manifest?.artifacts?.preview_pdf || manifest?.artifacts?.preview_svg;
  if (previewName) {
    const previewUrl = resolveUrl(manifestUrl, previewName);
    updateLoadDetails({ previewUrl });
    setPreviewUrl(previewUrl);
    setPreviewMode("pdf");
  } else {
    updateLoadDetails({ previewUrl: "" });
    setPreviewUrl("");
    setPreviewMode("cad");
  }
  const gltfName = manifest?.artifacts?.mesh_gltf;
  if (!gltfName) {
    if (!previewName) {
      throw new Error("Manifest missing artifacts.mesh_gltf.");
    }
    setStatus("Loaded preview only.");
    return;
  }
  const resolved = resolveUrl(manifestUrl, gltfName);
  gltfUrlInput.value = resolved;
  updateLoadDetails({ gltfUrl: resolved });
  loadScene(resolved);
}

function updateCounts() {
  let meshCount = 0;
  let lineCount = 0;
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
  lineRenderables.forEach((line) => {
    lineCount += 1;
    const geometry = line.geometry;
    if (geometry?.attributes?.position) {
      vertexCount += geometry.attributes.position.count;
    }
  });
  meshCountEl.textContent = (meshCount + lineCount).toString();
  vertexCountEl.textContent = vertexCount.toString();
  triangleCountEl.textContent = Math.round(triCount).toString();
}

function formatBoundsLabel(bounds) {
  if (!bounds || bounds.isEmpty()) return "n/a";
  const size = bounds.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y)) return "n/a";
  return `${size.x.toFixed(1)} x ${size.y.toFixed(1)}`;
}

function updateDiagnostics() {
  if (!diagEntityCountEl || !diagTextCountEl || !diagTextVisibleEl || !diagBoundsEl) {
    return;
  }
  const entities = Array.isArray(documentData?.entities) ? documentData.entities : [];
  let textCount = 0;
  let textVisible = 0;
  entities.forEach((entity) => {
    if (!entity?.text?.pos) return;
    textCount += 1;
    if (isEntityVisible(entity)) {
      textVisible += 1;
    }
  });
  diagEntityCountEl.textContent = entities.length.toString();
  diagTextCountEl.textContent = textCount.toString();
  diagTextVisibleEl.textContent = textVisible.toString();
  const bounds = resolveDocumentBounds(resolvedSpace, true) || sceneBounds.main || sceneBounds.full;
  diagBoundsEl.textContent = formatBoundsLabel(bounds);
}

function updateTextScaleDisplay() {
  if (!textScaleValueEl) return;
  textScaleValueEl.textContent = `${textScale.toFixed(1)}x`;
}

function updateContrastControls() {
  const buttons = [
    { btn: contrastSoftBtn, mode: "soft" },
    { btn: contrastHighBtn, mode: "high" },
    { btn: contrastDarkBtn, mode: "dark" },
  ];
  buttons.forEach(({ btn, mode }) => {
    if (!btn) return;
    btn.classList.toggle("is-active", renderContrast === mode);
  });
}

function updateOutlierControls() {
  const buttons = [
    { btn: outlierHideBtn, mode: true },
    { btn: outlierShowBtn, mode: false },
  ];
  buttons.forEach(({ btn, mode }) => {
    if (!btn) return;
    btn.classList.toggle("is-active", hideOutliers === mode);
  });
}

function setOutlierMode(enabled) {
  hideOutliers = enabled;
  updateOutlierControls();
  refreshOutlierClipPlanes();
  metadataApplied = false;
  tryApplyMetadata();
  renderTextEntities();
  refreshWideLines();
  refreshHatchMeshes();
  frameSpace();
}

function refreshRenderStyle() {
  if (!activeScene) return;
  metadataApplied = false;
  tryApplyMetadata();
  lineRenderables.forEach((line) => {
    if (!applyLineSliceMaterials(line)) {
      applyLineStyle(line);
    }
  });
  renderTextEntities();
  refreshWideLines();
  refreshHatchMeshes();
  refreshViewportOverlays();
  updateDiagnostics();
}

function applyContrastProfile() {
  const profile = getContrastProfile();
  document.body.dataset.contrast = renderContrast;
  renderer.setClearColor(profile.background, profile.clearAlpha);
  if (profile.clearAlpha > 0) {
    scene.background = new THREE.Color(profile.background);
  } else {
    scene.background = null;
  }
  if (grid?.material) {
    grid.material.opacity = profile.gridOpacity;
    grid.material.transparent = true;
    grid.material.needsUpdate = true;
  }
  updateContrastControls();
  refreshRenderStyle();
}

function setContrastMode(mode) {
  if (!contrastProfiles[mode]) return;
  renderContrast = mode;
  applyContrastProfile();
}

function setTextScale(scale) {
  const parsed = Number.parseFloat(scale);
  if (!Number.isFinite(parsed)) return;
  textScale = Math.min(Math.max(parsed, 0.5), 3.0);
  if (textScaleInput) textScaleInput.value = textScale.toFixed(1);
  updateTextScaleDisplay();
  renderTextEntities();
  refreshViewportOverlays();
  updateDiagnostics();
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
  annotationGroup.clear();
  clearViewportOverlays();
  clearTextSprites();
  clearHatchMeshes();
  clearWideLines();
  annotations.length = 0;
  annotationListEl.innerHTML = "";
  selectable = [];
  activeScene = null;
  sceneBounds = { full: null, main: null };
  textHeightFallback = 1.0;
  clearSelection();
  updateCounts();
}

function applyEntityMaterials(mesh) {
  const geometry = mesh.geometry;
  if (!geometry || !geometry.index || meshSlices.length === 0) return;
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
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const diffVisible = isDiffVisible(getDiffStatus(entity));
    const spaceVisible = isSpaceVisible(entity, slice);
    const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice.layer_id;
    const layerVisible = isLayerRenderable(layerId);
    const boundsVisible = isBoundsVisible(entity);
    const visible = diffVisible && spaceVisible && layerVisible && boundsVisible;
    const materialColor = visible ? colorIntToHex(colorInt) : "#d7dbe0";
    const opacity = visible ? 1 : (layerVisible && spaceVisible && boundsVisible ? 0.12 : 0.0);
    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      metalness: 0.05,
      roughness: 0.7,
      transparent: opacity < 1,
      opacity
    });
    applyOutlierClipping(material);
    if (!visible) {
      material.depthWrite = false;
    }
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    mesh.material = materials;
    mesh.userData.cadgfSlices = meshSlices;
  }
}

function applyEntityMaterialsForSpace(mesh, spaceFilter) {
  const geometry = mesh.geometry;
  if (!geometry || !geometry.index || meshSlices.length === 0) return false;
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
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const visible = isEntityVisibleForSpace(entity, slice, spaceFilter) && isBoundsVisible(entity);
    const materialColor = visible ? colorIntToHex(colorInt) : "#d7dbe0";
    const opacity = visible ? 1 : 0.0;
    const material = new THREE.MeshStandardMaterial({
      color: materialColor,
      metalness: 0.05,
      roughness: 0.7,
      transparent: opacity < 1,
      opacity
    });
    applyOutlierClipping(material);
    if (!visible) {
      material.depthWrite = false;
    }
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    mesh.material = materials;
    mesh.userData.cadgfSlices = meshSlices;
    return true;
  }
  return false;
}

function tryApplyMetadata() {
  if (metadataApplied || !activeScene || meshSlices.length === 0 || entityIndex.size === 0) return;
  activeScene.traverse((child) => {
    if (child.isMesh) {
      applyEntityMaterials(child);
    } else if (isLineObject(child)) {
      applyLineSliceMaterials(child);
    }
  });
  metadataApplied = true;
}

function isLineObject(object) {
  return object?.isLine || object?.isLineSegments;
}

function normalizeLineType(name) {
  return typeof name === "string" ? name.trim().toUpperCase() : "";
}

function resolveLineTypeScale(entity, slice) {
  const scale = Number.isFinite(entity?.line_type_scale)
    ? entity.line_type_scale
    : (Number.isFinite(slice?.line_type_scale) ? slice.line_type_scale : 1);
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(Math.max(scale, 0.05), 100);
}

function resolveLineDashSettings(entity, slice) {
  const lineType = normalizeLineType(entity?.line_type ?? slice?.line_type);
  if (!lineType || lineType === "CONTINUOUS" || lineType === "BYLAYER" || lineType === "BYBLOCK") return null;
  const scale = resolveLineTypeScale(entity, slice);
  const pattern = lineTypePatterns.get(lineType);
  if (Array.isArray(pattern) && pattern.length > 0) {
    const dash = pattern.find((value) => value > 0);
    const gap = pattern.find((value) => value < 0);
    if (Number.isFinite(dash) && Number.isFinite(gap) && dash > 0 && gap < 0) {
      return { dashSize: dash * scale, gapSize: Math.abs(gap) * scale };
    }
  }
  const preset = LINE_TYPE_PRESETS.find((item) => item.match.some((token) => lineType.includes(token)));
  const dash = preset?.dash ?? 1.0;
  const gap = preset?.gap ?? 0.5;
  return { dashSize: dash * scale, gapSize: gap * scale };
}

function resolveLineWidth(entity, slice) {
  const weight = Number.isFinite(entity?.line_weight)
    ? entity.line_weight
    : (Number.isFinite(slice?.line_weight) ? slice.line_weight : null);
  if (!Number.isFinite(weight) || weight <= 0) return null;
  const width = Math.min(Math.max(weight * 4, 1), 6);
  return width;
}

function buildLineMaterial(color, opacity, dash, width) {
  const materialProps = {
    color,
    transparent: opacity < 1,
    opacity
  };
  let material;
  if (dash) {
    material = new THREE.LineDashedMaterial({
      ...materialProps,
      dashSize: dash.dashSize,
      gapSize: dash.gapSize,
    });
  } else {
    material = new THREE.LineBasicMaterial(materialProps);
  }
  if (Number.isFinite(width)) {
    material.linewidth = width;
  }
  applyOutlierClipping(material);
  return material;
}

function clearWideLines() {
  wideLineRenderables.forEach((line) => {
    line.parent?.remove(line);
    line.geometry?.dispose();
    const material = line.material;
    if (Array.isArray(material)) {
      material.forEach((mat) => mat?.dispose?.());
    } else {
      material?.dispose?.();
    }
  });
  wideLineRenderables = [];
  wideLineMaterials = new Set();
}

function updateWideLineResolution(width, height) {
  wideLineMaterials.forEach((material) => {
    if (material?.resolution) {
      material.resolution.set(width, height);
    }
  });
}

function buildLineStyleKey(lineType, dash, width, opacity, patternKey) {
  const typeKey = lineType || "CONTINUOUS";
  const patternPart = patternKey ? `pattern:${patternKey}` : "pattern:none";
  const dashKey = dash ? `${dash.dashSize.toFixed(3)}:${dash.gapSize.toFixed(3)}` : "solid";
  const widthKey = Number.isFinite(width) ? width.toFixed(3) : "1";
  const opacityKey = opacity >= 0.99 ? "1" : "0.2";
  return `${typeKey}|${patternPart}|${dashKey}|${widthKey}|${opacityKey}`;
}

function appendPatternSegments(ax, ay, az, bx, by, bz, pattern, positions, colors, color) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (!Number.isFinite(length) || length <= 1e-6) return;
  const total = pattern.reduce((sum, value) => sum + Math.abs(value), 0);
  if (!Number.isFinite(total) || total <= 1e-6) {
    positions.push(ax, ay, az, bx, by, bz);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    return;
  }
  const dirx = dx / length;
  const diry = dy / length;
  const dirz = dz / length;
  let offset = 0;
  let patternIndex = 0;
  let guard = 0;
  while (offset < length - 1e-6 && guard < 10000) {
    const seg = pattern[patternIndex % pattern.length];
    const segLen = Math.abs(seg);
    if (segLen <= 1e-6) {
      patternIndex += 1;
      guard += 1;
      continue;
    }
    const run = Math.min(segLen, length - offset);
    if (seg > 0) {
      const sx = ax + dirx * offset;
      const sy = ay + diry * offset;
      const sz = az + dirz * offset;
      const ex = ax + dirx * (offset + run);
      const ey = ay + diry * (offset + run);
      const ez = az + dirz * (offset + run);
      positions.push(sx, sy, sz, ex, ey, ez);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
    offset += run;
    patternIndex += 1;
    guard += 1;
  }
}

function clipSegmentToBounds(ax, ay, bx, by, bounds) {
  if (!bounds || bounds.isEmpty()) return null;
  const minX = bounds.min.x;
  const maxX = bounds.max.x;
  const minY = bounds.min.y;
  const maxY = bounds.max.y;

  const INSIDE = 0;
  const LEFT = 1;
  const RIGHT = 2;
  const BOTTOM = 4;
  const TOP = 8;

  const computeOutCode = (x, y) => {
    let code = INSIDE;
    if (x < minX) code |= LEFT;
    else if (x > maxX) code |= RIGHT;
    if (y < minY) code |= BOTTOM;
    else if (y > maxY) code |= TOP;
    return code;
  };

  let x0 = ax;
  let y0 = ay;
  let x1 = bx;
  let y1 = by;
  let outcode0 = computeOutCode(x0, y0);
  let outcode1 = computeOutCode(x1, y1);

  while (true) {
    if (!(outcode0 | outcode1)) {
      return { ax: x0, ay: y0, bx: x1, by: y1 };
    }
    if (outcode0 & outcode1) {
      return null;
    }
    const outcodeOut = outcode0 ? outcode0 : outcode1;
    let x = 0;
    let y = 0;
    if (outcodeOut & TOP) {
      if (y1 === y0) return null;
      x = x0 + (x1 - x0) * (maxY - y0) / (y1 - y0);
      y = maxY;
    } else if (outcodeOut & BOTTOM) {
      if (y1 === y0) return null;
      x = x0 + (x1 - x0) * (minY - y0) / (y1 - y0);
      y = minY;
    } else if (outcodeOut & RIGHT) {
      if (x1 === x0) return null;
      y = y0 + (y1 - y0) * (maxX - x0) / (x1 - x0);
      x = maxX;
    } else if (outcodeOut & LEFT) {
      if (x1 === x0) return null;
      y = y0 + (y1 - y0) * (minX - x0) / (x1 - x0);
      x = minX;
    }
    if (outcodeOut === outcode0) {
      x0 = x;
      y0 = y;
      outcode0 = computeOutCode(x0, y0);
    } else {
      x1 = x;
      y1 = y;
      outcode1 = computeOutCode(x1, y1);
    }
  }
}

function buildWideLinesForSource(line) {
  const geometry = line?.geometry;
  const positionAttr = geometry?.attributes?.position;
  const indexAttr = geometry?.index;
  if (!geometry || !positionAttr || !indexAttr) return [];
  if (meshSlices.length === 0) return [];
  const totalSliceIndices = meshSlices.reduce((sum, slice) => {
    const count = Number.isFinite(slice?.index_count) ? slice.index_count : 0;
    return sum + count;
  }, 0);
  if (totalSliceIndices !== indexAttr.count) return [];

  const positions = positionAttr.array;
  const stride = positionAttr.itemSize || 3;
  const indices = indexAttr.array;
  const buckets = new Map();
  const clip = hideOutliers ? clipBounds : null;

  meshSlices.forEach((slice) => {
    if (!Number.isFinite(slice.index_offset) || !Number.isFinite(slice.index_count)) return;
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const diffStatus = getDiffStatus(entity);
    const diffVisible = isDiffVisible(diffStatus);
    const spaceVisible = isSpaceVisible(entity, slice);
    const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice.layer_id;
    const layerVisible = isLayerRenderable(layerId);
    const boundsVisible = isBoundsVisible(entity);
    const visible = diffVisible && spaceVisible && layerVisible && boundsVisible;
    const opacity = visible ? 1 : (layerVisible && spaceVisible && boundsVisible ? 0.2 : 0.0);
    if (opacity <= 0) return;

    const lineType = normalizeLineType(entity?.line_type ?? slice?.line_type);
    const scale = resolveLineTypeScale(entity, slice);
    const pattern = lineTypePatterns.get(lineType);
    let patternScaled = null;
    let patternKey = "";
    let dash = resolveLineDashSettings(entity, slice);
    if (Array.isArray(pattern) && pattern.length > 0) {
      const hasDash = pattern.some((value) => value > 0);
      const hasGap = pattern.some((value) => value < 0);
      if (hasDash && hasGap) {
        patternScaled = pattern.map((value) => value * scale);
        patternKey = patternScaled.map((value) => value.toFixed(3)).join(",");
        dash = null;
      }
    }
    const width = resolveLineWidth(entity, slice) ?? 1;
    const key = buildLineStyleKey(lineType, dash, width, opacity, patternKey);
    if (!buckets.has(key)) {
      buckets.set(key, {
        positions: [],
        colors: [],
        dash,
        pattern: patternScaled,
        width,
        opacity
      });
    }
    const bucket = buckets.get(key);
    const color = new THREE.Color(colorIntToHex(colorInt));

    const start = slice.index_offset;
    const end = slice.index_offset + slice.index_count;
    for (let i = start; i + 1 < end; i += 2) {
      const ia = indices[i];
      const ib = indices[i + 1];
      const ax = positions[ia * stride];
      const ay = positions[ia * stride + 1];
      const az = positions[ia * stride + 2] ?? 0;
      const bx = positions[ib * stride];
      const by = positions[ib * stride + 1];
      const bz = positions[ib * stride + 2] ?? 0;
      const clipped = clip ? clipSegmentToBounds(ax, ay, bx, by, clip) : null;
      const pax = clipped ? clipped.ax : ax;
      const pay = clipped ? clipped.ay : ay;
      const pbx = clipped ? clipped.bx : bx;
      const pby = clipped ? clipped.by : by;
      if (clip && !clipped) continue;
      if (bucket.pattern) {
        appendPatternSegments(pax, pay, az, pbx, pby, bz, bucket.pattern, bucket.positions, bucket.colors, color);
      } else {
        bucket.positions.push(pax, pay, az, pbx, pby, bz);
        bucket.colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      }
    }
  });

  const results = [];
  buckets.forEach((bucket) => {
    if (bucket.positions.length === 0) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(bucket.positions);
    geometry.setColors(bucket.colors);
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: bucket.width,
      transparent: bucket.opacity < 1,
      opacity: bucket.opacity,
      dashed: !!bucket.dash,
      dashSize: bucket.dash?.dashSize ?? 1,
      gapSize: bucket.dash?.gapSize ?? 0.5,
      dashScale: 1
    });
    material.vertexColors = true;
    material.resolution.set(canvas.clientWidth, canvas.clientHeight);
    applyOutlierClipping(material);
    const wideLine = new LineSegments2(geometry, material);
    if (bucket.dash) {
      wideLine.computeLineDistances();
    }
    wideLine.matrixAutoUpdate = false;
    wideLine.matrix.copy(line.matrix);
    wideLine.updateMatrixWorld(true);
    results.push({ line: wideLine, material });
  });
  return results;
}

function refreshWideLines() {
  clearWideLines();
  if (!activeScene || meshSlices.length === 0 || lineRenderables.length === 0) return;
  lineRenderables.forEach((line) => {
    line.updateMatrix();
    const parent = line.parent || activeScene;
    const built = buildWideLinesForSource(line);
    if (built.length === 0) {
      line.visible = true;
      return;
    }
    line.visible = false;
    built.forEach(({ line: wideLine, material }) => {
      parent.add(wideLine);
      wideLineRenderables.push(wideLine);
      wideLineMaterials.add(material);
    });
  });
}

function applyLineSliceMaterials(line) {
  const geometry = line?.geometry;
  if (!geometry || !geometry.index || meshSlices.length === 0) {
    return false;
  }
  const totalSliceIndices = meshSlices.reduce((sum, slice) => {
    const count = Number.isFinite(slice?.index_count) ? slice.index_count : 0;
    return sum + count;
  }, 0);
  if (totalSliceIndices !== geometry.index.count) {
    return false;
  }
  geometry.clearGroups();
  const materials = [];
  const previous = line.material;
  if (previous) {
    if (Array.isArray(previous)) {
      previous.forEach((mat) => mat?.dispose());
    } else {
      previous.dispose?.();
    }
  }
  meshSlices.forEach((slice) => {
    if (!Number.isFinite(slice.index_offset) || !Number.isFinite(slice.index_count)) return;
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const diffStatus = getDiffStatus(entity);
    const diffVisible = isDiffVisible(diffStatus);
    const spaceVisible = isSpaceVisible(entity, slice);
    const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : slice.layer_id;
    const layerVisible = isLayerRenderable(layerId);
    const boundsVisible = isBoundsVisible(entity);
    const visible = diffVisible && spaceVisible && layerVisible && boundsVisible;
    const materialColor = visible ? colorIntToHex(colorInt) : "#d7dbe0";
    const opacity = visible ? 1 : (layerVisible && spaceVisible && boundsVisible ? 0.2 : 0.0);
    const dash = resolveLineDashSettings(entity, slice);
    const width = resolveLineWidth(entity, slice);
    const material = buildLineMaterial(materialColor, opacity, dash, width);
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    line.material = materials;
    line.userData.cadgfSlices = meshSlices;
    if (materials.some((mat) => mat?.isLineDashedMaterial) && typeof line.computeLineDistances === "function") {
      line.computeLineDistances();
    }
    return true;
  }
  return false;
}

function applyLineSliceMaterialsForSpace(line, spaceFilter) {
  const geometry = line?.geometry;
  if (!geometry || !geometry.index || meshSlices.length === 0) {
    return false;
  }
  const totalSliceIndices = meshSlices.reduce((sum, slice) => {
    const count = Number.isFinite(slice?.index_count) ? slice.index_count : 0;
    return sum + count;
  }, 0);
  if (totalSliceIndices !== geometry.index.count) {
    return false;
  }
  geometry.clearGroups();
  const materials = [];
  const previous = line.material;
  if (previous) {
    if (Array.isArray(previous)) {
      previous.forEach((mat) => mat?.dispose());
    } else {
      previous.dispose?.();
    }
  }
  meshSlices.forEach((slice) => {
    if (!Number.isFinite(slice.index_offset) || !Number.isFinite(slice.index_count)) return;
    const entity = entityIndex.get(slice.id) || null;
    const fallbackLayerColor = Number.isFinite(slice.layer_color) ? slice.layer_color : null;
    const colorInt = resolveEntityColor(entity ?? slice ?? {}, slice.layer_id, fallbackLayerColor);
    const visible = isEntityVisibleForSpace(entity, slice, spaceFilter) && isBoundsVisible(entity);
    const materialColor = visible ? colorIntToHex(colorInt) : "#d7dbe0";
    const opacity = visible ? 1 : 0.0;
    const dash = resolveLineDashSettings(entity, slice);
    const width = resolveLineWidth(entity, slice);
    const material = buildLineMaterial(materialColor, opacity, dash, width);
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    line.material = materials;
    line.userData.cadgfSlices = meshSlices;
    if (materials.some((mat) => mat?.isLineDashedMaterial) && typeof line.computeLineDistances === "function") {
      line.computeLineDistances();
    }
    return true;
  }
  return false;
}

function applyLineStyle(line) {
  if (!line?.material) return;
  const lineColor = resolveLineStyleColor();
  if (Array.isArray(line.material)) {
    line.material = line.material.map((mat) => {
      const clone = mat.clone();
      if (clone.color) clone.color.set(lineColor);
      clone.opacity = 1.0;
      clone.transparent = false;
      applyOutlierClipping(clone);
      return clone;
    });
    return;
  }
  const material = line.material.clone();
  if (material.color) material.color.set(lineColor);
  material.opacity = 1.0;
  material.transparent = false;
  applyOutlierClipping(material);
  line.material = material;
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

function samplePositionsFromObject(object, maxSamples = 20000) {
  const xs = [];
  const ys = [];
  const zs = [];
  if (!object) return { xs, ys, zs };
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    const posAttr = child.geometry?.attributes?.position;
    if (!posAttr || !posAttr.array) return;
    const stride = posAttr.itemSize || 3;
    const count = posAttr.count || Math.floor(posAttr.array.length / stride);
    if (count <= 0) return;
    const step = Math.max(1, Math.floor(count / Math.max(1, maxSamples / 4)));
    const worldMatrix = child.matrixWorld;
    const temp = new THREE.Vector3();
    for (let i = 0; i < count; i += step) {
      const idx = i * stride;
      temp.set(
        posAttr.array[idx],
        posAttr.array[idx + 1],
        posAttr.array[idx + 2] ?? 0
      );
      temp.applyMatrix4(worldMatrix);
      xs.push(temp.x);
      ys.push(temp.y);
      zs.push(temp.z);
    }
  });
  return { xs, ys, zs };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const t = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * t;
}

function computePercentileBounds(xs, ys, zs, lowPct, highPct) {
  if (xs.length < 2) return null;
  const xsSorted = xs.slice().sort((a, b) => a - b);
  const ysSorted = ys.slice().sort((a, b) => a - b);
  const zsSorted = zs.length ? zs.slice().sort((a, b) => a - b) : [0];
  const lowX = percentile(xsSorted, lowPct);
  const highX = percentile(xsSorted, highPct);
  const lowY = percentile(ysSorted, lowPct);
  const highY = percentile(ysSorted, highPct);
  const lowZ = percentile(zsSorted, lowPct);
  const highZ = percentile(zsSorted, highPct);
  if (!Number.isFinite(lowX) || !Number.isFinite(lowY) || !Number.isFinite(lowZ)) return null;
  return new THREE.Box3(
    new THREE.Vector3(lowX, lowY, lowZ),
    new THREE.Vector3(highX, highY, highZ)
  );
}

function computeTrimmedBounds(xs, ys, zs) {
  if (xs.length < 10) return null;
  const xsSorted = xs.slice().sort((a, b) => a - b);
  const ysSorted = ys.slice().sort((a, b) => a - b);
  const zsSorted = zs.slice().sort((a, b) => a - b);
  const minX = xsSorted[0];
  const maxX = xsSorted[xsSorted.length - 1];
  const minY = ysSorted[0];
  const maxY = ysSorted[ysSorted.length - 1];
  const minZ = zsSorted[0];
  const maxZ = zsSorted[zsSorted.length - 1];

  const p1X = percentile(xsSorted, 1);
  const p99X = percentile(xsSorted, 99);
  const p1Y = percentile(ysSorted, 1);
  const p99Y = percentile(ysSorted, 99);
  const p1Z = percentile(zsSorted, 1);
  const p99Z = percentile(zsSorted, 99);

  const p5X = percentile(xsSorted, 5);
  const p95X = percentile(xsSorted, 95);
  const p10X = percentile(xsSorted, 10);
  const p90X = percentile(xsSorted, 90);
  const p5Y = percentile(ysSorted, 5);
  const p95Y = percentile(ysSorted, 95);
  const p10Y = percentile(ysSorted, 10);
  const p90Y = percentile(ysSorted, 90);
  const p5Z = percentile(zsSorted, 5);
  const p95Z = percentile(zsSorted, 95);
  const p10Z = percentile(zsSorted, 10);
  const p90Z = percentile(zsSorted, 90);

  const fullRangeX = maxX - minX;
  const fullRangeY = maxY - minY;
  const fullRangeZ = maxZ - minZ;
  const trimRangeX = p99X - p1X;
  const trimRangeY = p99Y - p1Y;
  const trimRangeZ = p99Z - p1Z;
  const trimRange5X = p95X - p5X;
  const trimRange5Y = p95Y - p5Y;
  const trimRange5Z = p95Z - p5Z;
  const trimRange10X = p90X - p10X;
  const trimRange10Y = p90Y - p10Y;
  const trimRange10Z = p90Z - p10Z;

  const buildBounds = (lowX, highX, lowY, highY, lowZ, highZ) => {
    if (!Number.isFinite(lowX) || !Number.isFinite(lowY) || !Number.isFinite(lowZ)) {
      return null;
    }
    return new THREE.Box3(
      new THREE.Vector3(lowX, lowY, lowZ),
      new THREE.Vector3(highX, highY, highZ)
    );
  };

  const fullArea = fullRangeX > 0 && fullRangeY > 0 ? fullRangeX * fullRangeY : 0;
  const area99 = trimRangeX > 0 && trimRangeY > 0 ? trimRangeX * trimRangeY : 0;
  const area95 = trimRange5X > 0 && trimRange5Y > 0 ? trimRange5X * trimRange5Y : 0;
  const area90 = trimRange10X > 0 && trimRange10Y > 0 ? trimRange10X * trimRange10Y : 0;

  if (fullArea > 0) {
    if (area90 > 0 && area90 / fullArea <= 0.25) {
      const bounds = buildBounds(p10X, p90X, p10Y, p90Y, p10Z, p90Z);
      if (bounds) return bounds;
    }
    if (area95 > 0 && area95 / fullArea <= 0.35) {
      const bounds = buildBounds(p5X, p95X, p5Y, p95Y, p5Z, p95Z);
      if (bounds) return bounds;
    }
    if (area99 > 0 && area99 / fullArea <= 0.6) {
      const bounds = buildBounds(p1X, p99X, p1Y, p99Y, p1Z, p99Z);
      if (bounds) return bounds;
    }
  }

  const ratioThreshold = 50;
  const aggressiveThreshold = 200;
  const hardThreshold = 12;
  const softThreshold = 8;

  const ratioX = trimRangeX > 0 ? fullRangeX / trimRangeX : 0;
  const ratioY = trimRangeY > 0 ? fullRangeY / trimRangeY : 0;
  const ratioZ = trimRangeZ > 0 ? fullRangeZ / trimRangeZ : 0;

  const useAggressiveX = trimRange5X > 0 && ratioX > aggressiveThreshold;
  const useAggressiveY = trimRange5Y > 0 && ratioY > aggressiveThreshold;
  const useAggressiveZ = trimRange5Z > 0 && ratioZ > aggressiveThreshold;

  const useTrimX = trimRangeX > 0 && ratioX > ratioThreshold;
  const useTrimY = trimRangeY > 0 && ratioY > ratioThreshold;
  const useTrimZ = trimRangeZ > 0 && ratioZ > ratioThreshold;

  const ratio10X = trimRange10X > 0 ? fullRangeX / trimRange10X : 0;
  const ratio10Y = trimRange10Y > 0 ? fullRangeY / trimRange10Y : 0;
  const ratio10Z = trimRange10Z > 0 ? fullRangeZ / trimRange10Z : 0;
  const ratio5X = trimRange5X > 0 ? fullRangeX / trimRange5X : 0;
  const ratio5Y = trimRange5Y > 0 ? fullRangeY / trimRange5Y : 0;
  const ratio5Z = trimRange5Z > 0 ? fullRangeZ / trimRange5Z : 0;

  const hardRatioThreshold = 60;
  const useHardX = trimRange10X > 0 && ratio10X > hardThreshold &&
    trimRange10X < trimRange5X * 0.2 && ratio5X > hardRatioThreshold;
  const useHardY = trimRange10Y > 0 && ratio10Y > hardThreshold &&
    trimRange10Y < trimRange5Y * 0.2 && ratio5Y > hardRatioThreshold;
  const useHardZ = trimRange10Z > 0 && ratio10Z > hardThreshold &&
    trimRange10Z < trimRange5Z * 0.2 && ratio5Z > hardRatioThreshold;

  const useSoftX = trimRange5X > 0 && ratio5X > softThreshold;
  const useSoftY = trimRange5Y > 0 && ratio5Y > softThreshold;
  const useSoftZ = trimRange5Z > 0 && ratio5Z > softThreshold;

  const lowX = useHardX ? p10X : (useAggressiveX ? p5X : (useSoftX ? p5X : (useTrimX ? p1X : minX)));
  const highX = useHardX ? p90X : (useAggressiveX ? p95X : (useSoftX ? p95X : (useTrimX ? p99X : maxX)));
  const lowY = useHardY ? p10Y : (useAggressiveY ? p5Y : (useSoftY ? p5Y : (useTrimY ? p1Y : minY)));
  const highY = useHardY ? p90Y : (useAggressiveY ? p95Y : (useSoftY ? p95Y : (useTrimY ? p99Y : maxY)));
  const lowZ = useHardZ ? p10Z : (useAggressiveZ ? p5Z : (useSoftZ ? p5Z : (useTrimZ ? p1Z : minZ)));
  const highZ = useHardZ ? p90Z : (useAggressiveZ ? p95Z : (useSoftZ ? p95Z : (useTrimZ ? p99Z : maxZ)));

  return buildBounds(lowX, highX, lowY, highY, lowZ, highZ);
}

function computeRobustBounds(object) {
  const { xs, ys, zs } = samplePositionsFromObject(object);
  return computeTrimmedBounds(xs, ys, zs);
}

function computeFullBounds(object) {
  if (!object) return null;
  const bounds = new THREE.Box3();
  const temp = new THREE.Box3();
  let hasBounds = false;
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    const geometry = child.geometry;
    if (!geometry) return;
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
    if (!geometry.boundingBox || geometry.boundingBox.isEmpty()) return;
    temp.copy(geometry.boundingBox);
    temp.applyMatrix4(child.matrixWorld);
    if (!hasBounds) {
      bounds.copy(temp);
      hasBounds = true;
    } else {
      bounds.union(temp);
    }
  });
  return hasBounds ? bounds : null;
}

function forEachDocumentPoint(spaceFilter, callback) {
  if (!documentData || !Array.isArray(documentData.entities) || !callback) return;
  const shouldInclude = (entity) => {
    if (!isLayerRenderable(entity?.layer_id)) return false;
    if (spaceFilter === null) return true;
    const space = getEntitySpace(entity);
    if (space === null) return true;
    return space === spaceFilter;
  };

  const sampleArc = (center, radius, startAngle, endAngle, clockwise) => {
    if (!Number.isFinite(radius) || radius <= 0) return;
    let start = startAngle;
    let end = endAngle;
    if (clockwise) {
      if (end > start) {
        end -= Math.PI * 2;
      }
    } else if (end < start) {
      end += Math.PI * 2;
    }
    const steps = 16;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const angle = start + (end - start) * t;
      callback(center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius);
    }
  };

  const sampleEllipse = (center, rx, ry, rotation, startAngle, endAngle) => {
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;
    let start = Number.isFinite(startAngle) ? startAngle : 0;
    let end = Number.isFinite(endAngle) ? endAngle : Math.PI * 2;
    if (end < start) {
      end += Math.PI * 2;
    }
    const steps = 20;
    const cosRot = Math.cos(rotation || 0);
    const sinRot = Math.sin(rotation || 0);
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const angle = start + (end - start) * t;
      const x = Math.cos(angle) * rx;
      const y = Math.sin(angle) * ry;
      const xr = x * cosRot - y * sinRot;
      const yr = x * sinRot + y * cosRot;
      callback(center[0] + xr, center[1] + yr);
    }
  };

  documentData.entities.forEach((entity) => {
    if (!shouldInclude(entity)) return;
    const type = entity?.type;
    if (type === 0 && Array.isArray(entity.polyline)) {
      entity.polyline.forEach((pt) => {
        if (Array.isArray(pt)) callback(pt[0], pt[1]);
      });
    } else if (type === 1 && Array.isArray(entity.point)) {
      callback(entity.point[0], entity.point[1]);
    } else if (type === 2 && Array.isArray(entity.line)) {
      entity.line.forEach((pt) => {
        if (Array.isArray(pt)) callback(pt[0], pt[1]);
      });
    } else if (type === 3 && entity.arc) {
      const center = entity.arc.c;
      const radius = entity.arc.r;
      if (Array.isArray(center) && Number.isFinite(radius)) {
        sampleArc(center, radius, entity.arc.a0, entity.arc.a1, entity.arc.cw);
      }
    } else if (type === 4 && entity.circle) {
      const center = entity.circle.c;
      const radius = entity.circle.r;
      if (Array.isArray(center) && Number.isFinite(radius)) {
        callback(center[0] - radius, center[1] - radius);
        callback(center[0] + radius, center[1] + radius);
      }
    } else if (type === 5 && entity.ellipse) {
      const center = entity.ellipse.c;
      if (Array.isArray(center)) {
        sampleEllipse(center, entity.ellipse.rx, entity.ellipse.ry, entity.ellipse.rot,
                      entity.ellipse.a0, entity.ellipse.a1);
      }
    } else if (type === 6 && entity.spline?.control) {
      entity.spline.control.forEach((pt) => {
        if (Array.isArray(pt)) callback(pt[0], pt[1]);
      });
    } else if (type === 7 && entity.text?.pos) {
      const pos = entity.text.pos;
      if (Array.isArray(pos)) callback(pos[0], pos[1]);
    }
  });
}

function computeDocumentBounds(spaceFilter) {
  const bounds = new THREE.Box3();
  const temp = new THREE.Vector3();
  let hasBounds = false;
  forEachDocumentPoint(spaceFilter, (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    temp.set(x, y, 0);
    if (!hasBounds) {
      bounds.min.copy(temp);
      bounds.max.copy(temp);
      hasBounds = true;
    } else {
      bounds.expandByPoint(temp);
    }
  });
  return hasBounds ? bounds : null;
}

function computeDocumentRobustBounds(spaceFilter) {
  const xs = [];
  const ys = [];
  const zs = [];
  forEachDocumentPoint(spaceFilter, (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    xs.push(x);
    ys.push(y);
    zs.push(0);
  });
  return computeTrimmedBounds(xs, ys, zs);
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function forEachEntitySegment(entity, callback) {
  const points = Array.isArray(entity?.line)
    ? entity.line
    : (Array.isArray(entity?.polyline) ? entity.polyline : null);
  if (!Array.isArray(points) || points.length < 2) return;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!Array.isArray(a) || !Array.isArray(b)) continue;
    callback(a[0], a[1], b[0], b[1]);
  }
  if (entity?.closed && points.length > 2) {
    const a = points[points.length - 1];
    const b = points[0];
    if (Array.isArray(a) && Array.isArray(b)) {
      callback(a[0], a[1], b[0], b[1]);
    }
  }
}

function clusterAxisLines(lines, coordTol) {
  const buckets = new Map();
  lines.forEach((line) => {
    const coord = line.coord;
    const key = Math.round(coord / coordTol) * coordTol;
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        coord: key,
        min: line.min,
        max: line.max,
      });
      return;
    }
    if (line.min < existing.min) existing.min = line.min;
    if (line.max > existing.max) existing.max = line.max;
  });
  const clusters = Array.from(buckets.values()).map((entry) => ({
    ...entry,
    span: entry.max - entry.min,
  }));
  clusters.sort((a, b) => b.span - a.span);
  return clusters;
}

function pickFarthestPair(clusters) {
  if (clusters.length < 2) return null;
  const primary = clusters[0];
  let secondary = null;
  let maxDistance = 0;
  const limit = Math.min(clusters.length, 6);
  for (let i = 1; i < limit; i += 1) {
    const candidate = clusters[i];
    const distance = Math.abs(candidate.coord - primary.coord);
    if (!secondary || distance > maxDistance) {
      secondary = candidate;
      maxDistance = distance;
    }
  }
  if (!secondary) return null;
  return { primary, secondary };
}

function detectFrameBounds(spaceFilter) {
  if (!documentData || !Array.isArray(documentData.entities)) return null;
  const xs = [];
  const ys = [];
  const zs = [];
  forEachDocumentPoint(spaceFilter, (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    xs.push(x);
    ys.push(y);
    zs.push(0);
  });
  const coreBounds = computePercentileBounds(xs, ys, zs, 5, 95);
  const robustBounds = computeTrimmedBounds(xs, ys, zs);
  const fullBounds = computeDocumentBounds(spaceFilter);
  const referenceBounds = coreBounds || robustBounds || fullBounds;
  if (!referenceBounds || referenceBounds.isEmpty()) return null;

  const refSize = referenceBounds.getSize(new THREE.Vector3());
  const minLengthX = refSize.x * 0.6;
  const minLengthY = refSize.y * 0.6;
  if (!Number.isFinite(minLengthX) || !Number.isFinite(minLengthY) || minLengthX <= 0 || minLengthY <= 0) {
    return null;
  }

  const maxSize = Math.max(refSize.x, refSize.y);
  const coordTol = clampNumber(maxSize * 0.0002, 0.05, 5);
  const axisTol = clampNumber(maxSize * 0.000001, 1e-4, 0.5);
  const refMinX = referenceBounds.min.x;
  const refMaxX = referenceBounds.max.x;
  const refMinY = referenceBounds.min.y;
  const refMaxY = referenceBounds.max.y;
  const refSpanX = refSize.x;
  const refSpanY = refSize.y;

  const collectAxisLines = (minOverlapRatio) => {
    const horiz = [];
    const vert = [];
    const minOverlapX = refSpanX * minOverlapRatio;
    const minOverlapY = refSpanY * minOverlapRatio;
    documentData.entities.forEach((entity) => {
      const space = getEntitySpace(entity);
      if (Number.isFinite(spaceFilter)) {
        if (!Number.isFinite(space) || space !== spaceFilter) return;
      }
      const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : null;
      if (!isLayerRenderable(layerId)) return;
      forEachEntitySegment(entity, (x1, y1, x2, y2) => {
        if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
          return;
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (Math.abs(dy) <= axisTol && Math.abs(dx) >= minLengthX) {
          const minX = Math.min(x1, x2);
          const maxX = Math.max(x1, x2);
          const overlap = Math.min(maxX, refMaxX) - Math.max(minX, refMinX);
          if (overlap < minOverlapX) return;
          horiz.push({ coord: y1, min: minX, max: maxX });
        } else if (Math.abs(dx) <= axisTol && Math.abs(dy) >= minLengthY) {
          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);
          const overlap = Math.min(maxY, refMaxY) - Math.max(minY, refMinY);
          if (overlap < minOverlapY) return;
          vert.push({ coord: x1, min: minY, max: maxY });
        }
      });
    });
    return { horiz, vert };
  };

  let { horiz, vert } = collectAxisLines(0.45);
  if (horiz.length < 2 || vert.length < 2) {
    ({ horiz, vert } = collectAxisLines(0.2));
  }

  if (horiz.length < 2 || vert.length < 2) return null;

  const horizClusters = clusterAxisLines(horiz, coordTol, "y");
  const vertClusters = clusterAxisLines(vert, coordTol, "x");
  if (horizClusters.length < 2 || vertClusters.length < 2) return null;

  const horizPair = pickFarthestPair(horizClusters);
  const vertPair = pickFarthestPair(vertClusters);
  if (!horizPair || !vertPair) return null;

  const top = horizPair.primary.coord > horizPair.secondary.coord ? horizPair.primary : horizPair.secondary;
  const bottom = top === horizPair.primary ? horizPair.secondary : horizPair.primary;
  const right = vertPair.primary.coord > vertPair.secondary.coord ? vertPair.primary : vertPair.secondary;
  const left = right === vertPair.primary ? vertPair.secondary : vertPair.primary;

  const minX = left.coord;
  const maxX = right.coord;
  const minY = bottom.coord;
  const maxY = top.coord;
  const width = maxX - minX;
  const height = maxY - minY;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const spanTolX = Math.max(width * 0.05, coordTol);
  const spanTolY = Math.max(height * 0.05, coordTol);
  if (top.min > minX + spanTolX || top.max < maxX - spanTolX) return null;
  if (bottom.min > minX + spanTolX || bottom.max < maxX - spanTolX) return null;
  if (left.min > minY + spanTolY || left.max < maxY - spanTolY) return null;
  if (right.min > minY + spanTolY || right.max < maxY - spanTolY) return null;

  const frameBounds = new THREE.Box3(
    new THREE.Vector3(minX, minY, 0),
    new THREE.Vector3(maxX, maxY, 0)
  );

  if (fullBounds && !fullBounds.isEmpty()) {
    const fullSize = fullBounds.getSize(new THREE.Vector3());
    const fullArea = fullSize.x * fullSize.y;
    const frameArea = width * height;
    if (Number.isFinite(fullArea) && fullArea > 0) {
      if (frameArea < fullArea * 0.15) return null;
    }
  }

  return frameBounds;
}

function updateFrameBounds() {
  const hasPaper = (spaceStats?.paper || 0) > 0;
  const paperFrame = hasPaper ? resolvePaperFrameBounds() : null;
  let modelFrame = detectFrameBounds(0);
  if (paperFrame && modelFrame) {
    modelFrame = chooseBounds(modelFrame, paperFrame);
  }
  frameBoundsBySpace = {
    model: modelFrame,
    paper: paperFrame,
    all: detectFrameBounds(null),
  };
  if (typeof window !== "undefined") {
    window.__cadgfDebug = window.__cadgfDebug || {};
    window.__cadgfDebug.frameBoundsBySpace = {
      model: modelFrame ? formatBoundsLabel(modelFrame) : "n/a",
      paper: paperFrame ? formatBoundsLabel(paperFrame) : "n/a",
      all: frameBoundsBySpace.all ? formatBoundsLabel(frameBoundsBySpace.all) : "n/a",
    };
  }
}

function resolveFrameBounds(spaceFilter) {
  if (!frameBoundsBySpace) return null;
  if (spaceFilter === 0) return frameBoundsBySpace.model;
  if (spaceFilter === 1) return frameBoundsBySpace.paper;
  return frameBoundsBySpace.all;
}

function computeDocumentClipBounds(spaceFilter) {
  const viewBounds = resolveActiveModelViewBounds(spaceFilter);
  const frameBounds = resolveFrameBounds(spaceFilter);
  const robustBounds = computeDocumentRobustBounds(spaceFilter);
  const docBounds = robustBounds && !robustBounds.isEmpty()
    ? robustBounds
    : computeDocumentBounds(spaceFilter);
  if (frameBounds && !frameBounds.isEmpty() && !isOversizedBounds(frameBounds, docBounds, 6)) {
    return frameBounds;
  }
  if (viewBounds && !viewBounds.isEmpty() && !isOversizedBounds(viewBounds, docBounds, 6)) {
    return viewBounds;
  }
  if (robustBounds && !robustBounds.isEmpty()) {
    return robustBounds;
  }
  const xs = [];
  const ys = [];
  const zs = [];
  forEachDocumentPoint(spaceFilter, (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    xs.push(x);
    ys.push(y);
    zs.push(0);
  });
  const percentileBounds = computePercentileBounds(xs, ys, zs, 1, 99);
  if (percentileBounds && !percentileBounds.isEmpty()) {
    return percentileBounds;
  }
  return computeDocumentBounds(spaceFilter);
}

function buildClipPlanes(bounds) {
  if (!bounds || bounds.isEmpty()) return null;
  const min = bounds.min;
  const max = bounds.max;
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -min.x),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), max.x),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -min.y),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), max.y),
  ];
}

function refreshLineOutlierClipping() {
  if (Array.isArray(lineRenderables)) {
    lineRenderables.forEach((line) => {
      const material = line?.material;
      if (!material) return;
      if (Array.isArray(material)) {
        material.forEach((mat) => applyOutlierClipping(mat));
      } else {
        applyOutlierClipping(material);
      }
    });
  }
  if (Array.isArray(wideLineRenderables)) {
    wideLineRenderables.forEach((line) => {
      const material = line?.material;
      if (!material) return;
      if (Array.isArray(material)) {
        material.forEach((mat) => applyOutlierClipping(mat));
      } else {
        applyOutlierClipping(material);
      }
    });
  }
}

function refreshMeshOutlierClipping() {
  if (!Array.isArray(selectable) || selectable.length === 0) return;
  selectable.forEach((mesh) => {
    const material = mesh?.material;
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach((mat) => applyOutlierClipping(mat));
    } else {
      applyOutlierClipping(material);
    }
  });
}

function refreshOutlierEntities() {
  outlierEntityIds = new Set();
  if (!hideOutliers) return;
  const frameBounds = resolveFrameBounds(resolvedSpace);
  if (!frameBounds || frameBounds.isEmpty()) return;
  if (!entityBounds || entityBounds.size === 0) return;

  const size = frameBounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y);
  const margin = Number.isFinite(span) ? span * 0.01 : 0; // 1% margin
  const minX = frameBounds.min.x - margin;
  const maxX = frameBounds.max.x + margin;
  const minY = frameBounds.min.y - margin;
  const maxY = frameBounds.max.y + margin;

  entityBounds.forEach((bounds, id) => {
    if (!bounds || !Number.isFinite(id)) return;
    if (bounds.max.x < minX || bounds.min.x > maxX || bounds.max.y < minY || bounds.min.y > maxY) {
      outlierEntityIds.add(id);
    }
  });
}

function refreshOutlierClipPlanes() {
  if (!hideOutliers || !clipBounds || clipBounds.isEmpty()) {
    outlierClipPlanes = null;
    refreshOutlierEntities();
    refreshMeshOutlierClipping();
    refreshLineOutlierClipping();
    refreshHatchOutlierClipping();
    return;
  }
  outlierClipPlanes = buildClipPlanes(clipBounds);
  refreshOutlierEntities();
  refreshMeshOutlierClipping();
  refreshLineOutlierClipping();
  refreshHatchOutlierClipping();
}

function applyOutlierClipping(material) {
  if (!material) return;
  const planes = (outlierClipPlanes && outlierClipPlanes.length > 0) ? outlierClipPlanes : null;
  const prevPlanes = material.clippingPlanes;
  const prevEnabled = Array.isArray(prevPlanes) && prevPlanes.length > 0;
  const prevIntersection = material.clipIntersection;
  const nextEnabled = !!planes;
  material.clippingPlanes = planes;
  // Use intersection clipping so geometry must be inside all planes (frame box).
  material.clipIntersection = true;
  if (prevEnabled !== nextEnabled || prevIntersection !== material.clipIntersection) {
    material.needsUpdate = true;
  }
}

function resolveDocumentBounds(spaceFilter, preferRobust = true) {
  if (preferRobust) {
    const robust = computeDocumentRobustBounds(spaceFilter);
    if (robust && !robust.isEmpty()) return robust;
  }
  if (spaceFilter === 1 && viewportList.length > 0) {
    const viewportBounds = new THREE.Box3();
    viewportList.forEach((viewport) => {
      const halfW = viewport.width * 0.5;
      const halfH = viewport.height * 0.5;
      if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) return;
      const min = new THREE.Vector3(viewport.center.x - halfW, viewport.center.y - halfH, 0);
      const max = new THREE.Vector3(viewport.center.x + halfW, viewport.center.y + halfH, 0);
      viewportBounds.union(new THREE.Box3(min, max));
    });
    if (!viewportBounds.isEmpty()) return viewportBounds;
  }
  const full = computeDocumentBounds(spaceFilter);
  if (full && !full.isEmpty()) return full;
  return null;
}

function updateTextHeightFallback(box) {
  if (!box || box.isEmpty()) {
    textHeightFallback = 1.0;
    return;
  }
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y);
  if (!Number.isFinite(span) || span <= 0) {
    textHeightFallback = 1.0;
    return;
  }
  textHeightFallback = Math.max(span * 0.005, 1.0);
}

function frameBox(box) {
  if (!box || box.isEmpty()) return;
  onResize();
  const sizeVec = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(sizeVec.x, sizeVec.y, sizeVec.z);
  const aspect = camera.aspect || (canvas.clientWidth / Math.max(1, canvas.clientHeight));
  controls.reset();
  const isFlat = maxSize > 0 && sizeVec.z <= maxSize * 0.001;
  let distance = maxSize * 1.2 || 1.0;
  if (isFlat) {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const halfY = Math.max(sizeVec.y * 0.5, 1e-3);
    const halfX = Math.max(sizeVec.x * 0.5, 1e-3);
    const fitHeight = halfY / Math.tan(fov / 2);
    const fitWidth = halfX / (Math.tan(fov / 2) * Math.max(aspect, 1e-3));
    distance = Math.max(fitHeight, fitWidth) * 1.15;
    camera.position.set(center.x, center.y, center.z + distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
  } else {
    const size = sizeVec.length();
    distance = size * 0.7;
    camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.5, distance));
  }
  controls.target.copy(center);
  controls.update();

  camera.near = Math.max(maxSize / 100, 0.01);
  camera.far = maxSize * 10;
  camera.updateProjectionMatrix();

  if (diagFrameSourceEl) diagFrameSourceEl.textContent = lastFrameSource || "n/a";
  if (diagFrameSizeEl) diagFrameSizeEl.textContent = `${sizeVec.x.toFixed(1)} x ${sizeVec.y.toFixed(1)}`;
  if (diagFrameDistanceEl) diagFrameDistanceEl.textContent = Number.isFinite(distance) ? distance.toFixed(1) : "n/a";
  if (diagFrameAspectEl) diagFrameAspectEl.textContent = Number.isFinite(aspect) ? aspect.toFixed(2) : "n/a";
}

function pickPreferredBounds(frameBounds, viewBounds, docBounds, fallback) {
  const docFallback = docBounds && !docBounds.isEmpty() ? docBounds : null;
  const fallbackBounds = docFallback || (fallback && !fallback.isEmpty() ? fallback : null);
  const referenceBounds = docFallback || fallbackBounds;
  const maxRatio = 6;
  const prunedFrame = isOversizedBounds(frameBounds, referenceBounds, maxRatio) ? null : frameBounds;
  const prunedView = isOversizedBounds(viewBounds, referenceBounds, maxRatio) ? null : viewBounds;
  if (!prunedFrame && !prunedView && docBounds && !docBounds.isEmpty() && fallbackBounds && !fallbackBounds.isEmpty()) {
    const docArea = getSpaceArea(docBounds);
    const fallbackArea = getSpaceArea(fallbackBounds);
    if (docArea > 0 && fallbackArea > 0 && fallbackArea > docArea * 3) {
      return { bounds: docBounds, source: "document" };
    }
  }
  const candidates = [
    { bounds: prunedFrame, min: 0.2, max: 5.0, source: "frame" },
    { bounds: prunedView, min: 0.02, max: 10.0, source: "vport" },
  ];
  for (const entry of candidates) {
    const bounds = entry.bounds;
    if (!bounds || bounds.isEmpty()) continue;
    if (!fallbackBounds) {
      return { bounds, source: entry.source };
    }
    const chosen = chooseBounds(bounds, fallbackBounds, entry.min, entry.max);
    if (chosen === bounds) {
      return { bounds, source: entry.source };
    }
  }
  if (docBounds && !docBounds.isEmpty()) {
    if (!fallbackBounds || fallbackBounds.isEmpty()) {
      return { bounds: docBounds, source: "document" };
    }
    const docArea = getSpaceArea(docBounds);
    const fallbackArea = getSpaceArea(fallbackBounds);
    if (docArea > 0 && fallbackArea > 0 && docArea >= fallbackArea * 0.02) {
      return { bounds: docBounds, source: "document" };
    }
  }
  if (fallbackBounds) {
    return { bounds: fallbackBounds, source: "scene" };
  }
  for (const entry of candidates) {
    if (entry.bounds && !entry.bounds.isEmpty()) {
      return { bounds: entry.bounds, source: entry.source };
    }
  }
  return { bounds: null, source: "n/a" };
}

function frameSpace() {
  const frameBounds = resolveFrameBounds(resolvedSpace);
  const viewBounds = resolveActiveModelViewBounds(resolvedSpace);
  const docBounds = resolveDocumentBounds(resolvedSpace, true);
  const sceneBoundsFallback = sceneBounds.full || sceneBounds.main;
  const picked = pickPreferredBounds(frameBounds, viewBounds, docBounds, sceneBoundsFallback);
  const bounds = picked.bounds;
  lastFrameSource = picked.source || "mixed";
  frameBox(bounds || sceneBoundsFallback);
}

function frameScene(object) {
  sceneBounds.full = computeFullBounds(object);
  sceneBounds.main = computeRobustBounds(object) || sceneBounds.full;
  updateTextHeightFallback(sceneBounds.main || sceneBounds.full);
  frameSpace();
  updateDiagnostics();
}

function fitAll() {
  if (!activeScene) return;
  if (!sceneBounds.full) {
    sceneBounds.full = computeFullBounds(activeScene);
  }
  const sceneBoundsFallback = sceneBounds.full || sceneBounds.main;
  const frameBounds = resolveFrameBounds(resolvedSpace);
  const viewBounds = resolveActiveModelViewBounds(resolvedSpace);
  const docBounds = resolveDocumentBounds(resolvedSpace, false);
  const picked = pickPreferredBounds(frameBounds, viewBounds, docBounds, sceneBoundsFallback);
  const bounds = picked.bounds;
  lastFrameSource = picked.source || "mixed";
  frameBox(bounds || sceneBoundsFallback);
}

function fitMain() {
  if (!activeScene) return;
  if (!sceneBounds.main) {
    sceneBounds.main = computeRobustBounds(activeScene) || sceneBounds.full;
  }
  const sceneBoundsFallback = sceneBounds.full || sceneBounds.main;
  const frameBounds = resolveFrameBounds(resolvedSpace);
  const viewBounds = resolveActiveModelViewBounds(resolvedSpace);
  const docBounds = resolveDocumentBounds(resolvedSpace, true);
  const picked = pickPreferredBounds(frameBounds, viewBounds, docBounds, sceneBoundsFallback);
  const bounds = picked.bounds;
  lastFrameSource = picked.source || "mixed";
  frameBox(bounds || sceneBoundsFallback);
}

function loadScene(url) {
  updateLoadDetails({ gltfUrl: url });
  setStatus("Loading scene...");
  resetScene();
  loader.load(
    url,
    (gltf) => {
      activeScene = gltf.scene;
      scene.add(activeScene);

      selectable = [];
      lineRenderables = [];
      activeScene.traverse((child) => {
        if (!child.visible) return; // 跳过已隐藏的对象
        if (child.isMesh) {
          selectable.push(child);
          child.castShadow = true;
          child.receiveShadow = true;
        } else if (isLineObject(child)) {
          const applied = applyLineSliceMaterials(child);
          if (!applied) {
            applyLineStyle(child);
          }
          lineRenderables.push(child);
        }
      });
      frameScene(activeScene);
      updateCounts();
      tryApplyMetadata();
      refreshOutlierClipPlanes();
      refreshWideLines();
      refreshViewportOverlays();
      setStatus("Loaded successfully.");
    },
    undefined,
    (error) => {
      console.error(error);
      const label = url ? `Failed to load glTF: ${url}` : "Failed to load glTF.";
      setStatus(label, true);
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

  const hit = hits.find((candidate) => {
    const resolved = resolveEntityFromHit(candidate);
    return isSpaceVisible(resolved?.entity, resolved?.slice);
  });
  if (!hit) {
    clearSelection();
    return;
  }
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
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  updateWideLineResolution(width, height);
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

loadBtn.addEventListener("click", () => {
  const url = gltfUrlInput.value.trim();
  if (!url) {
    setStatus("Enter a glTF URL.", true);
    return;
  }
  if (!isProbablyGltfUrl(url)) {
    setStatus("Enter a .gltf or .glb URL.", true);
    return;
  }
  const isDesktopContext = window.location.protocol === "file:" || !!window.vemcadDesktop;
  if (isDesktopContext && !isRemoteUrl(url) && !url.startsWith("file://")) {
    setStatus("Use Open CAD File or provide a http(s)/file:// glTF URL.", true);
    return;
  }
  resetMetadataState();
  loadScene(url);
});

if (fitAllBtn) {
  fitAllBtn.addEventListener("click", fitAll);
}

if (fitMainBtn) {
  fitMainBtn.addEventListener("click", fitMain);
}

if (previewCadBtn) {
  previewCadBtn.addEventListener("click", () => setPreviewMode("cad"));
}
if (previewPdfBtn) {
  previewPdfBtn.addEventListener("click", () => setPreviewMode("pdf"));
}

if (spaceAutoBtn) {
  spaceAutoBtn.addEventListener("click", () => setSpaceMode("auto"));
}
if (spaceModelBtn) {
  spaceModelBtn.addEventListener("click", () => setSpaceMode("model"));
}
if (spacePaperBtn) {
  spacePaperBtn.addEventListener("click", () => setSpaceMode("paper"));
}
if (spaceAllBtn) {
  spaceAllBtn.addEventListener("click", () => setSpaceMode("all"));
}
if (contrastSoftBtn) {
  contrastSoftBtn.addEventListener("click", () => setContrastMode("soft"));
}
if (contrastHighBtn) {
  contrastHighBtn.addEventListener("click", () => setContrastMode("high"));
}
if (contrastDarkBtn) {
  contrastDarkBtn.addEventListener("click", () => setContrastMode("dark"));
}
if (outlierHideBtn) {
  outlierHideBtn.addEventListener("click", () => setOutlierMode(true));
}
if (outlierShowBtn) {
  outlierShowBtn.addEventListener("click", () => setOutlierMode(false));
}
if (textScaleInput) {
  textScaleInput.addEventListener("input", (event) => {
    setTextScale(event.target.value);
  });
}
if (textScaleInput) {
  setTextScale(textScaleInput.value);
} else {
  updateTextScaleDisplay();
}
applyContrastProfile();
updateOutlierControls();

const desktopBridge = window.vemcadDesktop;
let openCadBusy = false;

function formatOpenCadError(result) {
  if (!result) return "Conversion failed.";
  if (result.error_code === "DWG_CONVERT_NOT_CONFIGURED") {
    return (
      "DWG converter missing. Install LibreDWG (dwg2dxf) or set VEMCAD_DWG_CONVERT_CMD (e.g. ODA/Teigha)."
    );
  }
  if (result.error_code) return `${result.error} (${result.error_code})`;
  return result.error || "Conversion failed.";
}

function formatSettingsTestError(result, fallbackMessage) {
  if (!result) return fallbackMessage;
  if (result.error_code) return `${result.error || fallbackMessage} (${result.error_code})`;
  return result.error || fallbackMessage;
}

function formatRouterHealthDetails(health) {
  if (!health || typeof health !== "object") return "";
  const parts = [];
  const version = sanitizeText(health.version);
  if (version) {
    parts.push(`v${version}`);
  }
  const commit = sanitizeText(health.commit);
  if (commit) {
    parts.push(`commit ${commit.slice(0, 8)}`);
  }
  if (Number.isFinite(health.uptime_seconds)) {
    parts.push(`uptime ${health.uptime_seconds}s`);
  }
  const defaultPlugin = sanitizeText(health.default_plugin);
  if (defaultPlugin) {
    parts.push(`plugin ${defaultPlugin}`);
  }
  const defaultConvertCli = sanitizeText(health.default_convert_cli);
  if (defaultConvertCli) {
    parts.push(`cli ${defaultConvertCli}`);
  }
  return parts.length ? ` (${parts.join(", ")})` : "";
}

if (settingsForm) {
  settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}

function handleSettingsSave() {
  const settings = readSettingsFromForm();
  saveDesktopSettings(settings);
  setStatus("Settings saved.");
  setSettingsStatus("Settings saved.");
  closeSettingsModal();
}

function handleSettingsReset() {
  const defaults = normalizeDesktopSettings({});
  saveDesktopSettings(defaults);
  applySettingsToForm(defaults);
  setStatus("Settings reset.");
  setSettingsStatus("Settings reset.");
}

if (settingsSaveBtn) {
  settingsSaveBtn.addEventListener("click", handleSettingsSave);
}

if (settingsResetBtn) {
  settingsResetBtn.addEventListener("click", handleSettingsReset);
}

async function handleTestRouter() {
  if (!desktopBridge?.testRouter) {
    setSettingsStatus("Desktop bridge not available.", true);
    return;
  }
  setSettingsStatus("Testing router...");
  try {
    const result = await desktopBridge.testRouter(readSettingsFromForm());
    if (!result?.ok) {
      setSettingsStatus(formatSettingsTestError(result, "Router test failed."), true);
      return;
    }
    const started = result.started ? " (auto-started)" : "";
    const healthDetails = formatRouterHealthDetails(result.health);
    if (result.health_error) {
      setSettingsStatus(`Router reachable${started}. Health unavailable: ${result.health_error}`);
      return;
    }
    setSettingsStatus(`Router reachable${started}${healthDetails}.`);
  } catch (error) {
    setSettingsStatus(`Router test failed: ${error?.message || "unknown error"}`, true);
  }
}

async function handleTestDwg() {
  if (!desktopBridge?.testDwg) {
    setSettingsStatus("Desktop bridge not available.", true);
    return;
  }
  setSettingsStatus("Checking DWG converter...");
  try {
    const result = await desktopBridge.testDwg(readSettingsFromForm());
    if (!result?.ok) {
      setSettingsStatus(formatSettingsTestError(result, "DWG converter not configured."), true);
      return;
    }
    const detail = result.message || "DWG converter configured.";
    setSettingsStatus(detail);
  } catch (error) {
    setSettingsStatus(`DWG check failed: ${error?.message || "unknown error"}`, true);
  }
}

async function applyManifestResult(result) {
  if (!result?.manifest_url) {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  params.set("manifest", result.manifest_url);
  if (result.project_id) params.set("project_id", result.project_id);
  if (result.document_label) params.set("document_label", result.document_label);
  if (result.document_id) params.set("document_id", result.document_id);
  window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  await loadFromManifest(result.manifest_url, params);
  return true;
}

async function handleOpenCadResult(result) {
  if (!result || result.canceled) {
    setStatus("Open cancelled.");
    return;
  }
  if (!result.ok) {
    setStatus(formatOpenCadError(result), true);
    return;
  }

  const requestId = Number.isFinite(result.request_id) ? result.request_id : null;
  openCadRequestId = requestId;
  openCadPreviewLineOnly = !!result.line_only;

  if (result.manifest_url) {
    const applied = await applyManifestResult(result);
    if (applied && openCadPreviewLineOnly) {
      setStatus("Preview loaded (line-only). Full render in progress...");
    }
    return;
  }

  if (result.viewer_url) {
    window.location.assign(result.viewer_url);
    return;
  }

  setStatus("Router response missing viewer URL.", true);
}

if (settingsTestRouterBtn) {
  settingsTestRouterBtn.addEventListener("click", handleTestRouter);
}

if (settingsTestDwgBtn) {
  settingsTestDwgBtn.addEventListener("click", handleTestDwg);
}

if (settingsCancelBtn) {
  settingsCancelBtn.addEventListener("click", () => closeSettingsModal());
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", () => closeSettingsModal());
}

if (settingsBackdrop) {
  settingsBackdrop.addEventListener("click", () => closeSettingsModal());
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal && !settingsModal.classList.contains("is-hidden")) {
    closeSettingsModal();
  }
});

async function handleOpenCadFile() {
  if (!desktopBridge?.openCadFile || openCadBusy) return;
  openCadBusy = true;
  const originalLabel = openCadBtn ? openCadBtn.textContent : "";
  if (openCadBtn) {
    openCadBtn.disabled = true;
    openCadBtn.textContent = "Opening...";
  }
  setStatus("Select a CAD file to convert...");
  try {
    const settings = await resolveDesktopSettings();
    const result = await desktopBridge.openCadFile(settings);
    await handleOpenCadResult(result);
  } catch (error) {
    setStatus(`Conversion failed: ${error?.message || "unknown error"}`, true);
  } finally {
    openCadBusy = false;
    if (openCadBtn) {
      openCadBtn.disabled = false;
      openCadBtn.textContent = originalLabel;
    }
  }
}

if (openCadBtn && desktopBridge?.openCadFile) {
  openCadBtn.classList.remove("is-hidden");
  openCadBtn.addEventListener("click", handleOpenCadFile);
}

if (settingsBtn && desktopBridge?.openCadFile) {
  settingsBtn.classList.remove("is-hidden");
  settingsBtn.addEventListener("click", openSettingsModal);
}

if (desktopBridge?.onOpenSettings) {
  desktopBridge.onOpenSettings(openSettingsModal);
}

if (desktopBridge?.onOpenCadFile) {
  desktopBridge.onOpenCadFile(() => {
    handleOpenCadFile();
  });
}

if (desktopBridge?.onOpenCadResult) {
  desktopBridge.onOpenCadResult((payload) => {
    handleOpenCadResult(payload);
  });
}

if (desktopBridge?.onFullManifestReady) {
  desktopBridge.onFullManifestReady(async (payload) => {
    if (!payload?.manifest_url) return;
    const payloadRequestId = Number.isFinite(payload.request_id) ? payload.request_id : null;
    if (payloadRequestId !== null && openCadRequestId !== null && payloadRequestId !== openCadRequestId) {
      return;
    }
    setStatus("Loading full render...");
    try {
      await applyManifestResult(payload);
      openCadPreviewLineOnly = false;
      setStatus("Full render loaded.");
    } catch (error) {
      setStatus(`Full render failed: ${error?.message || "unknown error"}`, true);
    }
  });
}

if (desktopBridge?.onFullManifestError) {
  desktopBridge.onFullManifestError((payload) => {
    const payloadRequestId = Number.isFinite(payload?.request_id) ? payload.request_id : null;
    if (payloadRequestId !== null && openCadRequestId !== null && payloadRequestId !== openCadRequestId) {
      return;
    }
    const message = payload?.error || "Full render failed.";
    setStatus(message, true);
  });
}

window.addEventListener("resize", onResize);
canvas.addEventListener("pointerdown", onPointerDown);

function markBootReady() {
  window.__VEMCAD_APP_READY__ = true;
  if (typeof window.__VEMCAD_BOOT_OK__ === "function") {
    window.__VEMCAD_BOOT_OK__();
  }
}

function isProbablyGltfUrl(url) {
  if (!url) return false;
  return /\.(gltf|glb)(?:[?#].*)?$/i.test(url);
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url);
}

async function bootstrapScene() {
  const params = new URLSearchParams(window.location.search);
  await hydrateManifestBaseOverride();
  updateLoadDetails({ viewerUrl: window.location.href });
  setPreviewUrl("");
  setPreviewMode("cad");
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
  const isDesktopContext = window.location.protocol === "file:" || !!window.vemcadDesktop;
  if (fallback && isProbablyGltfUrl(fallback)) {
    if (isDesktopContext && !isRemoteUrl(fallback) && !fallback.startsWith("file://")) {
      setStatus("Ready. Use Open CAD File or enter a glTF URL.");
      return;
    }
    resetMetadataState();
    loadScene(fallback);
    return;
  }
  setStatus("Ready. Use Open CAD File or enter a glTF URL.");
}

bootstrapScene();
animate();
markBootReady();

diffStatusOrder.forEach((status) => diffFilters.set(status, true));
diffToggleInputs.forEach((input) => {
  const status = input.dataset.diff;
  if (!status) return;
  diffFilters.set(status, input.checked);
  input.addEventListener("change", () => {
    diffFilters.set(status, input.checked);
    applyDiffFilters();
  });
});

if (diffOnlyBtn) {
  diffOnlyBtn.addEventListener("click", () => {
    diffStatusOrder.forEach((status) => {
      setDiffFilter(status, status !== "unchanged");
    });
    applyDiffFilters();
  });
}

if (diffAllBtn) {
  diffAllBtn.addEventListener("click", () => {
    diffStatusOrder.forEach((status) => setDiffFilter(status, true));
    applyDiffFilters();
  });
}
