const IMGUR_AUTH = "Client-ID 11fb3973a131eff";

const { getSettings, setSetting, watchSettings } = require("./settings.js");

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
  webFrame,
  Menu,
} = require("electron");

let doOpenInstallWindow = false;

// this should be placed at top of main.js to handle setup events quickly
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require("child_process");
  const path = require("path");

  const appFolder = path.resolve(process.execPath, "..");
  const rootAtomFolder = path.resolve(appFolder, "..");
  const updateDotExe = path.resolve(path.join(rootAtomFolder, "Update.exe"));
  const selfExe = path.resolve(path.join(rootAtomFolder, "oversnip.exe"));
  const exeName = path.basename(process.execPath);

  const spawn = function (command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, { detached: true });
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function (args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case "--squirrel-install":
    case "--squirrel-updated":
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(["--createShortcut", exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-uninstall":
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(["--removeShortcut", exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case "--squirrel-obsolete":
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
    case "--squirrel-firstrun":
      doOpenInstallWindow = true;
  }
}

const path = require("path");
const fs = require("fs");
const got = require("got");

const ICON_PATH = path.join(__dirname, "images", "icon.ico");
const TRAY_ICON_PATH = path.join(__dirname, "images", "iconTemplate.png");

const Jimp = require("jimp");

const editorMargin = 100;

const isDev = process.env.IS_DEV === "true";

let snippingWindows = [];
let editorWindows = [];
let settingWatcherWindows = [];
let colorWindows = [];

function addSettingWatcher(window) {
  settingWatcherWindows.push(window);
  sendSettingsToWindow(window);
}

let images = {};
let editorImages = {};
let windowSizes = {};
let imageIndex = 0;
let currentColorPicker;
let currentColorPickerDisplay;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: ICON_PATH,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadGlobal.js"),
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile("index.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

function createSnipWindow(opts) {
  const { screen } = require("electron");
  let factor = screen.getPrimaryDisplay().scaleFactor;
  const snipWindow = new BrowserWindow({
    x: opts.area.x,
    y: opts.area.y,
    width: opts.width / 1,
    height: opts.height / 1,
    transparent: true,
    frame: false,

    icon: ICON_PATH,

    fullscreen: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadSnip.js"),
      // zoomFactor: 1.0,
    },
  });
  snipWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  snipWindow.setAlwaysOnTop(true, "normal");

  // and load the index.html of the app.
  snipWindow.loadFile("snip.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
  snipWindow.setBounds({
    x: opts.area.x,
    y: opts.area.y,
    width: opts.width / 1,
    height: opts.height / 1,
  });
  return snipWindow;
}

function createColorPicker(opts) {
  let factor = opts.display.scaleFactor;

  const pickerWindow = new BrowserWindow({
    x: opts.area.x,
    y: opts.area.y,
    width: Math.floor(opts.width),
    height: Math.floor(opts.height),
    transparent: true,
    frame: false,

    icon: ICON_PATH,

    fullscreen: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadPicker.js"),
      zoomFactor: 1.0 / factor,
    },
  });
  pickerWindow.once("ready-to-show", () => {
    pickerWindow.webContents.setZoomFactor(1.0 / factor);
    pickerWindow.show();
  });
  pickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pickerWindow.setAlwaysOnTop(true, "floating");

  // and load the index.html of the app.
  pickerWindow.loadFile("picker.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
  pickerWindow.setBounds({
    x: opts.area.x,
    y: opts.area.y,
    width: Math.floor(opts.width),
    height: Math.floor(opts.height),
  });
  return pickerWindow;
}

/**
 * Color slots are placed at the bottom right of the screen
 */
function findOpenColorSlot() {
  let slots = [];

  function AABBIntersect(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 5; y++) {
      let taken = false;
      for (let win of colorWindows) {
        if (
          !win.isDestroyed() &&
          AABBIntersect(win.getBounds(), {
            x:
              currentColorPickerDisplay.workArea.x +
              currentColorPickerDisplay.size.width -
              500 +
              x * 100 +
              2,
            y:
              currentColorPickerDisplay.workArea.y +
              currentColorPickerDisplay.size.height -
              500 +
              y * 100 +
              2,
            width: 100 - 4,
            height: 100 - 4,
          })
        ) {
          taken = true;
          break;
        }
      }

      if (!taken) {
        slots.push({ x: x, y: y });
      }
    }
  }

  if (slots.length > 0) {
    // Sort by closest to the bottom right
    slots = slots.sort((a, b) => {
      let aDist = Math.sqrt(Math.pow(a.x - 4, 2) + Math.pow(a.y - 4, 2));
      let bDist = Math.sqrt(Math.pow(b.x - 4, 2) + Math.pow(b.y - 4, 2));
      return aDist - bDist;
    });

    return slots[0];
  } else {
    return { x: 0, y: 0 };
  }
}

function createColorCard(opts) {
  let slot = findOpenColorSlot();

  let setBounds = {
    x:
      currentColorPickerDisplay.workArea.x +
      currentColorPickerDisplay.size.width -
      500 +
      slot.x * 100,
    y:
      currentColorPickerDisplay.workArea.y +
      currentColorPickerDisplay.size.height -
      500 +
      slot.y * 100,
    width: 100,
    height: 100,
  };

  const cardWindow = new BrowserWindow({
    ...setBounds,
    transparent: true,
    frame: false,

    icon: ICON_PATH,

    fullscreen: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadCard.js"),
    },
  });
  cardWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  currentColorPicker.setAlwaysOnTop(true, "normal");
  cardWindow.setAlwaysOnTop(true, "normal");
  for (let colWin of colorWindows) {
    if (!colWin.isDestroyed()) colWin.setAlwaysOnTop(true, "normal");
  }

  cardWindow.loadFile("card.html");

  cardWindow.setBounds(setBounds);
  cardWindow.webContents.send("SET_SOURCE", {
    hex: opts.hex,
  });
  colorWindows.push(cardWindow);

  return cardWindow;
}

function killWindows() {
  for (let w of snippingWindows) if (!w.isDestroyed()) w.destroy();
}

async function captureSnip(autoImageSearch = false) {
  let veryStart = performance.now();
  killWindows();
  const { screen } = require("electron");
  const currentScreen = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );

  let sourceIndex = screen
    .getAllDisplays()
    .findIndex((d) => d.id === currentScreen.id);

  let factor = currentScreen.scaleFactor;
  const primaryDisplay = currentScreen;
  const { width, height } = primaryDisplay.size;

  console.log(`Capturing snip at ${width * factor}x${height * factor}`);

  let capNow = performance.now();
  let index = imageIndex++;
  desktopCapturer
    .getSources({
      types: ["screen"],
      thumbnailSize: {
        height: Math.floor(height * factor),
        width: Math.floor(width * factor),
      },
    })
    .then(async (sources) => {
      let source = sources.find(
        (s) => parseInt(s.display_id) === primaryDisplay.id
      );

      if (!source) {
        source = source[sourceIndex];
      }

      if (source) {
        console.log("Found display", source.display_id);

        let now = performance.now();
        console.log(`Took ${now - capNow}ms to get sources`);

        now = performance.now();
        // let url2 = await source.thumbnail.toDataURL({
        //   scaleFactor: 1.0,
        // });

        let url2 = source.thumbnail.toBitmap();
        var image = new Jimp(width * factor, height * factor, async function (
          err,
          image
        ) {
          let buffer = image.bitmap.data;
          let snipPath = path.join(app.getPath("temp"), `snip${index}.png`);
          for (var x = 0; x < width * factor; x++) {
            for (var y = 0; y < height * factor; y++) {
              const offset = (y * width * factor + x) * 4; // RGBA = 4 bytes
              buffer[offset] = url2[offset + 2]; // R
              buffer[offset + 1] = url2[offset + 1]; // G
              buffer[offset + 2] = url2[offset + 0]; // B
              buffer[offset + 3] = url2[offset + 3]; // Alpha
            }
          }
          await image.write(snipPath);

          console.log(`Took ${performance.now() - now}ms to get PNG`);

          let url =
            "data:image/png;base64," +
            fs.readFileSync(snipPath).toString("base64");

          let snipWindow = createSnipWindow({
            width,
            height,
            area: primaryDisplay.workArea,
          });

          snippingWindows.push(snipWindow);

          let nowSnip = performance.now();
          images[snipWindow.webContents.id] = {
            index,
            url,
            width,
            height,
            display: primaryDisplay,
            autoImageSearch,
          };
          snipWindow.webContents.send("SET_SOURCE", {
            index,
            width,
            height,
          });

          console.log(`Took ${performance.now() - nowSnip}ms to send source`);

          console.log(
            `Took ${performance.now() - veryStart}ms to capture shot`
          );
        });

        return;
      }
    });
}

async function openColorPicker() {
  let veryStart = performance.now();
  killWindows();
  const { screen } = require("electron");
  const currentScreen = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );

  let sourceIndex = screen
    .getAllDisplays()
    .findIndex((d) => d.id === currentScreen.id);

  let factor = currentScreen.scaleFactor;
  const primaryDisplay = currentScreen;
  const { width, height } = primaryDisplay.size;

  console.log(`Capturing snip at ${width * factor}x${height * factor}`);

  let capNow = performance.now();
  let index = imageIndex++;
  desktopCapturer
    .getSources({
      types: ["screen"],
      thumbnailSize: {
        height: Math.floor(height * factor),
        width: Math.floor(width * factor),
      },
    })
    .then(async (sources) => {
      let source = sources.find(
        (s) => parseInt(s.display_id) === primaryDisplay.id
      );

      if (!source) {
        source = source[sourceIndex];
      }

      if (source) {
        console.log("Found display", source.display_id);

        let now = performance.now();
        console.log(`Took ${now - capNow}ms to get sources`);

        now = performance.now();

        let url2 = source.thumbnail.toBitmap();
        var image = new Jimp(width * factor, height * factor, async function (
          err,
          image
        ) {
          let buffer = image.bitmap.data;
          let snipPath = path.join(app.getPath("temp"), `snip${index}.png`);
          for (var x = 0; x < width * factor; x++) {
            for (var y = 0; y < height * factor; y++) {
              const offset = (y * width * factor + x) * 4; // RGBA = 4 bytes
              buffer[offset] = url2[offset + 2]; // R
              buffer[offset + 1] = url2[offset + 1]; // G
              buffer[offset + 2] = url2[offset + 0]; // B
              buffer[offset + 3] = url2[offset + 3]; // Alpha
            }
          }
          await image.write(snipPath);

          console.log(`Took ${performance.now() - now}ms to get PNG`);

          let url =
            "data:image/png;base64," +
            fs.readFileSync(snipPath).toString("base64");

          let snipWindow = createColorPicker({
            display: primaryDisplay,
            width,
            height,
            area: primaryDisplay.workArea,
          });

          snippingWindows.push(snipWindow);

          let nowSnip = performance.now();
          images[snipWindow.webContents.id] = {
            index,
            url,
            width,
            height,
            display: primaryDisplay,
          };
          console.log(width, factor);
          snipWindow.webContents.send("SET_SOURCE", {
            index,
            width: width * factor,
            height: height * factor,
            factor,
          });
          currentColorPicker = snipWindow;
          currentColorPickerDisplay = primaryDisplay;

          console.log(`Took ${performance.now() - nowSnip}ms to send source`);

          console.log(
            `Took ${performance.now() - veryStart}ms to capture shot`
          );
        });

        return;
      }
    });
}

