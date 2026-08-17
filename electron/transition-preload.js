// Transition overlay bridge.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tr", {
  onData: (cb) => ipcRenderer.on("transition:data", (_e, data) => cb(data)),
  start: () => ipcRenderer.send("transition:start"),
  snooze: () => ipcRenderer.send("transition:snooze"),
  skip: () => ipcRenderer.send("transition:skip"),
  close: () => ipcRenderer.send("transition:close"),
});
