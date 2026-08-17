// Quick-prompt bridge — serves the start / capture / rabbit-hole / culture modes.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hqPrompt", {
  onMode: (cb) => ipcRenderer.on("prompt:mode", (_e, mode) => cb(mode)),
  submit: (mode, text) => ipcRenderer.send("prompt:submit", { mode, text }),
  cancel: () => ipcRenderer.send("prompt:cancel"),
});
