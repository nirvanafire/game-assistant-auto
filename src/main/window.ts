import { BrowserWindow, BrowserView } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Create BrowserView for embedded browser
  browserView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setBrowserView(browserView);
  browserView.setBounds({ x: 0, y: 0, width: 700, height: 900 });
  browserView.webContents.loadURL('about:blank');

  if (process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserView = null;
  });

  return mainWindow;
}

export function getBrowserView(): BrowserView | null {
  return browserView;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
