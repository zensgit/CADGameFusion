const form = document.getElementById("upload-form");
const routerInput = document.getElementById("router-url");
const tokenInput = document.getElementById("token-input");
const routerInfoEl = document.getElementById("router-info");
const routerStatusEl = document.getElementById("router-status");
const routerPluginMapEl = document.getElementById("router-plugin-map");
const routerDefaultPluginEl = document.getElementById("router-default-plugin");
const routerErrorCodesEl = document.getElementById("router-error-codes");
const routerDefaultConvertCliEl = document.getElementById("router-default-convert-cli");
const routerVersionEl = document.getElementById("router-version");
const routerCommitEl = document.getElementById("router-commit");
const routerUptimeEl = document.getElementById("router-uptime");
const routerBuildTimeEl = document.getElementById("router-build-time");
const routerHostnameEl = document.getElementById("router-hostname");
const routerPidEl = document.getElementById("router-pid");
const routerRefreshBtn = document.getElementById("router-refresh");
const routerUpdatedEl = document.getElementById("router-updated");
const fileInput = document.getElementById("file-input");
const projectInput = document.getElementById("project-input");
const documentInput = document.getElementById("document-input");
const ownerInput = document.getElementById("owner-input");
const tagsInput = document.getElementById("tags-input");
const revisionInput = document.getElementById("revision-input");
const annotationInput = document.getElementById("annotation-input");
const annotationAuthorInput = document.getElementById("annotation-author");
const annotateBtn = document.getElementById("annotation-btn");
const annotationError = document.getElementById("annotation-error");
const pluginInput = document.getElementById("plugin-input");
const pluginField = document.getElementById("plugin-field");
const pluginAuto = document.getElementById("plugin-auto");
const pluginAutoNote = document.getElementById("plugin-auto-note");
const pluginOverrideBtn = document.getElementById("plugin-override");
const cliInput = document.getElementById("cli-input");
const emitSelect = document.getElementById("emit-select");
const documentTargetInput = document.getElementById("document-target");
const documentSchemaInput = document.getElementById("document-schema");
const hashToggle = document.getElementById("hash-toggle");
const legacyToggle = document.getElementById("legacy-toggle");
const asyncToggle = document.getElementById("async-toggle");
const migrateToggle = document.getElementById("migrate-toggle");
const backupToggle = document.getElementById("backup-toggle");
const validateToggle = document.getElementById("validate-toggle");
const statusPill = document.getElementById("status-pill");
const submitBtn = document.getElementById("submit-btn");
const responseEl = document.getElementById("response-json");
const viewerFrame = document.getElementById("viewer-frame");
const viewerLink = document.getElementById("viewer-link");
const placeholder = document.getElementById("preview-placeholder");
const historyList = document.getElementById("history-list");
const refreshHistoryBtn = document.getElementById("refresh-history");
const historyPollToggle = document.getElementById("history-poll");
const filterProject = document.getElementById("filter-project");
const filterOwner = document.getElementById("filter-owner");
const filterTags = document.getElementById("filter-tags");
const filterState = document.getElementById("filter-state");
const filterEvent = document.getElementById("filter-event");
const filterRevision = document.getElementById("filter-revision");
const filterFrom = document.getElementById("filter-from");
const filterTo = document.getElementById("filter-to");
const refreshIndexBtn = document.getElementById("refresh-index");
const projectList = document.getElementById("project-list");
const documentList = document.getElementById("document-list");
const versionList = document.getElementById("version-list");

let activeTaskId = null;
let pollTimer = null;
let historyTimer = null;
let selectedProjectId = "";
let selectedDocumentId = "";
let pluginOverride = false;
let routerInfoTimer = null;
let routerInfoBusy = false;

