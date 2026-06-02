import { app } from 'electron';
import { createMainWindow, getBrowserView, getMainWindow } from './window';
import { createSchema } from './db/schema';
import { runMigrations } from './db/migrations';
import { StorageService } from './services/storage';
import { Logger } from './services/logger';
import { IpcRegistry } from './ipc/registry';
import { createLogIpcHandlers } from './ipc/log';
import { createTaskIpcHandlers } from './ipc/task';
import { createTaskGroupIpcHandlers } from './ipc/task-group';
import { createImportExportHandlers } from './ipc/import-export';
import { TaskEngine } from './services/task-engine';
import { TaskGroupEngine } from './services/task-group-engine';
import { CaptureService } from './services/capture';
import { ClickerService } from './services/clicker';
import { MatcherClient } from './services/matcher-client';
import { ConfigService } from './services/config';
import Database from 'better-sqlite3';
import path from 'path';

const userDataPath = app.getPath('userData');
const dataDir = path.join(userDataPath, 'data');
const dbPath = path.join(dataDir, 'game-assistant.db');
const logDir = path.join(dataDir, 'logs');
const configPath = path.join(dataDir, 'config.json');

let db: Database.Database;
let storage: StorageService;
let logger: Logger;
let registry: IpcRegistry;

app.whenReady().then(() => {
  db = new Database(dbPath);
  createSchema(db);
  runMigrations(db);

  const config = new ConfigService(configPath);
  storage = new StorageService(db);
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
  createTaskIpcHandlers(registry, storage, taskEngine, win.webContents);
  createTaskGroupIpcHandlers(registry, storage, taskGroupEngine, win.webContents);
  createImportExportHandlers(registry, storage);

  // Click test handler
  registry.handle('capture:click', async (_event: any, data: { x: number; y: number; button?: string; count?: number }) => {
    await clicker.click(data.x, data.y, { button: data.button as any, count: data.count });
    return { success: true };
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

  // Browser view handlers
  registry.handle('browser:load-url', async (_event: any, data: { url: string }) => {
    const view = getBrowserView();
    if (!view) return { success: false };
    await view.webContents.loadURL(data.url);
    return { success: true };
  });

  registry.handle('browser:get-url', () => {
    const view = getBrowserView();
    return { url: view?.webContents.getURL() || '' };
  });

  registry.handle('browser:set-bounds', (_event: any, data: { x: number; y: number; width: number; height: number }) => {
    const view = getBrowserView();
    if (!view) return { success: false };
    view.setBounds(data);
    return { success: true };
  });

  registry.handle('browser:go-back', () => {
    const view = getBrowserView();
    if (view?.webContents.canGoBack()) view.webContents.goBack();
    return { success: true };
  });

  registry.handle('browser:go-forward', () => {
    const view = getBrowserView();
    if (view?.webContents.canGoForward()) view.webContents.goForward();
    return { success: true };
  });

  registry.handle('browser:reload', () => {
    const view = getBrowserView();
    view?.webContents.reload();
    return { success: true };
  });
});

app.on('window-all-closed', () => {
  logger?.destroy();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
