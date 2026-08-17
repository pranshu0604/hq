// Overload overlay bridge.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ovl", {
  onData: (cb) => ipcRenderer.on("overload:data", (_e, data) => cb(data)),
  start: () => ipcRenderer.send("overload:start"),
  open: () => ipcRenderer.send("overload:open"),
  close: () => ipcRenderer.send("overload:close"),
});
