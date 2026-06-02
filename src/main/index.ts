import { app } from 'electron';
import { createMainWindow } from './window';
import { createSchema } from './db/schema';
import { runMigrations } from './db/migrations';
import { StorageService } from './services/storage';
import { Logger } from './services/logger';
import { IpcRegistry } from './ipc/registry';
import { createLogIpcHandlers } from './ipc/log';
import { createTaskIpcHandlers } from './ipc/task';
import { createTaskGroupIpcHandlers } from './ipc/task-group';
import { TaskEngine } from './services/task-engine';
import { TaskGroupEngine } from './services/task-group-engine';
import { CaptureService } from './services/capture';
import { MatcherClient } from './services/matcher-client';
import Database from 'better-sqlite3';
import path from 'path';

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'data', 'game-assistant.db');
const logDir = path.join(userDataPath, 'data', 'logs');

let db: Database.Database;
let storage: StorageService;
let logger: Logger;
let registry: IpcRegistry;

app.whenReady().then(() => {
  db = new Database(dbPath);
  createSchema(db);
  runMigrations(db);

  storage = new StorageService(db);
  logger = new Logger(logDir, false);
  logger.cleanup(30);

  registry = new IpcRegistry();
  const win = createMainWindow();

  // Services that need webContents
  const capture = new CaptureService(win.webContents);
  const matcher = new MatcherClient('http://127.0.0.1:5000');
  const taskEngine = new TaskEngine(storage, capture, matcher, logger);
  const taskGroupEngine = new TaskGroupEngine(storage, taskEngine);

  // IPC handlers
  createLogIpcHandlers(registry, logger, win.webContents);
  createTaskIpcHandlers(registry, storage, taskEngine, win.webContents);
  createTaskGroupIpcHandlers(registry, storage, taskGroupEngine, win.webContents);
});

app.on('window-all-closed', () => {
  logger?.destroy();
  db?.close();
  if (process.platform !== 'darwin') app.quit();
});
