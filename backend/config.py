from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent
DB_DIR = BACKEND_ROOT / 'db'
DB_PATH = DB_DIR / 'ecomon.sqlite3'

API_HOST = '127.0.0.1'
API_PORT = 8000
ALLOWED_ORIGIN = '*'
ALLOWED_HEADERS = 'Content-Type'
ALLOWED_METHODS = 'GET,POST,OPTIONS'

MAX_DAILY_SCANS = 100


def get_public_config():
    return {
        'storageKey': 'ecomon-state',
        'maxDailyScans': MAX_DAILY_SCANS,
        'aiMinConfidence': 0.4,
        'autoScanIntervalMs': 1000,
        'noDetectionResetMs': 10000,
        'cameraConstraints': [
            {'video': {'facingMode': {'ideal': 'environment'}}},
            {'video': {'facingMode': 'environment'}},
            {'video': True}
        ]
    }