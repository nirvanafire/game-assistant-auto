# Screenshot Button for ImageCompare Tool

## Overview

Add a screenshot button to the ImageCompare tool that captures the current browser content and saves it to the application's caches directory.

## Requirements

1. Add a "截图" button in the ImageCompare tool
2. Clicking the button captures the current browser webview content
3. Save the screenshot to `userData/caches/screenshot-{timestamp}.png`
4. Automatically set the captured image as the "screenshot" in ImageCompare
5. Show success/error feedback to the user

## Architecture

### IPC Channel

Add new constant in `src/shared/constants.ts`:
```typescript
BROWSER_CAPTURE_SCREENSHOT: 'browser:capture-screenshot',
```

### Main Process Handler

Add handler in `src/main/index.ts`:
- Use `webContents.getAllWebContents()` to find the webview webContents
- Call `capturePage()` on the webview
- Save PNG to `userData/caches/screenshot-{YYYY-MM-DD-HH-mm-ss}.png`
- Return base64 data URL

### Renderer Component

Modify `src/renderer/components/Tools/ImageCompare.tsx`:
- Add "截图" button with camera icon
- Invoke `browser:capture-screenshot` IPC channel
- Set returned base64 as screenshot state
- Show loading state during capture
- Show success/error message

## Files to Modify

1. `src/shared/constants.ts` - Add `BROWSER_CAPTURE_SCREENSHOT` constant
2. `src/main/index.ts` - Add IPC handler for screenshot capture
3. `src/renderer/components/Tools/ImageCompare.tsx` - Add screenshot button

## Data Flow

1. User clicks "截图" button in ImageCompare
2. Renderer invokes `browser:capture-screenshot` IPC
3. Main process finds webview webContents
4. Main process calls `capturePage()` on webview
5. Main process saves PNG to caches directory
6. Main process returns base64 data URL
7. Renderer sets base64 as screenshot state
8. User sees captured image in ImageCompare

## Error Handling

- If no webview found: return error message
- If capture fails: return error message
- If save fails: return error message
- Show error messages via `message.error()`

## Testing

- Verify screenshot button appears in ImageCompare
- Verify clicking button captures browser content
- Verify screenshot is saved to caches directory
- Verify captured image is displayed in ImageCompare
- Verify error handling works when browser is empty
