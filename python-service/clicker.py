import pyautogui

pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0


def move_and_click(
    x: int,
    y: int,
    button: str = "left",
    count: int = 1,
    interval: float = 0.0,
    duration: float = 0.0,
) -> dict:
    try:
        pyautogui.moveTo(x, y, duration=duration)
        pyautogui.click(x, y, clicks=count, button=button, interval=interval)
        return {"success": True, "x": x, "y": y}
    except Exception as e:
        return {"success": False, "error": str(e)}
