const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vemcadDesktop", {
  openCadFile: async (settings) => ipcRenderer.invoke("vemcad:open-cad-file", settings),
  openCadPath: async (payload) => ipcRenderer.invoke("vemcad:open-cad-path", payload),
  getDefaultSettings: async () => ipcRenderer.invoke("vemcad:get-default-settings"),
  getAppInfo: async () => ipcRenderer.invoke("vemcad:get-app-info"),
  getRecentCadFiles: async () => ipcRenderer.invoke("vemcad:get-recent-cad-files"),
  clearRecentCadFiles: async () => ipcRenderer.invoke("vemcad:clear-recent-cad-files"),
  registerFileAssociations: async () => ipcRenderer.invoke("vemcad:register-file-associations"),
  saveDiagnostics: async (payload) => ipcRenderer.invoke("vemcad:save-diagnostics", payload),
  testRouter: async (settings) => ipcRenderer.invoke("vemcad:test-router", settings),
  testDwg: async (settings) => ipcRenderer.invoke("vemcad:test-dwg", settings),
  exportDxf: async (params) => ipcRenderer.invoke("vemcad:export-dxf", params),
  notifyRendererReady: () => ipcRenderer.send("vemcad:renderer-ready"),
  onOpenSettings: (handler) => {
    if (typeof handler !== "function") return;
    ipcRenderer.on("vemcad:open-settings", () => handler());
  },
  onOpenCadRequest: (handler) => {
    if (typeof handler !== "function") return;
    ipcRenderer.on("vemcad:open-cad-request", (_event, payload) => handler(payload || {}));
  },
  onRecentCadFilesChanged: (handler) => {
    if (typeof handler !== "function") return;
    ipcRenderer.on("vemcad:recent-cad-files-changed", (_event, payload) => handler(payload || {}));
  },
  onLoadDocumentIntoEditor: (handler) => {
    if (typeof handler !== "function") return;
    ipcRenderer.on("vemcad:load-document-into-editor", (_event, payload) => handler(payload || {}));
  },
});
