from __future__ import annotations

import multiprocessing
import socket
import time
from contextlib import closing

import uvicorn

try:
    import webview
except ImportError as exc:  # pragma: no cover - depends on optional desktop dependency
    raise SystemExit(
        "pywebview is not installed yet. Install dependencies from requirements.txt to use the desktop launcher."
    ) from exc

from main import app


WINDOW_TITLE = "Rayline Echo"
WINDOW_SIZE = (1440, 960)
WINDOW_MIN_SIZE = (1160, 760)


def find_free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return int(sock.getsockname()[1])


def wait_for_server(host: str, port: int, timeout: float = 25.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.15)
    raise RuntimeError("Rayline Echo could not start its local server in time.")


def run_server(host: str, port: int) -> None:
    uvicorn.run(app, host=host, port=port, log_level="warning", access_log=False)


def run_desktop() -> None:
    host = "127.0.0.1"
    port = find_free_port()
    ctx = multiprocessing.get_context("spawn")
    server_process = ctx.Process(target=run_server, args=(host, port), daemon=True, name="rayline-echo-server")
    server_process.start()

    try:
        wait_for_server(host, port)
        url = f"http://{host}:{port}"
        webview.create_window(
            WINDOW_TITLE,
            url,
            width=WINDOW_SIZE[0],
            height=WINDOW_SIZE[1],
            min_size=WINDOW_MIN_SIZE,
            text_select=True,
        )
        webview.start()
    finally:
        if server_process.is_alive():
            server_process.terminate()
            server_process.join(timeout=5)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    run_desktop()