const ERROR_MESSAGES = {
  AUTH_REQUIRED: "Auth required",
  UNKNOWN_ENDPOINT: "Unknown endpoint",
  BAD_CONTENT_LENGTH: "Invalid content length",
  EMPTY_REQUEST: "Empty request",
  PAYLOAD_TOO_LARGE: "Payload too large",
  INVALID_BODY: "Invalid request body",
  MISSING_FILE: "Missing file",
  MISSING_PLUGIN: "Missing plugin",
  PLUGIN_NOT_FOUND: "Plugin not found",
  PLUGIN_NOT_ALLOWED: "Plugin not allowed",
  INVALID_DOCUMENT_ID: "Invalid document id",
  MISSING_PROJECT_ID: "Missing project id",
  MISSING_DOCUMENT_IDENTITY: "Missing document identity",
  INVALID_ANNOTATIONS_JSON: "Invalid annotations JSON",
  MISSING_ANNOTATIONS: "Missing annotations",
  DOCUMENT_NOT_FOUND: "Document not found",
  INVALID_DOCUMENT_TARGET: "Invalid document target",
  DOCUMENT_SCHEMA_NOT_ALLOWED: "Schema not allowed",
  DOCUMENT_SCHEMA_NOT_FOUND: "Schema not found",
  CONVERT_CLI_NOT_FOUND: "convert_cli not found",
  CONVERT_CLI_NOT_ALLOWED: "convert_cli not allowed",
  QUEUE_FULL: "Queue full",
  TASK_NOT_FOUND: "Task not found",
  CONVERT_FAILED: "Conversion failed",
  MANIFEST_MISSING: "Manifest missing",
  CONVERT_EXCEPTION: "Conversion crashed",
};

function setStatus(label, state) {
  statusPill.textContent = label;
  statusPill.dataset.state = state || "idle";
}

function formatErrorLabel(code, fallbackMessage) {
  const trimmed = typeof code === "string" ? code.trim() : "";
  const mapped = trimmed && ERROR_MESSAGES[trimmed] ? ERROR_MESSAGES[trimmed] : "";
  const message = mapped || fallbackMessage || "";
  if (trimmed && message) {
    return `Error: ${message} (${trimmed})`;
  }
  if (trimmed) {
    return `Error (${trimmed})`;
  }
  if (message) {
    return `Error: ${message}`;
  }
  return "Error";
}

function formatErrorText(errorMessage, code) {
  const trimmed = typeof code === "string" ? code.trim() : "";
  const mapped = trimmed && ERROR_MESSAGES[trimmed] ? ERROR_MESSAGES[trimmed] : "";
  const message = errorMessage || mapped;
  if (message && trimmed) {
    return `${message} [${trimmed}]`;
  }
  if (message) {
    return message;
  }
  return trimmed;
}

function setAnnotationError(message) {
  if (!annotationError) {
    return;
  }
  const text = message ? String(message).trim() : "";
  annotationError.textContent = text;
  annotationError.classList.toggle("is-visible", Boolean(text));
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return window.location.origin;
  }
  return trimmed.replace(/\/$/, "");
}

function formatUptime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "—";
  }
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function setRouterUpdated(timestamp) {
  if (!routerUpdatedEl) {
    return;
  }
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    routerUpdatedEl.textContent = "Last update: —";
    return;
  }
  routerUpdatedEl.textContent = `Last update: ${timestamp.toLocaleTimeString()}`;
}

function setRouterInfo(status, pluginMap, defaultPlugin, errorCodes, meta) {
  if (
    !routerInfoEl ||
    !routerStatusEl ||
    !routerPluginMapEl ||
    !routerDefaultPluginEl ||
    !routerErrorCodesEl ||
    !routerDefaultConvertCliEl ||
    !routerVersionEl ||
    !routerCommitEl ||
    !routerUptimeEl ||
    !routerBuildTimeEl ||
    !routerHostnameEl ||
    !routerPidEl
  ) {
    return;
  }
  const label = status || "unknown";
  routerStatusEl.textContent = label;
  routerStatusEl.dataset.state = label;
  routerInfoEl.dataset.state = label;
  const list = Array.isArray(pluginMap) ? pluginMap.filter(Boolean) : [];
  routerPluginMapEl.textContent = list.length ? list.join(", ") : "—";
  routerDefaultPluginEl.textContent = defaultPlugin || "—";
  const codes = Array.isArray(errorCodes) ? errorCodes.filter(Boolean) : [];
  routerErrorCodesEl.textContent = codes.length ? codes.join(", ") : "—";
  routerDefaultConvertCliEl.textContent = meta?.defaultConvertCli || "—";
  routerVersionEl.textContent = meta?.version || "—";
  routerCommitEl.textContent = meta?.commit || "—";
  routerUptimeEl.textContent = formatUptime(meta?.uptimeSeconds);
  routerBuildTimeEl.textContent = meta?.buildTime || "—";
  routerHostnameEl.textContent = meta?.hostname || "—";
  routerPidEl.textContent = meta?.pid || "—";
}

