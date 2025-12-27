const form = document.getElementById("upload-form");
const routerInput = document.getElementById("router-url");
const tokenInput = document.getElementById("token-input");
const fileInput = document.getElementById("file-input");
const projectInput = document.getElementById("project-input");
const documentInput = document.getElementById("document-input");
const pluginInput = document.getElementById("plugin-input");
const cliInput = document.getElementById("cli-input");
const emitSelect = document.getElementById("emit-select");
const hashToggle = document.getElementById("hash-toggle");
const legacyToggle = document.getElementById("legacy-toggle");
const asyncToggle = document.getElementById("async-toggle");
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

let activeTaskId = null;
let pollTimer = null;
let historyTimer = null;

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
scheduleHistoryPoll();
form.addEventListener("submit", handleSubmit);
refreshHistoryBtn.addEventListener("click", fetchHistory);
historyPollToggle.addEventListener("change", scheduleHistoryPoll);
filterProject.addEventListener("input", fetchHistory);
filterState.addEventListener("change", fetchHistory);
filterFrom.addEventListener("input", fetchHistory);
filterTo.addEventListener("input", fetchHistory);
