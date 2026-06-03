import { app, session } from 'electron';
import { createMainWindow, getMainWindow } from './window';
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

});

app.on('window-all-closed', () => {
  logger?.destroy();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
