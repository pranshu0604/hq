// Minimal, locked-down bridge. Nothing sensitive is exposed today — this exists
// so future menu-bar/overlay features can talk to the shell without opening up
// nodeIntegration to the web app.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hqDesktop", {
  isDesktop: true,
  navigate: (route) => ipcRenderer.invoke("hq:navigate", route),
});
