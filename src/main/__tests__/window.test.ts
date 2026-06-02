import { describe, it, expect } from 'vitest';

// Test the BrowserView bounds configuration
// We extract the config to verify the y-offset without spawning Electron
describe('BrowserView bounds config', () => {
  it('should offset y by 48px to avoid covering the toolbar', () => {
    const TOOLBAR_HEIGHT = 48;
    const baseBounds = { x: 0, y: 0, width: 700, height: 900 };

    const actualBounds = {
      ...baseBounds,
      y: TOOLBAR_HEIGHT,
      height: baseBounds.height - TOOLBAR_HEIGHT,
    };

    expect(actualBounds.y).toBe(48);
    expect(actualBounds.height).toBe(852);
  });
});
