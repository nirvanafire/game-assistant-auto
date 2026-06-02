import { BrowserWindow, BrowserView } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '@shared/constants';

let mainWindow: BrowserWindow | null = null;
let browserView: BrowserView | null = null;

export function computeBrowserViewBounds(windowHeight: number, toolbarHeight: number) {
  return { x: 0, y: toolbarHeight, width: 700, height: windowHeight - toolbarHeight };
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenu(null);

  // Create BrowserView for embedded browser
  browserView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setBrowserView(browserView);
  const TOOLBAR_HEIGHT = 48;
  browserView.setBounds(computeBrowserViewBounds(900, TOOLBAR_HEIGHT));
  browserView.webContents.loadURL('about:blank');

  // Loading state detection
  browserView.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.BROWSER_LOADING_STATE, { loading: true });
  });

  browserView.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send(IPC_CHANNELS.BROWSER_LOADING_STATE, { loading: false });
  });

  browserView.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
    mainWindow?.webContents.send(IPC_CHANNELS.BROWSER_LOADING_STATE, { loading: false, error: errorDescription });
  });

  if (process.env.NODE_ENV_ELECTRON_VITE === 'development') {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173');
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
