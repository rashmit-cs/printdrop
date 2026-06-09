"""
PrintDrop PC Agent
==================
Runs on shopkeeper's Windows PC.
Polls server every 5 sec for PAID jobs → downloads file → prints → marks done.

Install deps: pip install requests schedule pywin32
Run: python agent.py
Build exe: pyinstaller --onefile --noconsole agent.py
"""

import os
import sys
import time
import requests
import schedule
import tempfile
import subprocess
import platform
import logging
from pathlib import Path

# ─── CONFIG ──────────────────────────────────────────────────────────────────
# Shopkeeper fills these in (or we build a small GUI config screen)
SERVER_URL = "http://localhost:4000"
SHOP_ID = "4bef3bc1-a8f1-438c-97e7-35419e8084d8"
AGENT_SECRET = "printdropsecret456"


# Printer names (must match exact Windows printer name)
# Leave "default" to use system default printer
COLOR_PRINTER = "default"
BW_PRINTER = "default"

POLL_INTERVAL_SECONDS = 5
DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "printdrop_jobs"
DOWNLOAD_DIR.mkdir(exist_ok=True)

# ─── LOGGING ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("printdrop_agent.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger("PrintDropAgent")

HEADERS = {"Authorization": f"Bearer {AGENT_SECRET}:{SHOP_ID}"}

# ─── DOWNLOAD FILE ────────────────────────────────────────────────────────────
def download_file(file_url: str, filename: str) -> Path:
    url = f"{SERVER_URL}{file_url}"
    local_path = DOWNLOAD_DIR / filename
    log.info(f"Downloading {filename} from {url}")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    local_path.write_bytes(r.content)
    log.info(f"Saved to {local_path}")
    return local_path

# ─── PRINT FILE ───────────────────────────────────────────────────────────────
def print_file(file_path: Path, print_type: str, copies: int) -> bool:
    """
    Windows: uses ShellExecute print verb (works for PDF, DOCX, images).
    Falls back to lp on Linux/Mac (for dev/testing).
    """
    printer = COLOR_PRINTER if print_type == "COLOR" else BW_PRINTER
    
    log.info(f"Printing {file_path.name} | type={print_type} | copies={copies} | printer={printer}")

    if platform.system() == "Windows":
        try:
            import win32print
            import win32api
            
            # Set printer if not default
            if printer != "default":
                win32print.SetDefaultPrinter(printer)

            # Print using Windows shell (handles PDF, DOCX, images)
            for _ in range(copies):
                win32api.ShellExecute(
                    0, "print",
                    str(file_path),
                    None, ".", 0
                )
                time.sleep(1)  # Small delay between copies
            
            log.info(f"Print job sent to {printer}")
            return True

        except Exception as e:
            log.error(f"Windows print error: {e}")
            return False

    else:
        # Linux/Mac fallback (dev testing)
        try:
            cmd = ["lp", str(file_path)]
            if printer != "default":
                cmd += ["-d", printer]
            if copies > 1:
                cmd += ["-n", str(copies)]
            subprocess.run(cmd, check=True)
            log.info("Print job sent via lp")
            return True
        except Exception as e:
            log.error(f"lp print error: {e}")
            return False

# ─── CLEANUP LOCAL FILE ───────────────────────────────────────────────────────
def delete_local_file(file_path: Path):
    try:
        file_path.unlink(missing_ok=True)
        log.info(f"Deleted local temp file: {file_path.name}")
    except Exception as e:
        log.warning(f"Could not delete temp file: {e}")

# ─── MARK ORDER DONE / FAILED ─────────────────────────────────────────────────
def mark_done(order_id: str, pages: int):
    try:
        requests.post(
            f"{SERVER_URL}/api/agent/done/{order_id}",
            json={"pages": pages},
            headers=HEADERS,
            timeout=10
        )
        log.info(f"Order {order_id} marked PRINTED")
    except Exception as e:
        log.error(f"Failed to mark done: {e}")

def mark_failed(order_id: str):
    try:
        requests.post(
            f"{SERVER_URL}/api/agent/failed/{order_id}",
            headers=HEADERS,
            timeout=10
        )
        log.warning(f"Order {order_id} marked FAILED")
    except Exception as e:
        log.error(f"Failed to mark failed: {e}")

# ─── COUNT PAGES (estimate) ───────────────────────────────────────────────────
def count_pages(file_path: Path) -> int:
    """Best-effort page count. Returns 1 if can't determine."""
    try:
        ext = file_path.suffix.lower()
        if ext == ".pdf":
            # Try to count PDF pages without extra lib
            content = file_path.read_bytes()
            count = content.count(b'/Type /Page') or content.count(b'/Type/Page')
            return max(count, 1)
    except:
        pass
    return 1  # Default 1 page

# ─── MAIN POLL LOOP ───────────────────────────────────────────────────────────
def poll_jobs():
    try:
        r = requests.get(
            f"{SERVER_URL}/api/agent/jobs",
            headers=HEADERS,
            timeout=10
        )
        if r.status_code != 200:
            log.warning(f"Poll returned {r.status_code}: {r.text}")
            return

        jobs = r.json()
        if not jobs:
            return

        log.info(f"Got {len(jobs)} job(s)")

        for job in jobs:
            order_id   = job["id"]
            file_url   = job["fileUrl"]
            filename   = job["fileName"]
            print_type = job["printType"]
            copies     = job.get("copies", 1)

            local_file = None
            try:
                local_file = download_file(file_url, f"{order_id}_{filename}")
                pages      = count_pages(local_file)

                # Give file time to finish writing before printing
                time.sleep(0.5)

                success = print_file(local_file, print_type, copies)

                if success:
                    mark_done(order_id, pages)
                else:
                    mark_failed(order_id)

            except Exception as e:
                log.error(f"Job {order_id} error: {e}")
                mark_failed(order_id)
            finally:
                if local_file:
                    delete_local_file(local_file)

    except requests.exceptions.ConnectionError:
        log.warning("Server unreachable. Will retry...")
    except Exception as e:
        log.error(f"Poll error: {e}")

# ─── ENTRY POINT ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("=" * 50)
    log.info("PrintDrop PC Agent started")
    log.info(f"Server : {SERVER_URL}")
    log.info(f"Shop ID: {SHOP_ID}")
    log.info(f"Polling every {POLL_INTERVAL_SECONDS}s")
    log.info("=" * 50)

    schedule.every(POLL_INTERVAL_SECONDS).seconds.do(poll_jobs)

    while True:
        schedule.run_pending()
        time.sleep(1)
