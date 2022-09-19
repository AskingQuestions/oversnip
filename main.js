// Modules to control application life and create native browser window
const {
  app,
  BrowserWindow,
  Tray,
  globalShortcut,
  desktopCapturer,
  ipcMain,
  protocol,
  nativeImage,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const got = require("got");

const editorMargin = 100;

let snippingWindows = [];

let images = {};
let imageIndex = 0;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  appIcon = new Tray("./images/icon.png");

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

function createSnipWindow(opts) {
  const { screen } = require("electron");
  let factor = screen.getPrimaryDisplay().scaleFactor;
  const snipWindow = new BrowserWindow({
    width: opts.width / factor,
    height: opts.height / factor,
    transparent: true,
    frame: false,
    fullscreen: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preloadSnip.js"),
      zoomFactor: 1.0 / factor,
    },
  });

  // and load the index.html of the app.
  snipWindow.loadFile("snip.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
  return snipWindow;
}

function killWindows() {
  for (let w of snippingWindows) if (!w.isDestroyed()) w.destroy();
}

const screenshot = require("screenshot-desktop");

async function captureSnip() {
  killWindows();
  const { screen } = require("electron");
  let factor = screen.getPrimaryDisplay().scaleFactor;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  console.log(`Capturing snip at ${width * factor}x${height * factor}`);
  if (true) {
    let index = imageIndex++;
    then = performance.now();
    let img = await screenshot({
      format: "png",
      filename: `snip${index}.png`,
    });
    let url = "data:image/png;base64," + img.toString("base64");
    let now = performance.now();
    console.log(`Took ${now - then}ms to capture shot`);

    // now = performance.now();
    // let buff = fs.readFileSync("./test.png");
    // fs.unlinkSync("./test.png");
    // console.log(`Took ${performance.now() - now}ms to read file`);

    let snipWindow = createSnipWindow({ width, height });

    snippingWindows.push(snipWindow);

    let nowSnip = performance.now();
    images[snipWindow.webContents.id] = {
      index,
      url,
      width,
      height,
    };
    snipWindow.webContents.send("SET_SOURCE", {
      index,
    });
    console.log(`Took ${performance.now() - nowSnip}ms to send source`);
  } else {
    let capNow = performance.now();

    desktopCapturer
      .getSources({
        types: ["screen"],
        thumbnailSize: {
          height: Math.floor(height * factor),
          width: Math.floor(width * factor),
        },
      })
      .then(async (sources) => {
        for (const source of sources) {
          let now = performance.now();
          console.log(`Took ${now - capNow}ms to get sources`);
          let url2 = await source.thumbnail.toBitmap();
          let url = "data:image/bmp," + url2.toString("base64");
          then = performance.now();
          console.log(`Took ${then - now}ms to convert to png`);
          let snipWindow = createSnipWindow({ width, height });
          snippingWindows.push(snipWindow);

          let nowSnip = performance.now();
          images[snipWindow.webContents.id] = {
            url,
            width,
            height,
          };
          snipWindow.webContents.send("SET_SOURCE", url);
          console.log(`Took ${performance.now() - nowSnip}ms to send source`);

          return;
        }
      });
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  protocol.registerFileProtocol("snip", (request, callback) => {
    console.log(
      path.join(__dirname, "snip" + request.url.replace("snip://", ""))
    );
    callback({
      path: path.join(__dirname, "snip" + request.url.replace("snip://", "")),
    });
  });
  createWindow();
  globalShortcut.register("CommandOrControl+Alt+S", captureSnip);
  globalShortcut.register("Escape", () => {
    killWindows();
  });
  ipcMain.handle("search", async (event, data) => {
    // Upload to imgur
    // const formData = new FormData();
    // formData.append("image", Buffer.from(data, "base64"));

    let resp = await got
      .post("https://api.imgur.com/3/image", {
        headers: {
          Authorization: "Client-ID 11fb3973a131eff",
        },
        form: {
          image: data,
        },
      })
      .json();

    if (resp.data?.link) {
      shell.openExternal(
        `https://images.google.com/searchbyimage?image_url=${resp.data.link}`
      );
      setTimeout(async () => {
        let delResp = await got
          .delete(`https://api.imgur.com/3/image/${resp.data.deletehash}`, {
            headers: {
              Authorization: "Client-ID 11fb3973a131eff",
            },
          })
          .json();
        console.log("Image deleted with status: ", delResp.status);
      }, 6000);
    }
  });
  ipcMain.handle("ondragstart", async (event, data) => {
    let filePath = path.join(__dirname, "./snip.png");
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    event.sender.startDrag({
      file: filePath,
      icon: await nativeImage.createThumbnailFromPath(filePath, {
        width: 100,
        height: 100,
      }),
    });
  });
  ipcMain.handle("SNIP", (event, data) => {
    killWindows();

    const { screen } = require("electron");
    let factor = screen.getPrimaryDisplay().scaleFactor;
    let setBounds = {
      x: Math.floor(data.x / factor),
      y: Math.floor(data.y / factor),
      width: Math.floor(data.width / factor),
      height: Math.floor(data.height / factor),
    };
    const snipWindow = new BrowserWindow({
      x: setBounds.x - editorMargin,
      y: setBounds.y,
      width: setBounds.width + editorMargin * 2,
      height: setBounds.height + editorMargin,
      minHeight: 0,
      minWidth: 0,
      maxHeight: screen.getPrimaryDisplay().size.height,
      maxWidth: screen.getPrimaryDisplay().size.width,
      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, "preloadEditor.js"),
        zoomFactor: 1.0 / factor,
      },
    });

    snipWindow.webContents.setWindowOpenHandler(function ({ url }) {
      console.log(url.substring(0, 40));
      shell.openExternal(url);
      return { action: "deny" };
    });

    snipWindow.webContents.send("SET_SOURCE", {
      url: images[event.sender.id].url,
      index: images[event.sender.id].index,
      width: images[event.sender.id].width,
      height: images[event.sender.id].height,
      factor,
      editorMargin,
      bounds: setBounds,
    });
    delete images[event.sender.id];

    // and load the index.html of the app.
    snipWindow.loadURL("http://localhost:5173");

    // snipWindow.setPosition(data.x / factor, data.y / factor);
    // snipWindow.setSize(data.width / factor, data.height / factor);
  });
  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
