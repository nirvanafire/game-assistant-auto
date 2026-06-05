# Screenshot Button for ImageCompare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a screenshot button to the ImageCompare tool that captures browser content and saves to caches directory.

**Architecture:** Add IPC channel for webview screenshot capture, handler in main process using `webContents.getAllWebContents()`, and button in renderer component.

**Tech Stack:** Electron, TypeScript, React, Ant Design, Vitest

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/constants.ts` | Modify | Add `BROWSER_CAPTURE_SCREENSHOT` IPC channel |
| `src/shared/__tests__/constants.test.ts` | Modify | Add test for new constant |
| `src/main/index.ts` | Modify | Add IPC handler for screenshot capture |
| `src/renderer/components/Tools/ImageCompare.tsx` | Modify | Add screenshot button |

---

### Task 1: Add IPC Channel Constant

**Files:**
- Modify: `src/shared/constants.ts:34-35`
- Modify: `src/shared/__tests__/constants.test.ts:4-12`

- [ ] **Step 1: Add constant to IPC_CHANNELS**

Add after line 34 (`CAPTURE_SCREENSHOT`):

```typescript
BROWSER_CAPTURE_SCREENSHOT: 'browser:capture-screenshot',
```

- [ ] **Step 2: Add test for new constant**

Add new test in `src/shared/__tests__/constants.test.ts`:

```typescript
it('includes BROWSER_CAPTURE_SCREENSHOT channel', () => {
  expect(IPC_CHANNELS.BROWSER_CAPTURE_SCREENSHOT).toBe('browser:capture-screenshot');
});
```

- [ ] **Step 3: Run test to verify**

Run: `npx vitest run src/shared/__tests__/constants.test.ts`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants.ts src/shared/__tests__/constants.test.ts
git commit -m "feat: add BROWSER_CAPTURE_SCREENSHOT IPC channel"
```

---

### Task 2: Add Main Process Screenshot Handler

**Files:**
- Modify: `src/main/index.ts:105-109`

- [ ] **Step 1: Add screenshot handler**

Add after the `browser:resized` handler (line 109):

```typescript
// Browser screenshot handler — capture webview content and save to caches
registry.handle(IPC_CHANNELS.BROWSER_CAPTURE_SCREENSHOT, async () => {
  const cachesDir = path.join(app.getPath('userData'), 'caches');
  fs.mkdirSync(cachesDir, { recursive: true });

  // Find webview webContents
  const allWebContents = (await import('electron')).webContents.getAllWebContents();
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
  fs.writeFileSync(filePath, buffer);

  // Return base64 data URL
  return `data:image/png;base64,${buffer.toString('base64')}`;
});
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: add browser screenshot capture handler"
```

---

### Task 3: Add Screenshot Button to ImageCompare

**Files:**
- Modify: `src/renderer/components/Tools/ImageCompare.tsx:2-3,63-75`

- [ ] **Step 1: Add Camera icon import**

Modify line 3:

```typescript
import { UploadOutlined, CameraOutlined } from '@ant-design/icons';
```

- [ ] **Step 2: Add screenshot loading state**

Add after line 28 (`const [loading, setLoading] = useState(false);`):

```typescript
const [screenshotLoading, setScreenshotLoading] = useState(false);
```

- [ ] **Step 3: Add screenshot handler function**

Add after the `handleMatch` function (line 49):

```typescript
const handleScreenshot = async () => {
  setScreenshotLoading(true);
  try {
    const api = (window as any).electronAPI;
    const base64 = await api.invoke(IPC_CHANNELS.BROWSER_CAPTURE_SCREENSHOT);
    setScreenshot(base64);
    message.success('截图已保存并设置为当前截图');
  } catch (err: any) {
    message.error(err?.message || '截图失败');
  } finally {
    setScreenshotLoading(false);
  }
};
```

- [ ] **Step 4: Add IPC_CHANNELS import**

Modify line 1 to add IPC_CHANNELS:

```typescript
import { IPC_CHANNELS } from '@shared/constants';
```

- [ ] **Step 5: Add screenshot button to UI**

Add after the "上传截图" button (line 64):

```typescript
<Button
  icon={<CameraOutlined />}
  loading={screenshotLoading}
  onClick={handleScreenshot}
>
  截图
</Button>
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Tools/ImageCompare.tsx
git commit -m "feat: add screenshot button to ImageCompare tool"
```

---

### Task 4: Manual Testing

- [ ] **Step 1: Start the application**

Run: `npm run dev`

- [ ] **Step 2: Navigate to browser and load a page**

Enter a URL in the browser panel and wait for it to load.

- [ ] **Step 3: Open ImageCompare tool**

Navigate to the Tools section and open ImageCompare.

- [ ] **Step 4: Click screenshot button**

Click the "截图" button and verify:
- Button shows loading state
- Success message appears
- Captured image appears in the screenshot preview

- [ ] **Step 5: Verify file saved**

Check that `screenshot-{timestamp}.png` exists in the `userData/caches` directory.

- [ ] **Step 6: Test error handling**

Click screenshot button when no page is loaded in browser and verify error message appears.

---

## Verification Checklist

- [ ] IPC channel constant added and tested
- [ ] Main process handler captures webview content
- [ ] Screenshot saved to `userData/caches/` with timestamp filename
- [ ] Screenshot button appears in ImageCompare tool
- [ ] Clicking button sets screenshot state
- [ ] Loading state shown during capture
- [ ] Success/error messages displayed
- [ ] All tests pass
- [ ] TypeScript compiles without errors