function setPluginAutoState(enabled, extensions) {
  if (!pluginField || !pluginAuto || !pluginAutoNote) {
    return;
  }
  if (!enabled) {
    pluginOverride = false;
    pluginAuto.classList.remove("is-visible");
    pluginField.style.display = "";
    return;
  }
  if (pluginOverride) {
    pluginAuto.classList.remove("is-visible");
    pluginField.style.display = "";
    return;
  }
  const list = Array.isArray(extensions) ? extensions.filter(Boolean) : [];
  pluginAutoNote.textContent = list.length
    ? `Importer plugin auto-selected for ${list.join(", ")}.`
    : "Importer plugin auto-selected by router.";
  pluginInput.value = "";
  pluginField.style.display = "none";
  pluginAuto.classList.add("is-visible");
}

async function refreshRouterPluginMap() {
  if (routerInfoBusy) {
    return;
  }
  routerInfoBusy = true;
  if (routerRefreshBtn) {
    routerRefreshBtn.disabled = true;
  }
  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      setRouterInfo("error", [], "", [], {});
      setPluginAutoState(false, []);
      setRouterUpdated(null);
      return;
    }
    const payload = await response.json();
    const map = Array.isArray(payload?.plugin_map) ? payload.plugin_map : [];
    const defaultPlugin = typeof payload?.default_plugin === "string" ? payload.default_plugin : "";
    const defaultConvertCli =
      typeof payload?.default_convert_cli === "string" ? payload.default_convert_cli : "";
    const errorCodes = Array.isArray(payload?.error_codes) ? payload.error_codes : [];
    const pidValue = Number(payload?.pid);
    const meta = {
      version: typeof payload?.version === "string" ? payload.version : "",
      commit: typeof payload?.commit === "string" ? payload.commit : "",
      buildTime: typeof payload?.build_time === "string" ? payload.build_time : "",
      hostname: typeof payload?.hostname === "string" ? payload.hostname : "",
      pid: Number.isFinite(pidValue) ? String(pidValue) : "",
      uptimeSeconds: Number(payload?.uptime_seconds),
      defaultConvertCli,
    };
    setRouterInfo(payload?.status || "ok", map, defaultPlugin, errorCodes, meta);
    setPluginAutoState(map.length > 0, map);
    setRouterUpdated(new Date());
  } catch {
    setRouterInfo("unreachable", [], "", [], {});
    setPluginAutoState(false, []);
    setRouterUpdated(null);
  } finally {
    routerInfoBusy = false;
    if (routerRefreshBtn) {
      routerRefreshBtn.disabled = false;
    }
  }
}

function scheduleRouterInfoPoll() {
  if (routerInfoTimer) {
    clearInterval(routerInfoTimer);
  }
  routerInfoTimer = setInterval(() => {
    refreshRouterPluginMap();
  }, 60000);
}

function renderResponse(payload) {
  responseEl.textContent = JSON.stringify(payload, null, 2);
}