/**
 * Maps the structure:
 * {
 *  ctrlOrCmd: true,
 *  alt: true,
 *  code: "KeyS",
 * }
 *
 * to an electron accelerator string
 */
function mapShortcutToAccelerator(shortcut) {
  let accelerator = "";
  if (shortcut.ctrlOrCmd) {
    accelerator += "CmdOrCtrl+";
  }
  if (shortcut.meta) {
    accelerator += "Meta+";
  }
  if (shortcut.ctrl) {
    accelerator += "Ctrl+";
  }
  if (shortcut.alt) {
    accelerator += "Alt+";
  }
  if (shortcut.shift) {
    accelerator += "Shift+";
  }
  if (shortcut.code) {
    if (shortcut.code.startsWith("Key")) {
      accelerator += shortcut.code.substring(3).toUpperCase();
    } else if (shortcut.code.startsWith("Digit")) {
      accelerator += shortcut.code.substring(5);
    } else if (shortcut.code.startsWith("Numpad")) {
      if (shortcut.code === "NumpadDecimal") {
        accelerator += "numdec";
      } else if (shortcut.code === "NumpadAdd") {
        accelerator += "numadd";
      } else if (shortcut.code === "NumpadSubtract") {
        accelerator += "numsub";
      } else if (shortcut.code === "NumpadMultiply") {
        accelerator += "nummult";
      } else if (shortcut.code === "NumpadDivide") {
        accelerator += "numdiv";
      } else {
        accelerator += "num" + shortcut.code.substring(6);
      }
    } else if (shortcut.code.startsWith("Arrow")) {
      accelerator += shortcut.code.substring(5).toUpperCase();
    } else if (shortcut.code == "Equal") {
      accelerator += "=";
    } else if (shortcut.code == "Minus") {
      accelerator += "-";
    } else if (shortcut.code == "Backquote") {
      accelerator += "`";
    } else {
      accelerator += shortcut.code;
    }
  }
  return accelerator;
}

