const { contextBridge, ipcRenderer } = require("electron");

let encodedData;

contextBridge.exposeInMainWorld("snip", {
  getEncoded: () => encodedData,
  startDrag(data) {
    ipcRenderer.invoke("ondragstart", data);
  },
  search(data) {
    ipcRenderer.invoke("search", data);
  },
});

ipcRenderer.on("SET_SOURCE", async (event, encoded) => {
  encodedData = encoded;
});