function setPreview(url) {
  if (url) {
    viewerFrame.src = url;
    viewerFrame.classList.add("is-visible");
    placeholder.style.display = "none";
    viewerLink.href = url;
    viewerLink.setAttribute("aria-disabled", "false");
  } else {
    viewerFrame.removeAttribute("src");
    viewerFrame.classList.remove("is-visible");
    placeholder.style.display = "flex";
    viewerLink.href = "#";
    viewerLink.setAttribute("aria-disabled", "true");
  }
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function stopHistoryPolling() {
  if (historyTimer) {
    clearTimeout(historyTimer);
    historyTimer = null;
  }
}

function buildAuthHeaders() {
  const token = tokenInput.value.trim();
  if (!token) {
    return {};
  }
  return { Authorization: `Bearer ${token}` };
}

async function pollStatus(url, taskId) {
  stopPolling();
  activeTaskId = taskId;

  try {
    const response = await fetch(url, { headers: buildAuthHeaders() });
    const payload = await response.json();
    renderResponse(payload);

    if (!response.ok) {
      const errorMessage = payload?.error || payload?.message || "";
      setStatus(formatErrorLabel(payload?.error_code, errorMessage), "error");
      return;
    }

    if (payload.state === "done") {
      setStatus("Done", "done");
      setPreview(payload.viewer_url);
      return;
    }

    if (payload.state === "error") {
      setStatus(formatErrorLabel(payload?.error_code, payload?.error || ""), "error");
      return;
    }

    setStatus(payload.state || "Queued", "busy");
  } catch (err) {
    setStatus("Error", "error");
    responseEl.textContent = `Request failed: ${err}`;
    return;
  }

  pollTimer = setTimeout(() => pollStatus(url, taskId), 1200);
}

function renderHistory(items) {
  historyList.innerHTML = "";
  if (!items.length) {
    historyList.innerHTML = "<div class=\"placeholder\">No tasks yet.</div>";
    return;
  }
  const groups = new Map();
  items.forEach((item) => {
    const key = item.project_id || "unassigned";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  });
  groups.forEach((entries, projectId) => {
    const group = document.createElement("div");
    group.className = "history-group";
    const header = document.createElement("div");
    header.className = "history-group__title";
    header.textContent = projectId;
    group.appendChild(header);

    entries.forEach((item) => {
      const card = document.createElement("div");
      card.className = "history-item";
      const statusClass = item.state === "done" ? "done" : item.state === "error" ? "error" : "";
      const label = item.document_label || item.task_id;
      const tagsText = formatTags(item.tags);
      const eventLabel = item.event || "convert";
      const rows = [
        `
        <div class="history-item__row">
          <span class="history-item__label">Document</span>
          <span class="history-item__value">${label}</span>
        </div>
        `,
        `
        <div class="history-item__row">
          <span class="history-item__label">State</span>
          <span class="history-item__status ${statusClass}">${item.state}</span>
        </div>
        `,
        `
        <div class="history-item__row">
          <span class="history-item__label">Event</span>
          <span class="history-item__value">${eventLabel}</span>
        </div>
        `,
        `
        <div class="history-item__row">
          <span class="history-item__label">Created</span>
          <span class="history-item__value">${item.created_at || "-"}</span>
        </div>
        `,
      ];
      if (item.owner) {
        rows.push(`
          <div class="history-item__row">
            <span class="history-item__label">Owner</span>
            <span class="history-item__value">${item.owner}</span>
          </div>
        `);
      }
      if (tagsText) {
        rows.push(`
          <div class="history-item__row">
            <span class="history-item__label">Tags</span>
            <span class="history-item__value">${tagsText}</span>
          </div>
        `);
      }
      if (item.revision_note) {
        rows.push(`
          <div class="history-item__row">
            <span class="history-item__label">Revision</span>
            <span class="history-item__value">${item.revision_note}</span>
          </div>
        `);
      }
      const notes = normalizeAnnotations(item.annotations);
      if (notes.length) {
        const notesHtml = notes
          .map((note) => {
            const metaParts = [note.author || "", note.createdAt || ""].filter((val) => val);
            const meta = metaParts.length ? ` (${metaParts.join(" · ")})` : "";
            return `<div class="annotation-item"><span class="annotation-text">${note.message}</span><span class="annotation-meta">${meta}</span></div>`;
          })
          .join("");
        rows.push(`
          <div class="history-item__annotations">
            <div class="history-item__label">Notes</div>
            ${notesHtml}
          </div>
        `);
      }
      card.innerHTML = rows.join("");
      if (item.viewer_url) {
        const link = document.createElement("a");
        link.className = "history-item__link";
        link.href = item.viewer_url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "Open preview";
        card.appendChild(link);
      }
      if (item.error) {
        const err = document.createElement("div");
        err.className = "history-item__value";
        err.textContent = formatErrorText(item.error, item.error_code);
        card.appendChild(err);
      } else if (item.error_code) {
        const err = document.createElement("div");
        err.className = "history-item__value";
        err.textContent = formatErrorText("", item.error_code);
        card.appendChild(err);
      }
      group.appendChild(card);
    });
    historyList.appendChild(group);
  });
}

function formatTags(tags) {
  if (!tags) {
    return "";
  }
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter((tag) => tag).join(", ");
  }
  return String(tags).trim();
}

function normalizeAnnotations(annotations) {
  if (!Array.isArray(annotations)) {
    return [];
  }
  return annotations
    .map((note) => ({
      message: String(note?.message || "").trim(),
      author: String(note?.author || "").trim(),
      createdAt: String(note?.created_at || note?.created || "").trim(),
      kind: String(note?.kind || "").trim(),
    }))
    .filter((note) => note.message);
}

function buildDetailText(parts) {
  return parts.filter((part) => part && part.trim()).join(" · ");
}