let toggleLock = false;

function registerGlobalShortcuts() {
  let settings = getSettings();

  globalShortcut.unregisterAll();

  try {
    globalShortcut.register(
      mapShortcutToAccelerator(settings["shortcut.snipRegion"]),
      captureSnip
    );
  } catch (e) {
    console.log(e);
  }

  try {
    globalShortcut.register(
      mapShortcutToAccelerator(settings["shortcut.imageSearchRegion"]),
      () => captureSnip(true)
    );
  } catch (e) {
    console.log(e);
  }

  try {
    globalShortcut.register(
      mapShortcutToAccelerator(settings["shortcut.colorPicker"]),
      openColorPicker
    );
  } catch (e) {
    console.log(e);
  }

  try {
    globalShortcut.register(
      mapShortcutToAccelerator(settings["shortcut.lockSnips"]),
      () => {
        toggleLock = !toggleLock;
        // Lock all windows
        for (let w of editorWindows) {
          if (!w.isDestroyed()) {
            w.setIgnoreMouseEvents(toggleLock);
            console.log(toggleLock);
          }
        }
      }
    );
  } catch (e) {
    console.log(e);
  }
}

function registerTray() {
  tray = new Tray(TRAY_ICON_PATH);

  const contextMenu = Menu.buildFromTemplate([
    {
      icon: path.resolve(__dirname, "images", "icon.png"),
      label: "Oversnip",
      type: "normal",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Capture Snip",
      type: "normal",
      click() {
        captureSnip();
      },
    },
    {
      label: "Pick Color",
      type: "normal",
      click() {
        openColorPicker();
      },
    },
    {
      label: "Image Search",
      type: "normal",
      click() {
        captureSnip(true);
      },
    },
    { type: "separator" },
    {
      label: "Settings",
      type: "normal",
      click() {
        openSettings();
      },
    },
    {
      label: "Quit",
      type: "normal",
      click() {
        app.quit();
      },
    },
  ]);
  tray.setToolTip("Oversnip");
  tray.setContextMenu(contextMenu);
}

