import json
import random
import sqlite3
from datetime import date

from config import DB_DIR, DB_PATH, MAX_DAILY_SCANS


WASTE_BINS = [
    {
        'id': 'blue',
        'label': 'BLU',
        'color': '#60a5fa',
        'description': 'Carta e cartone.',
        'sort_order': 1
    },
    {
        'id': 'green',
        'label': 'VERDE',
        'color': '#22c55e',
        'description': 'Vetro.',
        'sort_order': 2
    },
    {
        'id': 'yellow',
        'label': 'GIALLO',
        'color': '#fbbf24',
        'description': 'Plastica e metalli.',
        'sort_order': 3
    },
    {
        'id': 'brown',
        'label': 'MARRONE',
        'color': '#a16207',
        'description': 'Organico / umido.',
        'sort_order': 4
    },
    {
        'id': 'gray',
        'label': 'GRIGIO / NERO',
        'color': '#475569',
        'description': 'Indifferenziato.',
        'sort_order': 5
    }
]


WASTE_CATEGORIES = [
    {
        'id': 'paper_cardboard',
        'name': 'Carta e cartone',
        'description': 'Fogli, cartoncini, giornali e imballaggi in carta.',
        'sort_order': 1
    },
    {
        'id': 'plastic_metals',
        'name': 'Plastica e metalli',
        'description': 'Bottiglie, flaconi, lattine e piccoli metalli.',
        'sort_order': 2
    },
    {
        'id': 'glass',
        'name': 'Vetro',
        'description': 'Bottiglie e vasetti in vetro.',
        'sort_order': 3
    },
    {
        'id': 'organic',
        'name': 'Organico / umido',
        'description': 'Scarti di cibo, bucce e fondi di caffè.',
        'sort_order': 4
    },
    {
        'id': 'residual',
        'name': 'Indifferenziato',
        'description': 'Rifiuti non riciclabili.',
        'sort_order': 5
    }
]


RARITIES = [
    {'id': 'legendary', 'name': 'Capo leggendario', 'chance_percent': 5.0, 'color': '#f97316', 'sort_order': 1},
    {'id': 'epic', 'name': 'Eco-mon epico', 'chance_percent': 10.0, 'color': '#8b5cf6', 'sort_order': 2},
    {'id': 'rare', 'name': 'Eco-mon raro', 'chance_percent': 20.0, 'color': '#f59e0b', 'sort_order': 3},
    {'id': 'uncommon', 'name': 'Eco-mon non comune', 'chance_percent': 27.5, 'color': '#14b8a6', 'sort_order': 4},
    {'id': 'common', 'name': 'Eco-mon comune', 'chance_percent': 37.5, 'color': '#94a3b8', 'sort_order': 5}
]


CATEGORY_BINS = [
    {'category_id': 'paper_cardboard', 'bin_id': 'blue'},
    {'category_id': 'plastic_metals', 'bin_id': 'yellow'},
    {'category_id': 'glass', 'bin_id': 'green'},
    {'category_id': 'organic', 'bin_id': 'brown'},
    {'category_id': 'residual', 'bin_id': 'gray'}
]


