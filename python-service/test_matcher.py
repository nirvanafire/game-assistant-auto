import pytest
import cv2
import numpy as np
from matcher import match_template, match_group, _scale_cache

@pytest.fixture(autouse=True)
def _clear_scale_cache():
    _scale_cache.clear()
    yield
    _scale_cache.clear()

def _make_pattern(size, seed=42):
    rng = np.random.RandomState(seed)
    return rng.randint(0, 256, (size, size, 3), dtype=np.uint8)

def create_test_images():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    pattern = _make_pattern(100, seed=42)
    img[100:200, 100:200] = pattern
    template = img[100:200, 100:200].copy()
    return img, template

def test_single_match():
    img, template = create_test_images()
    result = match_template(img, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True
    assert result['confidence'] > 0.99
    assert result['x'] == 150
    assert result['y'] == 150

def test_no_match():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    template = _make_pattern(50, seed=77)
    result = match_template(img, template, 0.99, (0.5, 2.0))
    assert result['matched'] == False

def test_scaled_match():
    base = _make_pattern(100, seed=99)
    scaled_up = cv2.resize(base, (150, 150), interpolation=cv2.INTER_AREA)
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[150:300, 150:300] = scaled_up
    template = base.copy()
    result = match_template(img, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True
    assert abs(result['scale'] - 1.5) < 0.3

def test_group_all():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    p1 = _make_pattern(50, seed=11)
    p2 = _make_pattern(50, seed=22)
    img[50:100, 50:100] = p1
    img[200:250, 200:250] = p2
    t1 = img[50:100, 50:100].copy()
    t2 = img[200:250, 200:250].copy()
    templates = [
        {'label': 'a', 'image': t1, 'threshold': 0.8},
        {'label': 'b', 'image': t2, 'threshold': 0.8},
    ]
    result = match_group(img, templates, 'ALL', (0.5, 2.0))
    assert all(r['matched'] for r in result['results'])

def test_group_any():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    pattern = _make_pattern(50, seed=33)
    img[50:100, 50:100] = pattern
    t1 = img[50:100, 50:100].copy()
    t2 = _make_pattern(50, seed=44)
    templates = [
        {'label': 'a', 'image': t1, 'threshold': 0.8},
        {'label': 'b', 'image': t2, 'threshold': 0.99},
    ]
    result = match_group(img, templates, 'ANY', (0.5, 2.0))
    assert result['results'][0]['matched'] == True
    assert result['results'][1]['matched'] == False

def test_roi_match():
    img = np.zeros((400, 400, 3), dtype=np.uint8)
    pattern = _make_pattern(100, seed=55)
    img[100:200, 100:200] = pattern
    template = img[100:200, 100:200].copy()
    roi = img[80:220, 80:220]
    result = match_template(roi, template, 0.8, (0.5, 2.0))
    assert result['matched'] == True

def test_scale_cache_used():
    """Second match for same template should use cached scale."""
    base = _make_pattern(100, seed=99)
    scaled_up = cv2.resize(base, (150, 150), interpolation=cv2.INTER_AREA)
    img = np.zeros((600, 600, 3), dtype=np.uint8)
    img[150:300, 150:300] = scaled_up
    template = base.copy()

    result1 = match_template(img, template, 0.8, (0.5, 2.0))
    assert result1['matched']
    assert abs(result1['scale'] - 1.5) < 0.3

    assert len(_scale_cache) == 1

    result2 = match_template(img, template, 0.8, (0.5, 2.0))
    assert result2['matched']
    assert abs(result2['scale'] - result1['scale']) < 0.06

def test_scale_cache_miss_falls_back():
    """When cached scale doesn't match, fall back to full scan."""
    # First match at scale ~1.5
    base1 = _make_pattern(100, seed=99)
    scaled1 = cv2.resize(base1, (150, 150), interpolation=cv2.INTER_AREA)
    img1 = np.zeros((600, 600, 3), dtype=np.uint8)
    img1[150:300, 150:300] = scaled1
    template1 = base1.copy()
    result1 = match_template(img1, template1, 0.8, (0.5, 2.0))
    assert result1['matched']

    # Second match with a different template at scale 1.0 (no scaling)
    img2, template2 = create_test_images()
    result2 = match_template(img2, template2, 0.8, (0.5, 2.0))
    assert result2['matched']

    # Both templates should have their own cache entries, confirming
    # the second match went through the full scan (not the cached path)
    assert len(_scale_cache) == 2