function registerIPCHandlers() {
  ipcMain.handle("search", async (event, data) => {
    // Upload to imgur

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
      console.log("Uploaded to imgur at " + resp.data.link);
      shell.openExternal(
        `https://images.google.com/searchbyimage?image_url=${resp.data.link}`
      );
      setTimeout(async () => {
        let delResp = await got
          .delete(`https://api.imgur.com/3/image/${resp.data.deletehash}`, {
            headers: {
              Authorization: IMGUR_AUTH,
            },
          })
          .json();
        console.log("Image deleted with status: ", delResp.status);
      }, 6000);
    }
  });

  let imgurCounter = 0;
  let imgurUploads = {};

  ipcMain.handle("deleteUpload", async (event, data) => {
    if (imgurUploads[data.index]) {
      let delResp = await got
        .delete(`https://api.imgur.com/3/image/${imgurUploads[data.index]}`, {
          headers: {
            Authorization: IMGUR_AUTH,
          },
        })
        .json();
      console.log("Image deleted with status: ", delResp.status);
      delete imgurUploads[data.index];
    }
  });

  ipcMain.handle("upload", async (event, data) => {
    // Upload to imgur

    let resp = await got
      .post("https://api.imgur.com/3/image", {
        headers: {
          Authorization: IMGUR_AUTH,
        },
        form: {
          image: data,
        },
      })
      .json();

    if (resp.data?.link) {
      console.log("Uploaded to imgur at " + resp.data.link);
      shell.openExternal(resp.data.link);
      imgurCounter++;
      imgurUploads[imgurCounter] = resp.data.deletehash;
      return {
        link: resp.data.link,
        index: imgurCounter,
      };
    }
  });

  ipcMain.handle("ondragstart", async (event, data) => {
    let filePath = path.join(app.getPath("temp"), "./snip.png");
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    event.sender.startDrag({
      file: filePath,
      icon: await nativeImage.createThumbnailFromPath(filePath, {
        width: 50,
        height: 25,
      }),
    });
  });

  ipcMain.handle("getWindowPosition", async (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    return window.getPosition();
  });

  ipcMain.handle("getWindowBounds", async (event) => {
    let window = BrowserWindow.fromWebContents(event.sender);
    console.log(window.getBounds());
    return window.getBounds();
  });

  let moveWindowCounts = {};
  let cropWindowCounts = {};

  ipcMain.handle("moveWindow", async (event, data) => {
    if (!moveWindowCounts[event.sender.id]) {
      moveWindowCounts[event.sender.id] = 0;
    }
    if (data.nonce < moveWindowCounts[event.sender.id]) {
      return;
    }
    moveWindowCounts[event.sender.id] = data.nonce;
    let window = BrowserWindow.fromWebContents(event.sender);

    window.setBounds({
      x: data.x,
      y: data.y,
      width: windowSizes[window.id].width,
      height: windowSizes[window.id].height,
    });
  });

  ipcMain.handle("recrop", async (event, data) => {
    if (!cropWindowCounts[event.sender.id]) {
      cropWindowCounts[event.sender.id] = 0;
    }
    if (data.nonce < cropWindowCounts[event.sender.id]) {
      return;
    }
    cropWindowCounts[event.sender.id] = data.nonce;
    let window = BrowserWindow.fromWebContents(event.sender);

    let sourceImage = editorImages[event.sender.id];
    let factor = sourceImage.display.scaleFactor;
    let setBounds = {
      x: Math.max(0, Math.floor(data.x / 1)),
      y: Math.max(0, Math.floor(data.y / 1)),
      width: Math.min(sourceImage.width, Math.floor(data.width / 1)),
      height: Math.min(sourceImage.height, Math.floor(data.height / 1)),
    };
    let extendsMargin = editorMargin;
    let extendsMarginBottom = editorMargin;
    if (setBounds.width < 400) {
      extendsMargin = 300;
    }

    let windowBounds = {
      x:
        data.baseX +
        data.dx +
        (data.editorMargin != 300
          ? setBounds.width < 400
            ? -200
            : 0
          : setBounds.width < 400
          ? 0
          : 200),
      y: data.baseY + data.dy,
      width: setBounds.width + extendsMargin * 2,
      height: setBounds.height + extendsMarginBottom + 20,
    };

    window.setBounds(windowBounds);
    windowSizes[window.id] = {
      width: windowBounds.width,
      height: windowBounds.height,
    };

    window.webContents.send("recropped", {
      url: editorImages[event.sender.id].url,
      index: editorImages[event.sender.id].index,
      width: editorImages[event.sender.id].width,
      height: editorImages[event.sender.id].height,
      factor,
      editorMargin: extendsMargin,
      editorMarginBottom: extendsMarginBottom,
      bounds: setBounds,
    });
  });

  ipcMain.handle("close", (event, data) => {
    killWindows();
  });

  ipcMain.handle("SNIP", (event, data) => {
    killWindows();

    const { screen } = require("electron");
    let sourceImage = images[event.sender.id];
    let factor = sourceImage.display.scaleFactor;
    // factor = 1;
    let setBounds = {
      x: Math.floor(data.x / 1),
      y: Math.floor(data.y / 1),
      width: Math.floor(data.width / 1),
      height: Math.floor(data.height / 1),
    };
    let extendsMargin = editorMargin;
    let extendsMarginBottom = editorMargin;
    if (setBounds.width < 400) {
      extendsMargin = 300;
      console.log("Extending margin to 400");
    }

    let windowBounds = {
      x: sourceImage.display.workArea.x + setBounds.x - extendsMargin,
      y: sourceImage.display.workArea.y + setBounds.y - 20,
      width: setBounds.width + extendsMargin * 2,
      height: setBounds.height + extendsMarginBottom + 20,
    };

    let aspectRatio = setBounds.width / setBounds.height;

    if (windowBounds.width > windowBounds.height) {
      // Don't allow the window to grow past 80% of the screen
      if (windowBounds.width > sourceImage.display.size.width * 0.8) {
        windowBounds.width =
          Math.floor(sourceImage.display.size.width * 0.8) + extendsMargin * 2;
        windowBounds.height = Math.floor(
          Math.floor(sourceImage.display.size.width * 0.8) / aspectRatio +
            extendsMarginBottom +
            20
        );

        // Center along x
        windowBounds.x =
          sourceImage.display.workArea.x +
          Math.floor(
            sourceImage.display.size.width / 2 - windowBounds.width / 2
          );
        windowBounds.y =
          sourceImage.display.workArea.y +
          Math.floor(
            sourceImage.display.size.height / 2 - windowBounds.height / 2
          );
      }
    } else {
      if (windowBounds.height > sourceImage.display.size.height * 0.8) {
        windowBounds.height =
          Math.floor(sourceImage.display.size.height * 0.8) +
          extendsMarginBottom +
          20;
        windowBounds.width = Math.floor(
          Math.floor(sourceImage.display.size.height * 0.8) * aspectRatio +
            extendsMargin * 2
        );
        console.log(aspectRatio, windowBounds.width, windowBounds.height);

        // Center along y
        windowBounds.y =
          sourceImage.display.workArea.y +
          Math.floor(
            sourceImage.display.size.height / 2 - windowBounds.height / 2
          );
        windowBounds.x =
          sourceImage.display.workArea.x +
          Math.floor(
            sourceImage.display.size.width / 2 - windowBounds.width / 2
          );
      }
    }

    const snipWindow = new BrowserWindow({
      useContentSize: false,

      // Duplicate code called with set bounds below
      x: windowBounds.x,
      y: windowBounds.y,
      width: windowBounds.width,
      height: windowBounds.height,
      // End duplicate code

      transparent: true,
      frame: false,
      hasShadow: false,
      alwaysOnTop: true,
      resizable: false,

      icon: ICON_PATH,

      webPreferences: {
        preload: path.join(__dirname, "preloads/preloadGlobal.js"),
        // zoomFactor: 1.0,
      },
    });

    editorWindows.push(snipWindow);

    addSettingWatcher(snipWindow);

    windowSizes[snipWindow.id] = windowBounds;

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
      autoImageSearch: images[event.sender.id].autoImageSearch,
      factor,
      editorMargin: extendsMargin,
      editorMarginBottom: extendsMarginBottom,
      bounds: setBounds,
    });
    editorImages[snipWindow.webContents.id] = images[event.sender.id];
    delete images[event.sender.id];

    // and load the index.html of the app.
    openFrontend(snipWindow, "editor.html");

    snipWindow.setBounds(windowBounds);
  });

  ipcMain.handle("pickColor", (event, data) => {
    const { screen } = require("electron");
    createColorCard({
      hex: data.hex,
    });
  });

  ipcMain.handle("setSetting", async (event, data) => {
    console.log(data);
    setSetting(data.key, data.value);
  });

  ipcMain.handle("openSettings", async (event, data) => {
    openSettings();
  });
}

