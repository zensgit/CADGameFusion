const form = document.getElementById("upload-form");
const routerInput = document.getElementById("router-url");
const tokenInput = document.getElementById("token-input");
const fileInput = document.getElementById("file-input");
const projectInput = document.getElementById("project-input");
const documentInput = document.getElementById("document-input");
const ownerInput = document.getElementById("owner-input");
const tagsInput = document.getElementById("tags-input");
const revisionInput = document.getElementById("revision-input");
const pluginInput = document.getElementById("plugin-input");
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
const filterState = document.getElementById("filter-state");
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

function setStatus(label, state) {
  statusPill.textContent = label;
  statusPill.dataset.state = state || "idle";
}

function normalizeBaseUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return window.location.origin;
  }
  return trimmed.replace(/\/$/, "");
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
      setStatus("Error", "error");
      return;
    }

    if (payload.state === "done") {
      setStatus("Done", "done");
      setPreview(payload.viewer_url);
      return;
    }

    if (payload.state === "error") {
      setStatus("Error", "error");
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
      card.innerHTML = `
        <div class="history-item__row">
          <span class="history-item__label">Document</span>
          <span class="history-item__value">${label}</span>
        </div>
        <div class="history-item__row">
          <span class="history-item__label">State</span>
          <span class="history-item__status ${statusClass}">${item.state}</span>
        </div>
        <div class="history-item__row">
          <span class="history-item__label">Created</span>
          <span class="history-item__value">${item.created_at || "-"}</span>
        </div>
      `;
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
        err.textContent = item.error;
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

function buildDetailText(parts) {
  return parts.filter((part) => part && part.trim()).join(" · ");
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
    const detail = buildDetailText([
      item.owner ? `Owner: ${item.owner}` : "",
      formatTags(item.tags) ? `Tags: ${formatTags(item.tags)}` : "",
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
    const detail = buildDetailText([
      item.owner ? `Owner: ${item.owner}` : "",
      formatTags(item.tags) ? `Tags: ${formatTags(item.tags)}` : "",
      item.revision_note ? `Revision: ${item.revision_note}` : "",
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
  const stateValue = filterState.value;
  const fromValue = filterFrom.value.trim();
  const toValue = filterTo.value.trim();
  if (projectValue) params.set("project_id", projectValue);
  if (stateValue) params.set("state", stateValue);
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
  const url = `${baseUrl}/projects?limit=50`;
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
  const url = `${baseUrl}/projects/${encodeURIComponent(projectId)}/documents?limit=50`;
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
  const url = `${baseUrl}/documents/${encodeURIComponent(documentId)}/versions?limit=25`;
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
      setStatus("Error", "error");
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
fetchHistory();
fetchProjects();
scheduleHistoryPoll();
form.addEventListener("submit", handleSubmit);
refreshHistoryBtn.addEventListener("click", fetchHistory);
historyPollToggle.addEventListener("change", scheduleHistoryPoll);
filterProject.addEventListener("input", fetchHistory);
filterState.addEventListener("change", fetchHistory);
filterFrom.addEventListener("input", fetchHistory);
filterTo.addEventListener("input", fetchHistory);
refreshIndexBtn.addEventListener("click", fetchProjects);
