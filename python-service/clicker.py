import threading
import time
import pyautogui

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

_abort = threading.Event()

_TICK = 0.05


def move_and_click(
    x: int,
    y: int,
    button: str = "left",
    count: int = 1,
    interval: float = 0.0,
    duration: float = 0.0,
) -> dict:
    try:
        _abort.clear()
        pyautogui.moveTo(x, y, duration=duration)
        for i in range(count):
            if _abort.is_set():
                return {"success": True, "x": x, "y": y, "aborted": True, "completed": i}
            pyautogui.click(x, y, clicks=1, button=button)
            if i < count - 1:
                wait = max(interval, _TICK)
                if _abort.wait(wait):
                    return {"success": True, "x": x, "y": y, "aborted": True, "completed": i + 1}
        return {"success": True, "x": x, "y": y, "aborted": False, "completed": count}
    except Exception as e:
        return {"success": False, "error": str(e)}


def request_abort() -> dict:
    _abort.set()
    return {"success": True}


def move_to(
    x: int,
    y: int,
    duration: float = 0.0,
) -> dict:
    try:
        pyautogui.moveTo(x, y, duration=duration)
        return {"success": True, "x": x, "y": y}
    except Exception as e:
        return {"success": False, "error": str(e)}
