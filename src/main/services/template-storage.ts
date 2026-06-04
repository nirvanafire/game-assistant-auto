import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class TemplateStorage {
  private templatesDir: string;

  constructor(userDataPath: string) {
    this.templatesDir = path.join(userDataPath, 'templates');
  }

  init(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  isManaged(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    return resolved.startsWith(this.templatesDir);
  }

  async normalize(sourcePath: string): Promise<string> {
    const resolved = path.resolve(sourcePath);
    if (this.isManaged(resolved)) {
      return resolved;
    }
    if (!fs.existsSync(resolved)) {
      throw new Error(`Source file not found: ${resolved}`);
    }
    const ext = path.extname(resolved);
    const newName = `${uuidv4()}${ext}`;
    const dest = path.join(this.templatesDir, newName);
    fs.copyFileSync(resolved, dest);
    return dest;
  }
}
