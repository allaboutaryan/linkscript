const { app, BrowserWindow, dialog, shell } = require("electron");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_URL = "http://localhost:4000";

async function startServer() {
  process.env.NODE_ENV = "production";
  process.env.PORT = "4000";

  const serverEntry = pathToFileURL(path.join(ROOT_DIR, "server", "src", "index.js")).href;
  await import(serverEntry);
}

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    function check() {
      http
        .get(`${SERVER_URL}/health`, (response) => {
          response.resume();
          resolve();
        })
        .on("error", () => {
          retries -= 1;

          if (retries <= 0) {
            reject(new Error("LinkPad server did not start."));
            return;
          }

          setTimeout(check, 250);
        });
    }

    check();
  });
}

async function createWindow() {
  try {
    await startServer();
    await waitForServer();
  } catch (error) {
    dialog.showErrorBox("Could not start LinkPad", error.message);
    app.quit();
    return;
  }

  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: "#09090b",
    title: "LinkPad",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await window.loadURL(SERVER_URL);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});
