import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { readdirSync } from 'fs';

const ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';

const root = resolve(import.meta.dirname, '..');
const electronDir = join(root, 'node_modules', 'electron');
const pathTxt = join(electronDir, 'path.txt');
const distDir = join(electronDir, 'dist');

function recoverFromCache(version) {
  const cacheDir = join(homedir(), 'AppData', 'Local', 'electron', 'Cache');
  if (!existsSync(cacheDir)) return false;

  const zipName = `electron-v${version}-win32-x64.zip`;
  for (const entry of readdirSync(cacheDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const candidate = join(cacheDir, entry.name, zipName);
      if (existsSync(candidate)) {
        console.log(`[postinstall] Found cached zip: ${zipName}`);
        mkdirSync(distDir, { recursive: true });
        execSync(`unzip -o "${candidate}" -d "${distDir}/"`, { stdio: 'pipe' });
        writeFileSync(pathTxt, 'electron.exe');
        console.log('[postinstall] Electron binary recovered from cache.');
        return true;
      }
    }
  }
  return false;
}

function downloadFromMirror(version) {
  console.log(`[postinstall] Downloading electron@${version} from mirror...`);
  try {
    execSync(`node node_modules/electron/install.js`, {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_MIRROR },
    });
    return existsSync(pathTxt);
  } catch {
    return false;
  }
}

// Ensure electron binary is available
if (!existsSync(pathTxt)) {
  console.log('[postinstall] electron path.txt missing, attempting recovery...');

  const pkg = JSON.parse(readFileSync(join(electronDir, 'package.json'), 'utf-8'));
  const version = pkg.version;

  if (!recoverFromCache(version)) {
    if (!downloadFromMirror(version)) {
      console.error('[postinstall] Failed to recover electron binary.');
      console.error('[postinstall] Manual fix: set ELECTRON_MIRROR env var and run npm install');
      process.exit(1);
    }
  }
} else {
  console.log('[postinstall] Electron binary OK.');
}
