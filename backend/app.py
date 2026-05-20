import json
import os
import sqlite3
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'ecomon.sqlite3')
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


def connect_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with connect_db() as connection:
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS eco_mons (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                material TEXT NOT NULL,
                bin TEXT NOT NULL,
                color TEXT NOT NULL,
                rarity TEXT NOT NULL,
                description TEXT NOT NULL,
                keywords_json TEXT NOT NULL
            )
            '''
        )
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

        existing = connection.execute('SELECT COUNT(*) AS count FROM eco_mons').fetchone()['count']
        if not existing:
            connection.executemany(
                '''
                INSERT INTO eco_mons (id, name, material, bin, color, rarity, description, keywords_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                [
                    (
                        item['id'],
                        item['name'],
                        item['material'],
                        item['bin'],
                        item['color'],
                        item['rarity'],
                        item['description'],
                        json.dumps(item['keywords'])
                    )
                    for item in ECOMONS
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


def get_state_row(connection):
    row = connection.execute('SELECT * FROM game_state WHERE id = 1').fetchone()
    if row is None:
        connection.execute(
            "INSERT INTO game_state (id, last_date, today_scans, today_collected_json, unlocked_json) VALUES (1, ?, 0, '[]', '{}')",
            (date.today().isoformat(),)
        )
        row = connection.execute('SELECT * FROM game_state WHERE id = 1').fetchone()
    return row


def state_payload(row):
    return {
        'lastDate': row['last_date'],
        'todayScans': row['today_scans'],
        'todayCollected': json.loads(row['today_collected_json']),
        'unlocked': json.loads(row['unlocked_json'])
    }


def ensure_today(connection):
    row = get_state_row(connection)
    today = date.today().isoformat()
    if row['last_date'] == today:
        return state_payload(row)

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


def get_catalog(connection):
    rows = connection.execute('SELECT * FROM eco_mons ORDER BY id').fetchall()
    eco_mons = []
    ai_keywords = []

    for row in rows:
        keywords = json.loads(row['keywords_json'])
        eco_mons.append(
            {
                'id': row['id'],
                'name': row['name'],
                'material': row['material'],
                'bin': row['bin'],
                'color': row['color'],
                'rarity': row['rarity'],
                'description': row['description']
            }
        )
        ai_keywords.append({'id': row['id'], 'keywords': keywords})

    return {
        'maxDailyScans': MAX_DAILY_SCANS,
        'ecoMons': eco_mons,
        'wasteTypes': eco_mons,
        'aiKeywords': ai_keywords
    }


def reset_state(connection):
    today = date.today().isoformat()
    connection.execute(
        '''
        UPDATE game_state
        SET last_date = ?, today_scans = 0, today_collected_json = '[]', unlocked_json = '{}'
        WHERE id = 1
        ''',
        (today,)
    )
    connection.commit()
    return {
        'lastDate': today,
        'todayScans': 0,
        'todayCollected': [],
        'unlocked': {}
    }


def record_scan(connection, card_id):
    state = ensure_today(connection)
    rows = connection.execute('SELECT * FROM eco_mons WHERE id = ?', (card_id,)).fetchall()
    if not rows:
        raise ValueError('Carta non trovata.')

    if state['todayScans'] >= MAX_DAILY_SCANS:
        raise PermissionError('Limite giornaliero raggiunto. Torna domani!')

    if card_id in state['todayCollected']:
        raise PermissionError('Hai già salvato questo Eco-Mon oggi! Cerca altri materiali.')

    state['todayScans'] += 1
    state['todayCollected'].append(card_id)
    state['unlocked'][card_id] = True

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

    card_row = rows[0]
    card = {
        'id': card_row['id'],
        'name': card_row['name'],
        'material': card_row['material'],
        'bin': card_row['bin'],
        'color': card_row['color'],
        'rarity': card_row['rarity'],
        'description': card_row['description']
    }

    return state, card


def write_json(handler, status_code, payload):
    body = json.dumps(payload).encode('utf-8')
    handler.send_response(status_code)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type')
    handler.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    handler.end_headers()
    handler.wfile.write(body)


class EcoMonHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.end_headers()

    def do_GET(self):
        with connect_db() as connection:
            if self.path == '/api/catalog':
                write_json(self, 200, get_catalog(connection))
                return

            if self.path == '/api/state':
                write_json(self, 200, {'state': ensure_today(connection)})
                return

        write_json(self, 404, {'error': 'Not found'})

    def do_POST(self):
        length = int(self.headers.get('Content-Length', '0'))
        raw_body = self.rfile.read(length).decode('utf-8') if length else '{}'
        try:
            body = json.loads(raw_body or '{}')
        except json.JSONDecodeError:
            write_json(self, 400, {'error': 'Invalid JSON body'})
            return

        with connect_db() as connection:
            try:
                if self.path == '/api/confirm':
                    card_id = body.get('cardId')
                    if not card_id:
                        write_json(self, 400, {'error': 'cardId is required'})
                        return

                    state, card = record_scan(connection, card_id)
                    write_json(self, 200, {'state': state, 'card': card})
                    return

                if self.path == '/api/reset':
                    write_json(self, 200, {'state': reset_state(connection)})
                    return
            except PermissionError as error:
                write_json(self, 409, {'error': str(error)})
                return
            except ValueError as error:
                write_json(self, 404, {'error': str(error)})
                return

        write_json(self, 404, {'error': 'Not found'})

    def log_message(self, format, *args):
        return


def main():
    init_db()
    server = ThreadingHTTPServer(('127.0.0.1', 8000), EcoMonHandler)
    print('EcoMon backend running on http://127.0.0.1:8000')
    server.serve_forever()


if __name__ == '__main__':
    main()