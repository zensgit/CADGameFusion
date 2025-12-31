import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("viewport");
const statusEl = document.getElementById("status");
const gltfUrlInput = document.getElementById("gltf-url");
const loadBtn = document.getElementById("load-btn");
const meshCountEl = document.getElementById("mesh-count");
const vertexCountEl = document.getElementById("vertex-count");
const triangleCountEl = document.getElementById("triangle-count");
const selectionInfoEl = document.getElementById("selection-info");
const annotationListEl = document.getElementById("annotation-list");
const metaProjectIdEl = document.getElementById("meta-project-id");
const metaDocumentLabelEl = document.getElementById("meta-document-label");
const metaDocumentIdEl = document.getElementById("meta-document-id");
const metaManifestEl = document.getElementById("meta-manifest");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

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
let selected = null;
const annotationGroup = new THREE.Group();
scene.add(annotationGroup);
const annotations = [];
let meshMetadata = null;
let documentData = null;
let entityIndex = new Map();
let layerColors = new Map();
let meshSlices = [];
let metadataApplied = false;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#c0392b" : "#5f6b73";
}

function resetMetadataState() {
  meshMetadata = null;
  documentData = null;
  entityIndex = new Map();
  layerColors = new Map();
  meshSlices = [];
  metadataApplied = false;
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

function resolveEntityColor(entity, fallbackLayerId = null) {
  const layerId = Number.isFinite(entity?.layer_id) ? entity.layer_id : fallbackLayerId;
  const layerColor = Number.isFinite(layerId) ? (layerColors.get(layerId) ?? 0xdcdce6) : 0xdcdce6;
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

function ingestDocumentData(doc) {
  documentData = doc;
  entityIndex = new Map();
  layerColors = new Map();
  if (Array.isArray(doc?.layers)) {
    doc.layers.forEach((layer) => {
      if (layer && Number.isFinite(layer.id)) {
        layerColors.set(layer.id, Number.isFinite(layer.color) ? layer.color : 0);
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
}

function ingestMeshMetadata(meta) {
  meshMetadata = meta;
  meshSlices = Array.isArray(meta?.entities) ? meta.entities : [];
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
    if (entity?.color_source) {
      rows.push(`<div class="selection__row"><span>Color Source</span><strong>${entity.color_source}</strong></div>`);
    }
    if (Number.isFinite(entity?.color_aci)) {
      rows.push(`<div class="selection__row"><span>Color ACI</span><strong>${entity.color_aci}</strong></div>`);
    }
    if (entity || layerId != null) {
      const resolved = resolveEntityColor(entity ?? {}, layerId);
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
    const entity = entityIndex.get(slice.id) || {};
    const colorInt = resolveEntityColor(entity, slice.layer_id);
    const material = new THREE.MeshStandardMaterial({
      color: colorIntToHex(colorInt),
      metalness: 0.05,
      roughness: 0.7
    });
    materials.push(material);
    geometry.addGroup(slice.index_offset, slice.index_count, materials.length - 1);
  });
  if (materials.length > 0) {
    mesh.material = materials;
    mesh.userData.cadgfSlices = meshSlices;
  }
}

function tryApplyMetadata() {
  if (metadataApplied || !activeScene || meshSlices.length === 0 || entityIndex.size === 0) return;
  activeScene.traverse((child) => {
    if (child.isMesh) {
      applyEntityMaterials(child);
    }
  });
  metadataApplied = true;
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
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  controls.reset();
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.5, size * 0.7));
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
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
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
  resetMetadataState();
  loadScene(url);
});

window.addEventListener("resize", onResize);
canvas.addEventListener("pointerdown", onPointerDown);

async function bootstrapScene() {
  const params = new URLSearchParams(window.location.search);
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
