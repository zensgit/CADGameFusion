const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vemcadDesktop", {
  openCadFile: async (settings) => ipcRenderer.invoke("vemcad:open-cad-file", settings),
  getDefaultSettings: async () => ipcRenderer.invoke("vemcad:get-default-settings"),
  testRouter: async (settings) => ipcRenderer.invoke("vemcad:test-router", settings),
  testDwg: async (settings) => ipcRenderer.invoke("vemcad:test-dwg", settings),
  onOpenSettings: (handler) => {
    if (typeof handler !== "function") return;
    ipcRenderer.on("vemcad:open-settings", () => handler());
  },
});
