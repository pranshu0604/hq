// Beacon renderer bridge — receive-only. The beacon never sends anything; it's a
// pure display surface driven by the main process.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("beacon", {
  onUpdate: (cb) => ipcRenderer.on("beacon:update", (_e, data) => cb(data)),
  onDodge: (cb) => ipcRenderer.on("beacon:dodge", (_e, on) => cb(on)),
});
