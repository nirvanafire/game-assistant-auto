// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { TemplateStorage } from '../template-storage';

describe('TemplateStorage', () => {
  let tmpDir: string;
  let storage: TemplateStorage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-test-'));
    storage = new TemplateStorage(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('init creates the templates directory', () => {
    const templatesDir = path.join(tmpDir, 'templates');
    expect(fs.existsSync(templatesDir)).toBe(false);
    storage.init();
    expect(fs.existsSync(templatesDir)).toBe(true);
  });

  it('isManaged returns true for paths inside templates/', () => {
    storage.init();
    const managedPath = path.join(tmpDir, 'templates', 'some-image.png');
    expect(storage.isManaged(managedPath)).toBe(true);
  });

  it('isManaged returns false for external paths', () => {
    const externalPath = path.join(tmpDir, 'other-dir', 'image.png');
    expect(storage.isManaged(externalPath)).toBe(false);
  });

  it('normalize copies external file with UUID filename', async () => {
    storage.init();
    const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-src-'));
    const srcFile = path.join(srcDir, 'original.png');
    const content = Buffer.from('fake-image-data');
    fs.writeFileSync(srcFile, content);

    const result = await storage.normalize(srcFile);

    expect(result.startsWith(path.join(tmpDir, 'templates'))).toBe(true);
    expect(result.endsWith('.png')).toBe(true);
    expect(path.basename(result)).not.toBe('original.png');
    expect(fs.existsSync(result)).toBe(true);
    expect(fs.readFileSync(result)).toEqual(content);

    fs.rmSync(srcDir, { recursive: true, force: true });
  });

  it('normalize returns same path for already managed file', async () => {
    storage.init();
    const managedFile = path.join(tmpDir, 'templates', 'existing.png');
    fs.writeFileSync(managedFile, 'data');

    const result = await storage.normalize(managedFile);
    expect(result).toBe(path.resolve(managedFile));
  });

  it('normalize rejects for missing file', async () => {
    storage.init();
    const missingFile = path.join(tmpDir, 'no-such-file.png');
    await expect(storage.normalize(missingFile)).rejects.toThrow(
      'Source file not found',
    );
  });
});
