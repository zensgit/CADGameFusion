const form = document.getElementById("upload-form");
const routerInput = document.getElementById("router-url");
const fileInput = document.getElementById("file-input");
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

let activeTaskId = null;
let pollTimer = null;

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

async function pollStatus(url, taskId) {
  stopPolling();
  activeTaskId = taskId;

  try {
    const response = await fetch(url);
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

  const formData = new FormData();
  formData.append("file", file);

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
form.addEventListener("submit", handleSubmit);
