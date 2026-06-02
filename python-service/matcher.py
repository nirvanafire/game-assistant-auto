import hashlib
import cv2
import numpy as np
from config import COARSE_STEP, FINE_STEP, FINE_RANGE

# Per-session scale cache: template hash -> last successful scale
_scale_cache: dict[str, float] = {}


def _template_hash(img: np.ndarray) -> str:
    return hashlib.md5(img.tobytes()).hexdigest()


def _fine_search(
    screenshot: np.ndarray,
    template: np.ndarray,
    center: float,
    scale_range: tuple[float, float],
    threshold: float,
    skip_below: float = 0.0,
) -> dict:
    min_scale, max_scale = scale_range
    fine_start = max(min_scale, center - FINE_RANGE)
    fine_end = min(max_scale, center + FINE_RANGE)
    fine_scales = np.arange(fine_start, fine_end + FINE_STEP, FINE_STEP)
    best = {'matched': False, 'confidence': 0, 'x': 0, 'y': 0, 'scale': 1.0}
    for scale in fine_scales:
        if skip_below > 0 and abs(scale - center) < skip_below:
            continue
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result
    return best


def match_template(
    screenshot: np.ndarray,
    template: np.ndarray,
    threshold: float,
    scale_range: tuple[float, float],
) -> dict:
    t_hash = _template_hash(template)
    cached_scale = _scale_cache.get(t_hash)

    # Fast path: try cached scale with tight fine range
    if cached_scale is not None:
        min_scale, max_scale = scale_range
        if min_scale <= cached_scale <= max_scale:
            best = _fine_search(screenshot, template, cached_scale, scale_range, threshold)
            if best['matched']:
                _scale_cache[t_hash] = best['scale']
                return best

    # Coarse scan
    best = {'matched': False, 'confidence': 0, 'x': 0, 'y': 0, 'scale': 1.0}
    min_scale, max_scale = scale_range
    coarse_scales = np.arange(min_scale, max_scale + COARSE_STEP, COARSE_STEP)
    for scale in coarse_scales:
        result = _try_match(screenshot, template, scale, threshold)
        if result and result['confidence'] > best['confidence']:
            best = result

    if not best['matched']:
        return {'matched': False}

    # Fine refinement around coarse best
    fine = _fine_search(screenshot, template, best['scale'], scale_range, threshold,
                        skip_below=FINE_STEP / 2)
    if fine['matched'] and fine['confidence'] > best['confidence']:
        best = fine

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
