// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("posHost", {
  call: (method, args) => import_electron.ipcRenderer.invoke("pos:call", method, args),
  updateCheck: () => import_electron.ipcRenderer.invoke("pos:update-check"),
  updateApply: () => import_electron.ipcRenderer.invoke("pos:update-apply"),
  updateFull: () => import_electron.ipcRenderer.invoke("pos:update-full"),
  makeShortcut: () => import_electron.ipcRenderer.invoke("pos:make-shortcut"),
  relaunch: (hard) => import_electron.ipcRenderer.invoke("pos:relaunch", hard === true),
  openDataFolder: () => import_electron.ipcRenderer.invoke("pos:open-data-folder")
});