function applyMetadataFilters(params) {
  const ownerValue = filterOwner.value.trim();
  const tagsValue = filterTags.value.trim();
  const revisionValue = filterRevision.value.trim();
  const eventValue = filterEvent.value;
  if (ownerValue) params.set("owner", ownerValue);
  if (tagsValue) params.set("tags", tagsValue);
  if (revisionValue) params.set("revision", revisionValue);
  if (eventValue) params.set("event", eventValue);
}

function renderIndexPlaceholder(target, message) {
  target.innerHTML = "";
  const item = document.createElement("div");
  item.className = "index-placeholder";
  item.textContent = message;
  target.appendChild(item);
}

function renderProjectList(items) {
  projectList.innerHTML = "";
  if (!items.length) {
    renderIndexPlaceholder(projectList, "No projects yet.");
    return;
  }
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "index-item";
    if (item.project_id === selectedProjectId) {
      button.classList.add("is-selected");
    }
    const docCount = typeof item.document_count === "number" ? item.document_count : 0;
    const annotationCount = typeof item.annotation_count === "number" ? item.annotation_count : 0;
    const latestNote = item.latest_annotation?.message ? String(item.latest_annotation.message).trim() : "";
    const detail = buildDetailText([
      item.owner ? `Owner: ${item.owner}` : "",
      formatTags(item.tags) ? `Tags: ${formatTags(item.tags)}` : "",
      annotationCount ? `Notes: ${annotationCount}` : "",
      latestNote ? `Latest: ${latestNote}` : "",
    ]);
    button.innerHTML = `
      <span class="index-item__label">${item.project_id}</span>
      <span class="index-item__meta">${docCount} docs</span>
      ${detail ? `<span class="index-item__detail">${detail}</span>` : ""}
    `;
    button.addEventListener("click", () => {
      if (selectedProjectId === item.project_id) {
        return;
      }
      selectedProjectId = item.project_id;
      selectedDocumentId = "";
      renderProjectList(items);
      renderDocumentList([]);
      renderVersionList([]);
      fetchDocuments(item.project_id);
    });
    projectList.appendChild(button);
  });
}

function renderDocumentList(items) {
  documentList.innerHTML = "";
  if (!items.length) {
    renderIndexPlaceholder(documentList, selectedProjectId ? "No documents yet." : "Select a project.");
    return;
  }
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "index-item";
    if (item.document_id === selectedDocumentId) {
      button.classList.add("is-selected");
    }
    const versionCount = typeof item.version_count === "number" ? item.version_count : 0;
    const annotationCount = typeof item.annotation_count === "number" ? item.annotation_count : 0;
    const latestNote = item.latest_annotation?.message ? String(item.latest_annotation.message).trim() : "";
    const detail = buildDetailText([
      item.owner ? `Owner: ${item.owner}` : "",
      formatTags(item.tags) ? `Tags: ${formatTags(item.tags)}` : "",
      item.revision_note ? `Revision: ${item.revision_note}` : "",
      annotationCount ? `Notes: ${annotationCount}` : "",
      latestNote ? `Latest: ${latestNote}` : "",
    ]);
    button.innerHTML = `
      <span class="index-item__label">${item.document_label}</span>
      <span class="index-item__meta">${versionCount} versions</span>
      ${detail ? `<span class="index-item__detail">${detail}</span>` : ""}
    `;
    button.addEventListener("click", () => {
      if (selectedDocumentId === item.document_id) {
        return;
      }
      selectedDocumentId = item.document_id;
      renderDocumentList(items);
      fetchVersions(item.document_id);
    });
    documentList.appendChild(button);
  });
}

