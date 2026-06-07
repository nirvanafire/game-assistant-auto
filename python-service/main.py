import cv2
import numpy as np
from flask import Flask, request, jsonify
from matcher import match_template, match_group
from clicker import move_and_click
from config import DEFAULT_THRESHOLD, DEFAULT_SCALE_RANGE

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'version': '1.0.0',
        'opencv_version': cv2.__version__,
    })

@app.route('/match', methods=['POST'])
def match():
    data = request.json
    screenshot_b64 = data['screenshot']
    template_b64 = data['template']
    threshold = data.get('threshold', DEFAULT_THRESHOLD)
    scale_range = data.get('scale_range', DEFAULT_SCALE_RANGE)
    region = data.get('region')

    screenshot = decode_image(screenshot_b64)
    template = decode_image(template_b64)

    if region:
        x, y, w, h = region['x'], region['y'], region['width'], region['height']
        screenshot = screenshot[y:y+h, x:x+w]
        offset_x, offset_y = x, y
    else:
        offset_x, offset_y = 0, 0

    result = match_template(screenshot, template, threshold, tuple(scale_range))
    if result['matched'] and (offset_x or offset_y):
        result['x'] = result.get('x', 0) + offset_x
        result['y'] = result.get('y', 0) + offset_y

    return jsonify(result)

@app.route('/match-group', methods=['POST'])
def match_group_route():
    data = request.json
    screenshot_b64 = data['screenshot']
    templates_data = data['templates']
    logic = data.get('logic', 'ALL')
    scale_range = data.get('scale_range', DEFAULT_SCALE_RANGE)

    screenshot = decode_image(screenshot_b64)
    templates = [
        {
            'label': t['label'],
            'image': decode_image(t['image']),
            'threshold': t.get('threshold', DEFAULT_THRESHOLD),
        }
        for t in templates_data
    ]

    result = match_group(screenshot, templates, logic, tuple(scale_range))
    return jsonify(result)

@app.route('/click', methods=['POST'])
def click():
    data = request.json
    x = int(data['x'])
    y = int(data['y'])
    button = data.get('button', 'left')
    count = int(data.get('count', 1))
    interval = float(data.get('interval', 0.0))
    duration = float(data.get('duration', 0.0))
    result = move_and_click(x, y, button=button, count=count, interval=interval, duration=duration)
    return jsonify(result)

def decode_image(base64_str: str) -> np.ndarray:
    import base64
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    data = base64.b64decode(base64_str)
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

if __name__ == '__main__':
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    app.run(host='127.0.0.1', port=port, debug=False)