ECO_MON_CARDS = [
    # --- CARTA E CARTONE ---
    {
        'id': 'paper_common',
        'category_id': 'paper_cardboard',
        'rarity_id': 'common',
        'name': 'Carta-Kong',
        'material': 'Carta e cartone',
        'color': '#60a5fa',
        'description': 'Fogli, cartoncini e giornali puliti.',
        'keywords': ['paper', 'newspaper', 'book', 'notebook', 'cardboard', 'envelope', 'carton box'],
        'sort_order': 1
    },
    {
        'id': 'paper_uncommon',
        'category_id': 'paper_cardboard',
        'rarity_id': 'uncommon',
        'name': 'Tetra-Fox',
        'material': 'Tetrapak',
        'color': '#f59e0b',
        'description': 'Cartoni per bevande e succhi.',
        'keywords': ['milk carton', 'juice carton', 'tetra', 'drink carton', 'beverage carton'],
        'sort_order': 2
    },
    {
        'id': 'paper_rare',
        'category_id': 'paper_cardboard',
        'rarity_id': 'rare',
        'name': 'Scatola-Fante',
        'material': 'Scatole di cartone',
        'color': '#f59e0b',
        'description': 'Scatole di cartone ondulato per imballaggi.',
        'keywords': ['cardboard box', 'shipping box', 'corrugated', 'package box', 'moving box'],
        'sort_order': 3
    },
    {
        'id': 'paper_epic',
        'category_id': 'paper_cardboard',
        'rarity_id': 'epic',
        'name': 'Giornale-Fenice',
        'material': 'Carta riciclata',
        'color': '#8b5cf6',
        'description': 'Giornali rari e riviste specializzate di qualità.',
        'keywords': ['newspaper', 'magazine', 'journal', 'publication', 'press'],
        'sort_order': 4
    },
    {
        'id': 'paper_legendary',
        'category_id': 'paper_cardboard',
        'rarity_id': 'legendary',
        'name': 'Libro-Drago',
        'material': 'Carta pregiata',
        'color': '#f97316',
        'description': 'Libri antichi e rari, un tesoro di carta.',
        'keywords': ['book', 'manuscript', 'ancient book', 'rare book', 'library book'],
        'sort_order': 5
    },
    # --- PLASTICA E METALLI ---
    {
        'id': 'plastic_common',
        'category_id': 'plastic_metals',
        'rarity_id': 'common',
        'name': 'PET-Dragon',
        'material': 'Plastica (PET)',
        'color': '#fbbf24',
        'description': 'Bottiglie e flaconi in plastica trasparente.',
        'keywords': ['plastic bottle', 'water bottle', 'soda bottle', 'pop bottle', 'detergent bottle'],
        'sort_order': 6
    },
    {
        'id': 'plastic_uncommon',
        'category_id': 'plastic_metals',
        'rarity_id': 'uncommon',
        'name': 'HDPE-Tigre',
        'material': 'Plastica (HDPE)',
        'color': '#14b8a6',
        'description': 'Flaconi in plastica rigida per detergenti e latte.',
        'keywords': ['milk bottle', 'detergent', 'shampoo bottle', 'plastic jug', 'hdpe container'],
        'sort_order': 7
    },
    {
        'id': 'plastic_rare',
        'category_id': 'plastic_metals',
        'rarity_id': 'rare',
        'name': 'Alu-Rex',
        'material': 'Metalli leggeri',
        'color': '#94a3b8',
        'description': 'Lattine, scatolette e piccoli metalli.',
        'keywords': ['soda can', 'beer can', 'tin can', 'aluminum', 'steel', 'metal can'],
        'sort_order': 8
    },
    {
        'id': 'plastic_epic',
        'category_id': 'plastic_metals',
        'rarity_id': 'epic',
        'name': 'Metallo-Chimera',
        'material': 'Acciaio inossidabile',
        'color': '#8b5cf6',
        'description': 'Oggetti rari in acciaio inossidabile e leghe nobili.',
        'keywords': ['stainless steel', 'metal alloy', 'quality metal', 'steel product'],
        'sort_order': 9
    },
    {
        'id': 'plastic_legendary',
        'category_id': 'plastic_metals',
        'rarity_id': 'legendary',
        'name': 'Titanio-Titano',
        'material': 'Titanio puro',
        'color': '#f97316',
        'description': 'Rarissimi oggetti in titanio, il metallo dei campioni.',
        'keywords': ['titanium', 'rare metal', 'high quality metal', 'aerospace material'],
        'sort_order': 10
    },
    # --- VETRO ---
    {
        'id': 'glass_common',
        'category_id': 'glass',
        'rarity_id': 'common',
        'name': 'Barattolo-Lumaca',
        'material': 'Vetro',
        'color': '#22c55e',
        'description': 'Barattoli di vetro comune per conserve.',
        'keywords': ['glass jar', 'preserve jar', 'storage jar', 'food container'],
        'sort_order': 11
    },
    {
        'id': 'glass_uncommon',
        'category_id': 'glass',
        'rarity_id': 'uncommon',
        'name': 'Bottiglia-Serpente',
        'material': 'Vetro trasparente',
        'color': '#14b8a6',
        'description': 'Bottiglie di vetro trasparente per bevande.',
        'keywords': ['glass bottle', 'wine bottle', 'beer bottle', 'beverage bottle'],
        'sort_order': 12
    },
    {
        'id': 'glass_rare',
        'category_id': 'glass',
        'rarity_id': 'rare',
        'name': 'Vetro-Aquila',
        'material': 'Vetro colorato',
        'color': '#f59e0b',
        'description': 'Vetri colorati e decorativi di qualità.',
        'keywords': ['colored glass', 'decorative glass', 'glass art', 'stained glass'],
        'sort_order': 13
    },
    {
        'id': 'glass_epic',
        'category_id': 'glass',
        'rarity_id': 'epic',
        'name': 'Cristallo-Fenice',
        'material': 'Cristallo',
        'color': '#8b5cf6',
        'description': 'Cristalli di alta qualità, trasparenti e brillanti.',
        'keywords': ['crystal', 'fine glass', 'crystal clear', 'high quality glass'],
        'sort_order': 14
    },
    {
        'id': 'glass_legendary',
        'category_id': 'glass',
        'rarity_id': 'legendary',
        'name': 'Diamante-Vetro',
        'material': 'Cristallo di Boemia',
        'color': '#f97316',
        'description': 'Cristalli di Boemia, il massimo della perfezione vitrea.',
        'keywords': ['bohemian crystal', 'fine crystal', 'precious glass', 'luxury glass'],
        'sort_order': 15
    },
    # --- ORGANICO / UMIDO ---
    {
        'id': 'organic_common',
        'category_id': 'organic',
        'rarity_id': 'common',
        'name': 'Bio-Fungo',
        'material': 'Organico / umido',
        'color': '#a16207',
        'description': 'Scarti di cibo comuni, bucce e fondi di caffè.',
        'keywords': ['banana', 'apple', 'orange', 'vegetable', 'salad', 'sandwich', 'pizza', 'mushroom'],
        'sort_order': 16
    },
    {
        'id': 'organic_uncommon',
        'category_id': 'organic',
        'rarity_id': 'uncommon',
        'name': 'Compost-Orso',
        'material': 'Scarti biodegradabili',
        'color': '#14b8a6',
        'description': 'Scarti da giardino, foglie e erba secca.',
        'keywords': ['leaves', 'grass', 'garden waste', 'branches', 'yard waste', 'compost'],
        'sort_order': 17
    },
    {
        'id': 'organic_rare',
        'category_id': 'organic',
        'rarity_id': 'rare',
        'name': 'Humus-Lince',
        'material': 'Terriccio organico',
        'color': '#f59e0b',
        'description': 'Humus ricco di sostanze organiche e micronutrienti.',
        'keywords': ['humus', 'soil', 'rich soil', 'organic matter', 'earth'],
        'sort_order': 18
    },
    {
        'id': 'organic_epic',
        'category_id': 'organic',
        'rarity_id': 'epic',
        'name': 'Fertilizzante-Falco',
        'material': 'Compost maturo',
        'color': '#8b5cf6',
        'description': 'Compost raramente perfetto per la coltivazione.',
        'keywords': ['fertilizer', 'mature compost', 'nutrients', 'plant food', 'growth medium'],
        'sort_order': 19
    },
    {
        'id': 'organic_legendary',
        'category_id': 'organic',
        'rarity_id': 'legendary',
        'name': 'Terreno-Sacro',
        'material': 'Suolo rigenerato',
        'color': '#f97316',
        'description': 'Il suolo perfetto rigenerato dalla natura stessa.',
        'keywords': ['regenerated soil', 'sacred earth', 'perfect soil', 'virgin soil', 'prime matter'],
        'sort_order': 20
    },
    # --- INDIFFERENZIATO ---
    {
        'id': 'residual_common',
        'category_id': 'residual',
        'rarity_id': 'common',
        'name': 'Scarto-Goblin',
        'material': 'Rifiuti misti',
        'color': '#475569',
        'description': 'Rifiuti comuni non riciclabili.',
        'keywords': ['waste', 'garbage', 'trash', 'refuse', 'litter'],
        'sort_order': 21
    },
    {
        'id': 'residual_uncommon',
        'category_id': 'residual',
        'rarity_id': 'uncommon',
        'name': 'Detrito-Troll',
        'material': 'Macerie',
        'color': '#14b8a6',
        'description': 'Detriti e frammenti di vari materiali.',
        'keywords': ['debris', 'fragments', 'rubble', 'broken pieces', 'remnants'],
        'sort_order': 22
    },
    {
        'id': 'residual_rare',
        'category_id': 'residual',
        'rarity_id': 'rare',
        'name': 'Reliquia-Orco',
        'material': 'Oggetti complessi',
        'color': '#f59e0b',
        'description': 'Oggetti composti di materiali misti difficili da riciclare.',
        'keywords': ['composite', 'mixed materials', 'complex object', 'multi-material'],
        'sort_order': 23
    },
    {
        'id': 'residual_epic',
        'category_id': 'residual',
        'rarity_id': 'epic',
        'name': 'Mistero-Strega',
        'material': 'Enigmatico',
        'color': '#8b5cf6',
        'description': 'Un oggetto misterioso il cui materiale è ancora sconosciuto.',
        'keywords': ['mystery', 'unknown', 'enigmatic', 'puzzle', 'unidentified'],
        'sort_order': 24
    },
    {
        'id': 'residual_legendary',
        'category_id': 'residual',
        'rarity_id': 'legendary',
        'name': 'Arcano-Leviathan',
        'material': 'Leggenda perduta',
        'color': '#f97316',
        'description': 'Una leggenda perduta tra i rifiuti, forse non doveva essere qui.',
        'keywords': ['legendary', 'mythical', 'ancient', 'forgotten', 'magical artifact'],
        'sort_order': 25
    }
]


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
        connection.execute('PRAGMA foreign_keys = ON')
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            '''
        )
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS waste_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            )
            '''
        )
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS waste_bins (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                color TEXT NOT NULL,
                description TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            )
            '''
        )
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS rarities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                chance_percent REAL NOT NULL,
                color TEXT NOT NULL,
                sort_order INTEGER NOT NULL
            )
            '''
        )
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS category_bins (
                category_id TEXT NOT NULL,
                bin_id TEXT NOT NULL,
                PRIMARY KEY (category_id, bin_id),
                FOREIGN KEY (category_id) REFERENCES waste_categories(id),
                FOREIGN KEY (bin_id) REFERENCES waste_bins(id)
            )
            '''
        )
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS eco_mon_cards (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL,
                rarity_id TEXT NOT NULL,
                name TEXT NOT NULL,
                material TEXT NOT NULL,
                color TEXT NOT NULL,
                description TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                keywords_json TEXT NOT NULL,
                FOREIGN KEY (category_id) REFERENCES waste_categories(id),
                FOREIGN KEY (rarity_id) REFERENCES rarities(id)
            )
            '''
        )

        card_columns = {row['name'] for row in connection.execute('PRAGMA table_info(eco_mon_cards)').fetchall()}
        if 'name' not in card_columns:
            connection.execute('ALTER TABLE eco_mon_cards ADD COLUMN name TEXT')

        rarity_columns = {row['name'] for row in connection.execute('PRAGMA table_info(rarities)').fetchall()}
        if 'chance_percent' not in rarity_columns:
            connection.execute('ALTER TABLE rarities ADD COLUMN chance_percent REAL')

        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS game_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_date TEXT NOT NULL,
                today_scans INTEGER NOT NULL,
                today_collected_json TEXT NOT NULL,
                unlocked_json TEXT NOT NULL
            )
            '''
        )
        current_schema = connection.execute(
            "SELECT value FROM schema_meta WHERE key = 'catalog_schema_version'"
        ).fetchone()
        if current_schema is None or current_schema['value'] != '3':
            connection.execute('DELETE FROM category_bins')
            connection.execute('DELETE FROM eco_mon_cards')
            connection.execute('DELETE FROM rarities')
            connection.execute('DELETE FROM waste_categories')
            connection.execute('DELETE FROM waste_bins')

        for item in WASTE_BINS:
            connection.execute(
                '''
                INSERT OR IGNORE INTO waste_bins (id, label, color, description, sort_order)
                VALUES (?, ?, ?, ?, ?)
                ''',
                (item['id'], item['label'], item['color'], item['description'], item['sort_order'])
            )

        for item in WASTE_CATEGORIES:
            connection.execute(
                '''
                INSERT OR IGNORE INTO waste_categories (id, name, description, sort_order)
                VALUES (?, ?, ?, ?)
                ''',
                (item['id'], item['name'], item['description'], item['sort_order'])
            )

        for item in RARITIES:
            connection.execute(
                '''
                INSERT OR IGNORE INTO rarities (id, name, chance_percent, color, sort_order)
                VALUES (?, ?, ?, ?, ?)
                ''',
                (item['id'], item['name'], item['chance_percent'], item['color'], item['sort_order'])
            )
        for item in CATEGORY_BINS:
            connection.execute(
                '''
                INSERT OR IGNORE INTO category_bins (category_id, bin_id)
                VALUES (?, ?)
                ''',
                (item['category_id'], item['bin_id'])
            )

        existing_cards = connection.execute('SELECT COUNT(*) AS count FROM eco_mon_cards').fetchone()['count']
        if not existing_cards:
            connection.executemany(
                '''
                INSERT INTO eco_mon_cards (id, category_id, rarity_id, name, material, color, description, sort_order, keywords_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                [
                    (
                        item['id'],
                        item['category_id'],
                        item['rarity_id'],
                        item['name'],
                        next(category['name'] for category in WASTE_CATEGORIES if category['id'] == item['category_id']),
                        item['color'],
                        item['description'],
                        item['sort_order'],
                        json.dumps(item['keywords'])
                    )
                    for item in ECO_MON_CARDS
                ]
            )

        state_exists = connection.execute('SELECT COUNT(*) AS count FROM game_state').fetchone()['count']
        if not state_exists:
            connection.execute(
                '''
                INSERT INTO game_state (id, last_date, today_scans, today_collected_json, unlocked_json)
                VALUES (1, ?, 0, '[]', '{}')
                ''',
                (date.today().isoformat(),)
            )

        connection.execute(
            "INSERT INTO schema_meta (key, value) VALUES ('catalog_schema_version', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        connection.commit()


def _get_state_row(connection):
    row = connection.execute('SELECT * FROM game_state WHERE id = 1').fetchone()
    if row is None:
        connection.execute(
            "INSERT INTO game_state (id, last_date, today_scans, today_collected_json, unlocked_json) VALUES (1, ?, 0, '[]', '{}')",
            (date.today().isoformat(),)
        )
        row = connection.execute('SELECT * FROM game_state WHERE id = 1').fetchone()
    return row


def _state_payload(row):
    return {
        'lastDate': row['last_date'],
        'todayScans': row['today_scans'],
        'todayCollected': json.loads(row['today_collected_json']),
        'unlocked': json.loads(row['unlocked_json'])
    }


def _ensure_today(connection):
    row = _get_state_row(connection)
    today = date.today().isoformat()
    if row['last_date'] == today:
        return _state_payload(row)

    unlocked = json.loads(row['unlocked_json'])
    connection.execute(
        '''
        UPDATE game_state
        SET last_date = ?, today_scans = 0, today_collected_json = '[]', unlocked_json = ?
        WHERE id = 1
        ''',
        (today, json.dumps(unlocked))
    )
    connection.commit()
    return {
        'lastDate': today,
        'todayScans': 0,
        'todayCollected': [],
        'unlocked': unlocked
    }


def get_catalog():
    with get_connection() as connection:
        category_rows = connection.execute('SELECT * FROM waste_categories ORDER BY sort_order, name').fetchall()
        bin_rows = connection.execute('SELECT * FROM waste_bins ORDER BY sort_order, label').fetchall()
        rarity_rows = connection.execute('SELECT * FROM rarities ORDER BY sort_order, name').fetchall()
        category_bin_rows = connection.execute(
            '''
            SELECT category_bins.category_id, waste_bins.id AS bin_id, waste_bins.label, waste_bins.color, waste_bins.description
            FROM category_bins
            JOIN waste_bins ON waste_bins.id = category_bins.bin_id
            ORDER BY waste_bins.sort_order, waste_bins.label
            '''
        ).fetchall()
        rows = connection.execute(
            '''
            SELECT eco_mon_cards.*, waste_categories.name AS category_name, waste_categories.description AS category_description,
                   rarities.name AS rarity_name, rarities.color AS rarity_color
            FROM eco_mon_cards
            JOIN waste_categories ON waste_categories.id = eco_mon_cards.category_id
            JOIN rarities ON rarities.id = eco_mon_cards.rarity_id
            ORDER BY eco_mon_cards.sort_order, eco_mon_cards.name
            '''
        ).fetchall()

        categories = []
        categories_by_id = {}
        for row in category_rows:
            category = {
                'id': row['id'],
                'name': row['name'],
                'description': row['description']
            }
            categories.append(category)
            categories_by_id[row['id']] = {**category, 'bins': []}

        bins = [
            {
                'id': row['id'],
                'label': row['label'],
                'color': row['color'],
                'description': row['description']
            }
            for row in bin_rows
        ]

        rarities = [
            {
                'id': row['id'],
                'name': row['name'],
                'chancePercent': row['chance_percent'],
                'color': row['color']
            }
            for row in rarity_rows
        ]

        for row in category_bin_rows:
            if row['category_id'] in categories_by_id:
                categories_by_id[row['category_id']]['bins'].append(
                    {
                        'id': row['bin_id'],
                        'label': row['label'],
                        'color': row['color'],
                        'description': row['description']
                    }
                )

        eco_mons = []
        ai_keywords = []

        for row in rows:
            keywords = json.loads(row['keywords_json'])
            category_bins = categories_by_id.get(row['category_id'], {}).get('bins', [])
            primary_bin = category_bins[0] if category_bins else None
            eco_mons.append(
                {
                    'id': row['id'],
                    'name': row['name'],
                    'material': row['category_name'],
                    'categoryId': row['category_id'],
                    'category': row['category_name'],
                    'bin': primary_bin['label'] if primary_bin else None,
                    'binColor': primary_bin['color'] if primary_bin else None,
                    'bins': [bin_item['label'] for bin_item in category_bins],
                    'color': row['color'],
                    'rarityId': row['rarity_id'],
                    'rarity': row['rarity_name'],
                    'rarityColor': row['rarity_color'],
                    'description': row['description']
                }
            )
            ai_keywords.append({'id': row['id'], 'keywords': keywords})

        return {
            'maxDailyScans': MAX_DAILY_SCANS,
            'categories': categories,
            'bins': bins,
            'rarities': rarities,
            'ecoMons': eco_mons,
            'wasteTypes': [
                {
                    **categories_by_id[item['id']],
                    'bins': [
                        {
                            'id': bin_item['id'],
                            'label': bin_item['label'],
                            'color': bin_item['color'],
                            'description': bin_item['description']
                        }
                        for bin_item in categories_by_id[item['id']]['bins']
                    ]
                }
                for item in categories
            ],
            'aiKeywords': ai_keywords
        }


def get_state():
    with get_connection() as connection:
        return _ensure_today(connection)


def confirm_scan(card_id):
    with get_connection() as connection:
        state = _ensure_today(connection)
        
        # Trova l'eco-mon riconosciuto per estrarre la categoria
        recognized_card = connection.execute(
            'SELECT category_id FROM eco_mon_cards WHERE id = ?',
            (card_id,)
        ).fetchone()
        
        if not recognized_card:
            raise ValueError('Carta non trovata.')
        
        category_id = recognized_card['category_id']
        
        # Seleziona casualmente uno dei 5 eco-mon della categoria
        random_rows = connection.execute(
            '''
            SELECT eco_mon_cards.*, rarities.name AS rarity_name, rarities.chance_percent AS rarity_chance_percent,
                   rarities.color AS rarity_color, waste_categories.name AS category_name
            FROM eco_mon_cards
            JOIN rarities ON rarities.id = eco_mon_cards.rarity_id
            JOIN waste_categories ON waste_categories.id = eco_mon_cards.category_id
            WHERE eco_mon_cards.category_id = ?
            ''',
            (category_id,)
        ).fetchall()
        
        if not random_rows:
            raise ValueError('Nessun Eco-Mon trovato per questa categoria.')
        
        # Seleziona casualmente uno
        selected_card_row = random.choice(random_rows)
        selected_card_id = selected_card_row['id']
        
        if state['todayScans'] >= MAX_DAILY_SCANS:
            raise PermissionError('Limite giornaliero raggiunto. Torna domani!')

        if selected_card_id in state['todayCollected']:
            raise PermissionError('Hai già salvato questo Eco-Mon oggi! Cerca altri materiali.')

        state['todayScans'] += 1
        state['todayCollected'].append(selected_card_id)
        state['unlocked'][selected_card_id] = True

        connection.execute(
            '''
            UPDATE game_state
            SET last_date = ?, today_scans = ?, today_collected_json = ?, unlocked_json = ?
            WHERE id = 1
            ''',
            (
                state['lastDate'],
                state['todayScans'],
                json.dumps(state['todayCollected']),
                json.dumps(state['unlocked'])
            )
        )
        connection.commit()

        card = {
            'id': selected_card_row['id'],
            'name': selected_card_row['name'],
            'material': selected_card_row['material'],
            'bin': None,
            'color': selected_card_row['color'],
            'rarity': selected_card_row['rarity_name'],
            'rarityChancePercent': selected_card_row['rarity_chance_percent'],
            'rarityColor': selected_card_row['rarity_color'],
            'description': selected_card_row['description']
        }

        bin_row = connection.execute(
            '''
            SELECT waste_bins.label, waste_bins.color
            FROM category_bins
            JOIN waste_bins ON waste_bins.id = category_bins.bin_id
            WHERE category_bins.category_id = ?
            ORDER BY waste_bins.sort_order, waste_bins.label
            LIMIT 1
            ''',
            (category_id,)
        ).fetchone()

        card['bin'] = bin_row['label'] if bin_row else None
        card['binColor'] = bin_row['color'] if bin_row else None

        return state, card


def reset_state():
    with get_connection() as connection:
        today = date.today().isoformat()
        connection.execute(
            '''
            UPDATE game_state
            SET last_date = ?, today_scans = 0, today_collected_json = '[]', unlocked_json = '{}'
            WHERE id = 1
            ''',
            (today,)
        )

        connection.execute(
            "INSERT INTO schema_meta (key, value) VALUES ('catalog_schema_version', '2') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        connection.commit()
        connection.commit()
        return {
            'lastDate': today,
            'todayScans': 0,
            'todayCollected': [],
            'unlocked': {}
        }


if __name__ == '__main__':
    initialize_db()
    print(f'Database ready at {DB_PATH}')