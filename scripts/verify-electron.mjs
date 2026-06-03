import { existsSync } from 'fs';
import { join, resolve } from 'path';

const root = resolve(import.meta.dirname, '..');
const pathTxt = join(root, 'node_modules', 'electron', 'path.txt');

if (!existsSync(pathTxt)) {
  console.error('\nError: Electron binary not found. Run: npm install\n');
  process.exit(1);
}
