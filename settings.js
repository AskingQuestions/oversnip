const fs = require("fs");
const path = require("path");
const { app } = require("electron");

let loadedSettings = null;
let watchers = [];

const Defaults = {
  // Shortcuts
  "shortcut.snipRegion": {
    ctrlOrCmd: true,
    alt: true,
    code: "KeyS",
  },

  "shortcut.lockSnips": {
    ctrlOrCmd: true,
    alt: true,
    code: "KeyL",
  },

  "shortcut.colorPicker": {
    ctrlOrCmd: true,
    alt: true,
    code: "KeyQ",
  },

  "shortcut.imageSearchRegion": {
    ctrlOrCmd: true,
    alt: true,
    code: "KeyI",
  },

  "shortcut.pen": {
    code: "KeyV",
  },
  "shortcut.highlighter": {
    code: "KeyH",
  },
  "shortcut.eraser": {
    code: "KeyE",
  },
  "shortcut.redact": {
    code: "KeyR",
  },
  "shortcut.arrow": {
    code: "KeyA",
  },
  "shortcut.box": {
    code: "KeyB",
  },
  "shortcut.search": {
    code: "KeyS",
  },
  "shortcut.palette": {
    code: "KeyP",
  },
  "shortcut.scan": {
    code: "KeyT",
  },
  "shortcut.imgur": {
    code: "KeyU",
  },
  "shortcut.settings": {
    code: "KeyI",
  },

  "tool.pen.color": "#FF0000",
  "tool.pen.size": 20,

  "tool.highlighter.color": "#FFFF00",
  "tool.highlighter.size": 20,

  "tool.eraser.size": 50,

  "tool.redact.size": 20,

  "tool.arrow.color": "#00FF00",
  "tool.arrow.size": 10,

  "tool.box.color": "#0000FF",
  "tool.box.size": 10,

  "imageSearch.quality": "low",

  autocopy: true,
  playSnipAnimation: true,
};

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function getSettings() {
  if (!loadedSettings) {
    try {
      loadedSettings = JSON.parse(fs.readFileSync(getSettingsPath()));
    } catch (e) {
      loadedSettings = {};
    }
  }

  let defaults = JSON.parse(JSON.stringify(Defaults));
  return {
    ...defaults,
    ...loadedSettings,
  };
}

function saveSettings() {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(loadedSettings));
}

/**
 * Listen for changes to settings.
 *
 * @param {Function(settings : Object)} cb
 */
function watchSettings(cb) {
  watchers.push(cb);
}

function notifyWatchers() {
  let settings = getSettings();
  watchers.forEach((cb) => cb(settings));
}

function unwatchSettings(cb) {
  watchers = watchers.filter((watcher) => watcher !== cb);
}

/**
 * Set a setting.
 *
 * Note: This will automatically save the settings to disk.
 *
 * @param {String} key
 * @param {*} value
 */
function setSetting(key, value) {
  loadedSettings[key] = value;
  notifyWatchers();
  saveSettings();
}

module.exports = {
  Defaults,
  getSettings,
  setSetting,
  saveSettings,
  getSettingsPath,
  watchSettings,
  unwatchSettings,
  notifyWatchers,
};