function renderVersionList(items) {
  versionList.innerHTML = "";
  if (!items.length) {
    renderIndexPlaceholder(versionList, selectedDocumentId ? "No versions yet." : "Select a document.");
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "index-version";
    const statusClass = item.state === "done" ? "done" : item.state === "error" ? "error" : "";
    const tagsText = formatTags(item.tags);
    const eventLabel = item.event || "convert";
    const rows = [
      `
      <div class="index-version__row">
        <span class="index-version__label">Created</span>
        <span class="index-version__value">${item.created_at || "-"}</span>
      </div>
      `,
      `
      <div class="index-version__row">
        <span class="index-version__label">State</span>
        <span class="index-version__status ${statusClass}">${item.state}</span>
      </div>
      `,
      `
      <div class="index-version__row">
        <span class="index-version__label">Event</span>
        <span class="index-version__value">${eventLabel}</span>
      </div>
      `,
    ];
    if (item.owner) {
      rows.push(`
        <div class="index-version__row">
          <span class="index-version__label">Owner</span>
          <span class="index-version__value">${item.owner}</span>
        </div>
      `);
    }
    if (tagsText) {
      rows.push(`
        <div class="index-version__row">
          <span class="index-version__label">Tags</span>
          <span class="index-version__value">${tagsText}</span>
        </div>
      `);
    }
    if (item.revision_note) {
      rows.push(`
        <div class="index-version__row">
          <span class="index-version__label">Revision</span>
          <span class="index-version__value">${item.revision_note}</span>
        </div>
      `);
    }
    const notes = normalizeAnnotations(item.annotations);
    if (notes.length) {
      const notesHtml = notes
        .map((note) => {
          const metaParts = [note.author || "", note.createdAt || ""].filter((val) => val);
          const meta = metaParts.length ? ` (${metaParts.join(" · ")})` : "";
          return `<div class="annotation-item"><span class="annotation-text">${note.message}</span><span class="annotation-meta">${meta}</span></div>`;
        })
        .join("");
      rows.push(`
        <div class="index-version__row index-version__notes">
          <span class="index-version__label">Notes</span>
          <div class="index-version__value">${notesHtml}</div>
        </div>
      `);
    }
    card.innerHTML = rows.join("");
    if (item.viewer_url) {
      const link = document.createElement("a");
      link.className = "index-version__link";
      link.href = item.viewer_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Open preview";
      card.appendChild(link);
    }
    versionList.appendChild(card);
  });
}

async function fetchHistory() {
  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const params = new URLSearchParams({ limit: "50" });
  const projectValue = filterProject.value.trim();
  const ownerValue = filterOwner.value.trim();
  const tagsValue = filterTags.value.trim();
  const stateValue = filterState.value;
  const eventValue = filterEvent.value;
  const revisionValue = filterRevision.value.trim();
  const fromValue = filterFrom.value.trim();
  const toValue = filterTo.value.trim();
  if (projectValue) params.set("project_id", projectValue);
  if (ownerValue) params.set("owner", ownerValue);
  if (tagsValue) params.set("tags", tagsValue);
  if (stateValue) params.set("state", stateValue);
  if (eventValue) params.set("event", eventValue);
  if (revisionValue) params.set("revision", revisionValue);
  if (fromValue) params.set("from", fromValue);
  if (toValue) params.set("to", toValue);
  const url = `${baseUrl}/history?${params.toString()}`;
  try {
    const response = await fetch(url, { headers: buildAuthHeaders() });
    const payload = await response.json();
    if (response.ok && payload.items) {
      renderHistory(payload.items);
    } else {
      renderHistory([]);
    }
  } catch (err) {
    historyList.innerHTML = `<div class="placeholder">History unavailable: ${err}</div>`;
  }
}

async function fetchProjects() {
  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const params = new URLSearchParams({ limit: "50" });
  applyMetadataFilters(params);
  const url = `${baseUrl}/projects?${params.toString()}`;
  try {
    const response = await fetch(url, { headers: buildAuthHeaders() });
    const payload = await response.json();
    const items = response.ok && payload.items ? payload.items : [];
    const hasSelection = items.some((item) => item.project_id === selectedProjectId);
    if (!hasSelection) {
      selectedProjectId = items[0]?.project_id || "";
      selectedDocumentId = "";
    }
    renderProjectList(items);
    if (selectedProjectId) {
      await fetchDocuments(selectedProjectId);
    } else {
      renderDocumentList([]);
      renderVersionList([]);
    }
  } catch (err) {
    renderIndexPlaceholder(projectList, `Projects unavailable: ${err}`);
    renderDocumentList([]);
    renderVersionList([]);
  }
}

async function fetchDocuments(projectId) {
  if (!projectId) {
    renderDocumentList([]);
    renderVersionList([]);
    return;
  }
  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const params = new URLSearchParams({ limit: "50" });
  applyMetadataFilters(params);
  const url = `${baseUrl}/projects/${encodeURIComponent(projectId)}/documents?${params.toString()}`;
  try {
    const response = await fetch(url, { headers: buildAuthHeaders() });
    const payload = await response.json();
    const items = response.ok && payload.items ? payload.items : [];
    const hasSelection = items.some((item) => item.document_id === selectedDocumentId);
    if (!hasSelection) {
      selectedDocumentId = items[0]?.document_id || "";
    }
    renderDocumentList(items);
    if (selectedDocumentId) {
      await fetchVersions(selectedDocumentId);
    } else {
      renderVersionList([]);
    }
  } catch (err) {
    renderIndexPlaceholder(documentList, `Documents unavailable: ${err}`);
    renderVersionList([]);
  }
}

