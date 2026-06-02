# Scale Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-session scale caching to the Python image matcher so repeated matches for the same template try the last successful scale first, skipping the full coarse scan when possible.

**Architecture:** A module-level dict keyed by template image hash stores the last successful scale. On match, the cached scale is tried first with a tight fine range. If it passes threshold, return immediately. Otherwise, fall back to the full two-pass scan.

**Tech Stack:** Python, OpenCV, numpy

---

## Task 1: Scale Cache in matcher.py

**Files:**
- Modify: `python-service/matcher.py`
- Modify: `python-service/test_matcher.py`

- [ ] **Step 1: Add failing test for scale cache**

Add to `python-service/test_matcher.py`:

```python
def test_scale_cache_used():
    """Second match for same template should use cached scale."""
    from matcher import _scale_cache, match_template
    _scale_cache.clear()

    base = _make_pattern(100, seed=99)
    scaled_up = cv2.resize(base, (150, 150), interpolation=cv2.INTER_AREA)
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[150:300, 150:300] = scaled_up
    template = base.copy()

    # First match populates cache
    result1 = match_template(img, template, 0.8, (0.5, 2.0))
    assert result1['matched']
    assert abs(result1['scale'] - 1.5) < 0.3

    # Cache should have an entry
    assert len(_scale_cache) == 1

    # Second match should use cached scale
    result2 = match_template(img, template, 0.8, (0.5, 2.0))
    assert result2['matched']
    assert abs(result2['scale'] - result1['scale']) < 0.06

def test_scale_cache_miss_falls_back():
    """When cached scale doesn't match, fall back to full scan."""
    from matcher import _scale_cache, match_template
    _scale_cache.clear()

    img1, template1 = create_test_images()
    result1 = match_template(img1, template1, 0.8, (0.5, 2.0))
    assert result1['matched']

    # Different image where cached scale won't work
    base2 = _make_pattern(100, seed=77)
    scaled_up = cv2.resize(base2, (180, 180), interpolation=cv2.INTER_AREA)
    img2 = np.zeros((600, 600, 3), dtype=np.uint8)
    img2[100:280, 100:280] = scaled_up
    template2 = base2.copy()

    result2 = match_template(img2, template2, 0.8, (0.5, 2.0))
    assert result2['matched']
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python-service && python -m pytest test_matcher.py::test_scale_cache_used -v`
Expected: FAIL (no `_scale_cache` export, no cache logic)

- [ ] **Step 3: Implement scale cache**

Replace `python-service/matcher.py` with:

```python
import hashlib
import cv2
import numpy as np
from config import COARSE_STEP, FINE_STEP, FINE_RANGE

# Per-session scale cache: template hash -> last successful scale
_scale_cache: dict[str, float] = {}

def _template_hash(img: np.ndarray) -> str:
    return hashlib.md5(img.tobytes()).hexdigest()

def match_template(
    screenshot: np.ndarray,
    template: np.ndarray,
    threshold: float,
    scale_range: tuple[float, float],
) -> dict:
    t_hash = _template_hash(template)
    cached_scale = _scale_cache.get(t_hash)

    # Fast path: try cached scale with tight fine range first
    if cached_scale is not None:
        min_scale, max_scale = scale_range
        if min_scale <= cached_scale <= max_scale:
            fine_start = max(min_scale, cached_scale - FINE_RANGE)
            fine_end = min(max_scale, cached_scale + FINE_RANGE)
            fine_scales = np.arange(fine_start, fine_end + FINE_STEP, FINE_STEP)
            best = {'matched': False, 'confidence': 0, 'x': 0, 'y': 0, 'scale': 1.0}
            for scale in fine_scales:
                result = _try_match(screenshot, template, scale, threshold)
                if result and result['confidence'] > best['confidence']:
                    best = result
            if best['matched']:
                _scale_cache[t_hash] = best['scale']
                return best

    # Full two-pass scan
    best = {'matched': False, 'confidence': 0, 'x': 0, 'y': 0, 'scale': 1.0}
    min_scale, max_scale = scale_range
    coarse_scales = np.arange(min_scale, max_scale + COARSE_STEP, COARSE_STEP)

    for scale in coarse_scales:
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result

    if not best['matched']:
        return {'matched': False}

    fine_center = best['scale']
    fine_start = max(min_scale, fine_center - FINE_RANGE)
    fine_end = min(max_scale, fine_center + FINE_RANGE)
    fine_scales = np.arange(fine_start, fine_end + FINE_STEP, FINE_STEP)

    for scale in fine_scales:
        if abs(scale - fine_center) < COARSE_STEP:
            continue
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result

    _scale_cache[t_hash] = best['scale']
    return best

def match_group(
    screenshot: np.ndarray,
    templates: list[dict],
    logic: str,
    scale_range: tuple[float, float],
) -> dict:
    results = []
    for t in templates:
        result = match_template(screenshot, t['image'], t['threshold'], scale_range)
        results.append({
            'label': t['label'],
            'matched': result['matched'],
            'x': result.get('x'),
            'y': result.get('y'),
            'confidence': result.get('confidence', 0),
            'scale': result.get('scale', 1.0),
        })

    if logic == 'ALL':
        all_matched = all(r['matched'] for r in results)
        if not all_matched:
            for r in results:
                r['matched'] = False

    return {'results': results}

def _try_match(
    screenshot: np.ndarray,
    template: np.ndarray,
    scale: float,
    threshold: float,
) -> dict | None:
    h, w = template.shape[:2]
    new_w = int(w * scale)
    new_h = int(h * scale)

    if new_w <= 0 or new_h <= 0:
        return None
    if new_w > screenshot.shape[1] or new_h > screenshot.shape[0]:
        return None

    scaled = cv2.resize(template, (new_w, new_h), interpolation=cv2.INTER_AREA)
    result = cv2.matchTemplate(screenshot, scaled, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(result)

    if max_val >= threshold:
        center_x = max_loc[0] + new_w // 2
        center_y = max_loc[1] + new_h // 2
        return {
            'matched': True,
            'x': center_x,
            'y': center_y,
            'confidence': float(max_val),
            'scale': float(scale),
        }

    return None
```

- [ ] **Step 4: Run all tests**

Run: `cd python-service && python -m pytest test_matcher.py -v`
Expected: All 8 tests pass (6 existing + 2 new)

- [ ] **Step 5: Commit**

```bash
git add python-service/matcher.py python-service/test_matcher.py
git commit -m "feat: add scale caching to image matcher"
```

---

## Task 2: Verification

- [ ] **Step 1: Run full test suite**

Run: `cd python-service && python -m pytest test_matcher.py -v`

- [ ] **Step 2: Run TypeScript tests to ensure no regressions**

Run: `npx vitest run`
