"""
PrintDrop PC Agent v2
=====================
- Auto-discovers all printers on this PC, sends list to server
- Polls every 5s for PAID jobs
- Server tells agent which printer to use per job (based on shopkeeper's assignment)
- Downloads file, prints, marks done, deletes temp file

Install: pip install requests schedule pywin32
Run: python agent.py
"""

import os, sys, time, requests, schedule, tempfile, subprocess, platform, logging
from pathlib import Path

SERVER_URL   = os.environ.get("PRINTDROP_SERVER", "http://localhost:4000")
SHOP_ID      = os.environ.get("PRINTDROP_SHOP_ID", "YOUR_SHOP_ID_HERE")
AGENT_SECRET = os.environ.get("PRINTDROP_SECRET", "YOUR_AGENT_SECRET_HERE")

POLL_INTERVAL = 5
PRINTER_SYNC_INTERVAL = 60  # re-scan printers every 60s

DOWNLOAD_DIR = Path(tempfile.gettempdir()) / "printdrop_jobs"
DOWNLOAD_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.FileHandler("printdrop_agent.log"), logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger("PrintDropAgent")

HEADERS = {"Authorization": f"Bearer {AGENT_SECRET}:{SHOP_ID}"}

# ─── PRINTER DISCOVERY ────────────────────────────────────────────────────
def discover_printers():
    names = []
    if platform.system() == "Windows":
        try:
            import win32print
            for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                names.append(p[2])  # pPrinterName
        except Exception as e:
            log.error(f"Printer discovery error: {e}")
    else:
        try:
            out = subprocess.run(["lpstat", "-p"], capture_output=True, text=True)
            for line in out.stdout.splitlines():
                if line.startswith("printer"):
                    names.append(line.split()[1])
        except Exception as e:
            log.error(f"lpstat error: {e}")
    return names

def sync_printers():
    printers = discover_printers()
    log.info(f"Discovered printers: {printers}")
    if not printers:
        return
    try:
        requests.post(f"{SERVER_URL}/api/agent/register-printers",
                       json={"printers": printers}, headers=HEADERS, timeout=10)
        log.info("Printer list synced with server")
    except Exception as e:
        log.error(f"Printer sync failed: {e}")

# ─── DOWNLOAD ─────────────────────────────────────────────────────────────
def download_file(file_url, filename):
    url = f"{SERVER_URL}{file_url}"
    local_path = DOWNLOAD_DIR / filename
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    local_path.write_bytes(r.content)
    return local_path

# ─── PRINT ────────────────────────────────────────────────────────────────
def print_file(file_path: Path, printer_name: str, copies: int) -> bool:
    log.info(f"Printing {file_path.name} -> printer='{printer_name}' copies={copies}")
    if platform.system() == "Windows":
        try:
            import win32print, win32api
            if printer_name and printer_name != "default":
                win32print.SetDefaultPrinter(printer_name)
            for _ in range(copies):
                win32api.ShellExecute(0, "print", str(file_path), None, ".", 0)
                time.sleep(1)
            return True
        except Exception as e:
            log.error(f"Windows print error: {e}")
            return False
    else:
        try:
            cmd = ["lp", str(file_path)]
            if printer_name and printer_name != "default":
                cmd += ["-d", printer_name]
            if copies > 1:
                cmd += ["-n", str(copies)]
            subprocess.run(cmd, check=True)
            return True
        except Exception as e:
            log.error(f"lp error: {e}")
            return False

def count_pages(file_path: Path) -> int:
    try:
        if file_path.suffix.lower() == ".pdf":
            content = file_path.read_bytes()
            count = content.count(b'/Type /Page') or content.count(b'/Type/Page')
            return max(count, 1)
    except: pass
    return 1

# ─── ORDER STATE ──────────────────────────────────────────────────────────
def mark_done(order_id, pages):
    try:
        requests.post(f"{SERVER_URL}/api/agent/done/{order_id}", json={"pages": pages}, headers=HEADERS, timeout=10)
        log.info(f"Order {order_id} -> PRINTED")
    except Exception as e:
        log.error(f"mark_done failed: {e}")

def mark_failed(order_id):
    try:
        requests.post(f"{SERVER_URL}/api/agent/failed/{order_id}", headers=HEADERS, timeout=10)
        log.warning(f"Order {order_id} -> FAILED")
    except Exception as e:
        log.error(f"mark_failed failed: {e}")

# ─── MAIN POLL ────────────────────────────────────────────────────────────
def poll_jobs():
    try:
        r = requests.get(f"{SERVER_URL}/api/agent/jobs", headers=HEADERS, timeout=10)
        if r.status_code != 200:
            log.warning(f"Poll error {r.status_code}: {r.text}")
            return

        jobs = r.json()
        if not jobs: return
        log.info(f"{len(jobs)} job(s) to print")

        for job in jobs:
            order_id, file_url, filename = job["id"], job["fileUrl"], job["fileName"]
            printer_name = job.get("printerName", "default")
            copies = job.get("copies", 1)
            local_file = None
            try:
                local_file = download_file(file_url, f"{order_id}_{filename}")
                pages = count_pages(local_file)
                time.sleep(0.5)
                if print_file(local_file, printer_name, copies):
                    mark_done(order_id, pages)
                else:
                    mark_failed(order_id)
            except Exception as e:
                log.error(f"Job {order_id} error: {e}")
                mark_failed(order_id)
            finally:
                if local_file:
                    try: local_file.unlink(missing_ok=True)
                    except: pass

    except requests.exceptions.ConnectionError:
        log.warning("Server unreachable, retrying...")
    except Exception as e:
        log.error(f"Poll error: {e}")

# ─── ENTRY ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("=" * 50)
    log.info("PrintDrop PC Agent v2 started")
    log.info(f"Server: {SERVER_URL} | Shop: {SHOP_ID}")
    log.info("=" * 50)

    sync_printers()  # discover on startup
    schedule.every(POLL_INTERVAL).seconds.do(poll_jobs)
    schedule.every(PRINTER_SYNC_INTERVAL).seconds.do(sync_printers)

    while True:
        schedule.run_pending()
        time.sleep(1)