async function fetchVersions(documentId) {
  if (!documentId) {
    renderVersionList([]);
    return;
  }
  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const params = new URLSearchParams({ limit: "25" });
  applyMetadataFilters(params);
  const stateValue = filterState.value;
  const eventValue = filterEvent.value;
  const fromValue = filterFrom.value.trim();
  const toValue = filterTo.value.trim();
  if (stateValue) params.set("state", stateValue);
  if (eventValue) params.set("event", eventValue);
  if (fromValue) params.set("from", fromValue);
  if (toValue) params.set("to", toValue);
  const url = `${baseUrl}/documents/${encodeURIComponent(documentId)}/versions?${params.toString()}`;
  try {
    const response = await fetch(url, { headers: buildAuthHeaders() });
    const payload = await response.json();
    const items = response.ok && payload.items ? payload.items : [];
    renderVersionList(items);
  } catch (err) {
    renderIndexPlaceholder(versionList, `Versions unavailable: ${err}`);
  }
}

function scheduleHistoryPoll() {
  stopHistoryPolling();
  if (!historyPollToggle.checked) {
    return;
  }
  historyTimer = setTimeout(async () => {
    await fetchHistory();
    scheduleHistoryPoll();
  }, 3000);
}

function refreshFilters() {
  fetchHistory();
  fetchProjects();
}