function openFrontend(win, file) {
  if (isDev) {
    win.loadURL("http://localhost:5173/" + file);
  } else {
    win.loadFile(path.join(__dirname, "build", file));
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  if (doOpenInstallWindow) {
    openInstallWindow();
  }
  registerGlobalShortcuts();

  registerTray();

  protocol.registerFileProtocol("snip", (request, callback) => {
    callback({
      path: path.join(
        app.getPath("temp"),
        "snip" + request.url.replace("snip://", "")
      ),
    });
  });

  createWindow();

  registerIPCHandlers();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  watchSettings(() => {
    for (let window of settingWatcherWindows) {
      if (!window.isDestroyed()) {
        console.log("Sending settings to window", window.id);
        sendSettingsToWindow(window);
      }
    }

    registerGlobalShortcuts();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.setLoginItemSettings({
  openAtLogin: true,
});

function openSettings() {
  const { BrowserWindow } = require("electron");
  const settingsWindow = new BrowserWindow({
    width: 444,
    height: 600,
    minWidth: 444,
    minHeight: 300,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadGlobal.js"),
    },
  });

  openFrontend(settingsWindow, "settings.html");
  addSettingWatcher(settingsWindow);
}

function openInstallWindow() {
  const { BrowserWindow } = require("electron");
  const installWindow = new BrowserWindow({
    width: 444,
    height: 600,
    minWidth: 444,
    minHeight: 300,
    autoHideMenuBar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preloads/preloadGlobal.js"),
    },
  });

  openFrontend(installWindow, "install.html");
  addSettingWatcher(installWindow);
}

function sendSettingsToWindow(window) {
  window.webContents.send("settings", getSettings());
}
