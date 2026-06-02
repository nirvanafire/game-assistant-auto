import { describe, it, expect } from 'vitest';
import { computeBrowserViewBounds } from '../window.js';

describe('computeBrowserViewBounds', () => {
  it('should offset y by toolbar height and reduce height accordingly', () => {
    const bounds = computeBrowserViewBounds(900, 48);
    expect(bounds).toEqual({ x: 0, y: 48, width: 700, height: 852 });
  });

  it('should handle zero toolbar height', () => {
    const bounds = computeBrowserViewBounds(900, 0);
    expect(bounds).toEqual({ x: 0, y: 0, width: 700, height: 900 });
  });
});