async function handleAnnotationPost() {
  setAnnotationError("");
  const annotationText = annotationInput.value.trim();
  if (!annotationText) {
    setStatus("Add annotation text", "error");
    setAnnotationError("Annotation text is required.");
    return;
  }

  const payload = {
    annotation_text: annotationText,
    annotation_kind: "comment",
  };
  const author = annotationAuthorInput.value.trim() || ownerInput.value.trim();
  if (author) {
    payload.annotation_author = author;
  }

  const projectId = projectInput.value.trim();
  const documentLabel = documentInput.value.trim();
  if (projectId && documentLabel) {
    payload.project_id = projectId;
    payload.document_label = documentLabel;
  } else if (selectedDocumentId) {
    payload.document_id = selectedDocumentId;
  }

  if (!payload.document_id && (!payload.project_id || !payload.document_label)) {
    setStatus("Select a document", "error");
    setAnnotationError("Select a document or fill Project/Document fields.");
    return;
  }

  const owner = ownerInput.value.trim();
  if (owner) {
    payload.owner = owner;
  }
  const tags = tagsInput.value.trim();
  if (tags) {
    payload.tags = tags;
  }
  const revisionNote = revisionInput.value.trim();
  if (revisionNote) {
    payload.revision_note = revisionNote;
  }

  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const endpoint = `${baseUrl}/annotate`;
  const headers = {
    ...buildAuthHeaders(),
    "Content-Type": "application/json",
  };

  annotateBtn.disabled = true;
  setStatus("Annotating", "busy");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    renderResponse(result);

    if (!response.ok) {
      const errorMessage = result?.error || result?.message || "";
      setStatus(formatErrorLabel(result?.error_code, errorMessage), "error");
      setAnnotationError(formatErrorText(errorMessage, result?.error_code));
      return;
    }

    setStatus("Annotated", "done");
    setAnnotationError("");
    await fetchHistory();
    await fetchProjects();
    if (selectedDocumentId) {
      await fetchVersions(selectedDocumentId);
    }
  } catch (err) {
    setStatus("Error", "error");
    responseEl.textContent = `Request failed: ${err}`;
    setAnnotationError(`Request failed: ${err}`);
  } finally {
    annotateBtn.disabled = false;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  stopPolling();
  setPreview("");

  const file = fileInput.files[0];
  if (!file) {
    setStatus("Select a file", "error");
    return;
  }

  setStatus("Uploading", "busy");
  submitBtn.disabled = true;

  const baseUrl = normalizeBaseUrl(routerInput.value || window.location.origin);
  const endpoint = `${baseUrl}/convert`;
  const headers = buildAuthHeaders();

  const formData = new FormData();
  formData.append("file", file);

  const projectId = projectInput.value.trim();
  if (projectId) {
    formData.append("project_id", projectId);
  }

  const documentLabel = documentInput.value.trim();
  if (documentLabel) {
    formData.append("document_label", documentLabel);
  }

  const owner = ownerInput.value.trim();
  if (owner) {
    formData.append("owner", owner);
  }

  const tags = tagsInput.value.trim();
  if (tags) {
    formData.append("tags", tags);
  }

  const revisionNote = revisionInput.value.trim();
  if (revisionNote) {
    formData.append("revision_note", revisionNote);
  }

  const annotationText = annotationInput.value.trim();
  if (annotationText) {
    const author = annotationAuthorInput.value.trim() || owner;
    formData.append("annotation_text", annotationText);
    if (author) {
      formData.append("annotation_author", author);
    }
    formData.append("annotation_kind", "comment");
  }

  const plugin = pluginInput.value.trim();
  if (plugin) {
    formData.append("plugin", plugin);
  }

  const convertCli = cliInput.value.trim();
  if (convertCli) {
    formData.append("convert_cli", convertCli);
  }

  const emit = emitSelect.value.trim();
  if (emit) {
    formData.append("emit", emit);
  }

  if (hashToggle.checked) {
    formData.append("hash_names", "true");
  }
  if (legacyToggle.checked) {
    formData.append("keep_legacy_names", "true");
  }
  if (asyncToggle.checked) {
    formData.append("async", "true");
  }
  if (migrateToggle.checked) {
    formData.append("migrate_document", "true");
  }
  if (backupToggle.checked) {
    formData.append("document_backup", "true");
  }
  if (validateToggle.checked) {
    formData.append("validate_document", "true");
  }
  const targetValue = documentTargetInput.value.trim();
  if (targetValue) {
    formData.append("document_target", targetValue);
  }
  const schemaValue = documentSchemaInput.value.trim();
  if (schemaValue) {
    formData.append("document_schema", schemaValue);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
      headers,
    });
    const payload = await response.json();
    renderResponse(payload);

    if (!response.ok) {
      const errorMessage = payload?.error || payload?.message || "";
      setStatus(formatErrorLabel(payload?.error_code, errorMessage), "error");
      return;
    }

    const state = payload.state || "queued";
    if (state === "done") {
      setStatus("Done", "done");
      setPreview(payload.viewer_url);
      return;
    }

    const taskId = payload.task_id;
    const statusUrl = payload.status_url || `${baseUrl}/status/${taskId}`;
    setStatus(state, "busy");
    await pollStatus(statusUrl, taskId);
    await fetchHistory();
    await fetchProjects();
  } catch (err) {
    setStatus("Error", "error");
    responseEl.textContent = `Request failed: ${err}`;
  } finally {
    submitBtn.disabled = false;
  }
}

routerInput.value = normalizeBaseUrl(window.location.origin);
setPreview("");
setStatus("Idle", "idle");
refreshRouterPluginMap();
scheduleRouterInfoPoll();
fetchHistory();
fetchProjects();
scheduleHistoryPoll();
form.addEventListener("submit", handleSubmit);
routerInput.addEventListener("change", refreshRouterPluginMap);
routerInput.addEventListener("blur", refreshRouterPluginMap);
if (routerRefreshBtn) {
  routerRefreshBtn.addEventListener("click", refreshRouterPluginMap);
}
refreshHistoryBtn.addEventListener("click", fetchHistory);
historyPollToggle.addEventListener("change", scheduleHistoryPoll);
filterProject.addEventListener("input", refreshFilters);
filterOwner.addEventListener("input", refreshFilters);
filterTags.addEventListener("input", refreshFilters);
filterState.addEventListener("change", refreshFilters);
filterEvent.addEventListener("change", refreshFilters);
filterRevision.addEventListener("input", refreshFilters);
filterFrom.addEventListener("input", refreshFilters);
filterTo.addEventListener("input", refreshFilters);
refreshIndexBtn.addEventListener("click", fetchProjects);
annotateBtn.addEventListener("click", handleAnnotationPost);
if (pluginOverrideBtn) {
  pluginOverrideBtn.addEventListener("click", () => {
    pluginOverride = true;
    if (pluginAuto) {
      pluginAuto.classList.remove("is-visible");
    }
    if (pluginField) {
      pluginField.style.display = "";
    }
    pluginInput.focus();
  });
}
