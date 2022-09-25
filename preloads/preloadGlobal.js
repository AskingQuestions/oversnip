// Bare bones settings module with watchers.

const { contextBridge, ipcRenderer } = require("electron");

let watchers = [];

let settingsCache = null;

contextBridge.exposeInMainWorld("settings", {
  getSettings() {
    return settingsCache;
  },
  setSetting(key, value) {
    ipcRenderer.invoke("setSetting", { key, value });
  },
  watch(cb) {
    watchers.push(cb);
  },
  unwatch(cb) {
    watchers = watchers.filter((watcher) => watcher !== cb);
  },
  openSettings() {
    ipcRenderer.invoke("openSettings");
  },
});

ipcRenderer.on("settings", async (event, newSettings) => {
  settingsCache = newSettings;
  watchers.forEach((cb) => cb(newSettings));
});

// Editor

let encodedData;
let nonce = 0;
let recroppedHandler = () => {};

contextBridge.exposeInMainWorld("snip", {
  getEncoded: () => encodedData,
  startDrag(data) {
    ipcRenderer.invoke("ondragstart", data);
  },
  async search(data) {
    await ipcRenderer.invoke("search", data);
  },
  async deleteUpload(index) {
    await ipcRenderer.invoke("deleteUpload", { index });
  },
  async upload(data) {
    return await ipcRenderer.invoke("upload", data);
  },
  async getWindowPosition() {
    return await ipcRenderer.invoke("getWindowPosition");
  },
  moveWindow(x, y) {
    ipcRenderer.invoke("moveWindow", { x, y, nonce });
    nonce++;
  },
  recrop(x, y, width, height, baseX, baseY, dx, dy, editorMargin) {
    ipcRenderer.invoke("recrop", {
      x,
      y,
      width,
      height,
      baseX,
      baseY,
      dx,
      dy,
      editorMargin,
    });
  },
  async getWindowBounds() {
    return await ipcRenderer.invoke("getWindowBounds");
  },
  onRecropped(handler) {
    recroppedHandler = handler;
  },
});

ipcRenderer.on("SET_SOURCE", async (event, encoded) => {
  encodedData = encoded;
});

ipcRenderer.on("recropped", (event, encoded) => {
  recroppedHandler(encoded);
});
