from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parent
DB_DIR = BACKEND_ROOT / 'db'
DB_PATH = DB_DIR / 'ecomon.sqlite3'

API_HOST = '127.0.0.1'
API_PORT = 8000
ALLOWED_ORIGIN = '*'
ALLOWED_HEADERS = 'Content-Type'
ALLOWED_METHODS = 'GET,POST,OPTIONS'

MAX_DAILY_SCANS = 3

ECOMONS = [
    {
        'id': 'pet',
        'name': 'PET-Dragon',
        'material': 'Plastica (PET)',
        'bin': 'GIALLO',
        'color': '#fbbf24',
        'rarity': 'Common',
        'description': 'Bottiglie e flaconi in plastica trasparente.',
        'keywords': ['plastic bottle', 'water bottle', 'soda bottle', 'pop bottle', 'detergent bottle']
    },
    {
        'id': 'paper',
        'name': 'Carta-Kong',
        'material': 'Carta',
        'bin': 'BLU',
        'color': '#60a5fa',
        'rarity': 'Common',
        'description': 'Fogli, cartoncini e giornali puliti.',
        'keywords': ['paper', 'newspaper', 'book', 'notebook', 'cardboard', 'envelope', 'carton box']
    },
    {
        'id': 'tetra',
        'name': 'Tetra-Fox',
        'material': 'Tetrapak',
        'bin': 'GIALLO',
        'color': '#f59e0b',
        'rarity': 'Uncommon',
        'description': 'Cartoni per bevande e succhi.',
        'keywords': ['milk carton', 'juice carton', 'tetra', 'drink carton', 'beverage carton']
    },
    {
        'id': 'glass',
        'name': 'Vetro-Lumaca',
        'material': 'Vetro',
        'bin': 'VERDE',
        'color': '#22c55e',
        'rarity': 'Rare',
        'description': 'Bottiglie e vasetti in vetro.',
        'keywords': ['glass bottle', 'wine bottle', 'beer bottle', 'jar', 'vase']
    },
    {
        'id': 'organic',
        'name': 'Bio-Fungus',
        'material': 'Organico',
        'bin': 'MARRONE',
        'color': '#a16207',
        'rarity': 'Uncommon',
        'description': 'Scarti di cibo, bucce, fondi di caffè.',
        'keywords': ['banana', 'apple', 'orange', 'vegetable', 'salad', 'sandwich', 'pizza', 'mushroom']
    },
    {
        'id': 'metal',
        'name': 'Alu-Rex',
        'material': 'Alluminio',
        'bin': 'GIALLO',
        'color': '#94a3b8',
        'rarity': 'Rare',
        'description': 'Lattine, scatolette e piccoli metalli.',
        'keywords': ['soda can', 'beer can', 'tin can', 'aluminum', 'steel', 'metal can']
    }
]


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
        ],
        'ecoMons': [
            {
                'id': item['id'],
                'name': item['name'],
                'material': item['material'],
                'bin': item['bin'],
                'color': item['color'],
                'rarity': item['rarity'],
                'description': item['description']
            }
            for item in ECOMONS
        ],
        'aiKeywords': [
            {
                'id': item['id'],
                'keywords': item['keywords']
            }
            for item in ECOMONS
        ]
    }