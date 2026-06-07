import { app, session, webContents } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { createSchema } from './db/schema';
import { runMigrations } from './db/migrations';
import { StorageService } from './services/storage';
import { TemplateStorage } from './services/template-storage';
import { Logger } from './services/logger';
import { IpcRegistry } from './ipc/registry';
import { createLogIpcHandlers } from './ipc/log';
import { createTaskIpcHandlers } from './ipc/task';
import { createTaskGroupIpcHandlers } from './ipc/task-group';
import { createImportExportHandlers } from './ipc/import-export';
import { createImageIpcHandlers } from './ipc/image';
import { createStepGroupIpcHandlers } from './ipc/step-group';
import { TaskEngine } from './services/task-engine';
import { TaskGroupEngine } from './services/task-group-engine';
import { CaptureService } from './services/capture';
import { ClickerService } from './services/clicker';
import { MatcherClient } from './services/matcher-client';
import { ConfigService } from './services/config';
import { IPC_CHANNELS } from '@shared/constants';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const userDataPath = app.getPath('userData');
const dataDir = path.join(userDataPath, 'data');
const dbPath = path.join(dataDir, 'game-assistant.db');
const logDir = path.join(dataDir, 'logs');
const configPath = path.join(dataDir, 'config.json');

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

let db: Database.Database;
let storage: StorageService;
let logger: Logger;
let registry: IpcRegistry;

app.whenReady().then(() => {
  // Dedicated session for the embedded browser webview.
  // Strip headers that block page embedding (X-Frame-Options, CSP frame-ancestors).
  const webviewSession = session.fromPartition('persist:webview:browser');
  webviewSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['X-Frame-Options'];
    if (responseHeaders['content-security-policy']) {
      responseHeaders['content-security-policy'] = responseHeaders['content-security-policy']
        .map(h => h.replace(/frame-ancestors[^;]*(;|$)/gi, '').trim())
        .filter(h => h.length > 0);
      if (responseHeaders['content-security-policy'].length === 0) {
        delete responseHeaders['content-security-policy'];
      }
    }
    callback({ responseHeaders });
  });

  db = new Database(dbPath);
  createSchema(db);
  runMigrations(db);

  const config = new ConfigService(configPath);
  storage = new StorageService(db);
  const templateStorage = new TemplateStorage(userDataPath);
  templateStorage.init();
  logger = new Logger(logDir, config.get('debugMode'));
  logger.cleanup(config.get('autoPruneDays'));

  registry = new IpcRegistry();
  const win = createMainWindow();

  // Services that need webContents
  const capture = new CaptureService(win.webContents);
  const clicker = new ClickerService(win.webContents, logger);
  const matcher = new MatcherClient(`http://127.0.0.1:${config.get('pythonPort')}`, logger);
  const taskEngine = new TaskEngine(storage, capture, matcher, clicker, logger);
  const taskGroupEngine = new TaskGroupEngine(storage, taskEngine);

  // IPC handlers
  createLogIpcHandlers(registry, logger, win.webContents);
  createTaskIpcHandlers(registry, storage, taskEngine, win.webContents, logger);
  createTaskGroupIpcHandlers(registry, storage, taskGroupEngine, win.webContents, logger);
  createImportExportHandlers(registry, storage);
  createImageIpcHandlers(registry, templateStorage);
  createStepGroupIpcHandlers(registry, storage);

  // Click test handler (Electron webview click)
  registry.handle('capture:click', async (_event: any, data: { x: number; y: number; button?: string; count?: number }) => {
    await clicker.click(data.x, data.y, { button: data.button as any, count: data.count });
    return { success: true };
  });

  // Python click handler (OS-level pyautogui click)
  registry.handle(IPC_CHANNELS.PYTHON_CLICK, async (_event: any, data: { x: number; y: number; button?: string; count?: number; interval?: number }) => {
    const result = await matcher.click({
      x: data.x,
      y: data.y,
      button: data.button as 'left' | 'right' | undefined,
      count: data.count,
      interval: data.interval,
    });
    return result;
  });

  // Image match handler (for ImageCompare tool)
  registry.handle('capture:match', async (_event: any, data: { screenshot: string; template: string; threshold?: number }) => {
    const result = await matcher.match({
      screenshot: data.screenshot,
      template: data.template,
      threshold: data.threshold ?? 0.8,
      scaleRange: [0.5, 2.0],
    });
    return result;
  });

  // Browser resize handler — clear coordinate cache
  registry.handle('browser:resized', () => {
    taskEngine.clearCoordinateCache();
    return { success: true };
  });

  // Browser screenshot handler — capture webview content and save to caches
  registry.handle(IPC_CHANNELS.BROWSER_CAPTURE_SCREENSHOT, async () => {
    const cachesDir = path.join(app.getPath('userData'), 'caches');
    await fs.promises.mkdir(cachesDir, { recursive: true });

    // Find webview webContents
    const allWebContents = webContents.getAllWebContents();
    const webview = allWebContents.find(wc => wc.getType() === 'webview');
    if (!webview) {
      throw new Error('No webview found');
    }

    // Capture page
    const image = await webview.capturePage();
    const buffer = image.toPNG();

    // Save to caches directory with timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `screenshot-${timestamp}.png`;
    const filePath = path.join(cachesDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    // Return base64 data URL
    return `data:image/png;base64,${buffer.toString('base64')}`;
  });

  // Browser size query — returns the main window's content size
  registry.handle(IPC_CHANNELS.BROWSER_GET_SIZE, () => {
    const bounds = win.getContentBounds();
    return { width: bounds.width, height: bounds.height };
  });

  // Forward window resize events to renderer for live size display
  win.on('resize', () => {
    const bounds = win.getContentBounds();
    win.webContents.send(IPC_CHANNELS.BROWSER_WINDOW_RESIZED, { width: bounds.width, height: bounds.height });
  });

});

app.on('window-all-closed', () => {
  logger?.destroy();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
