import json
import sqlite3
from datetime import date

from config import DB_DIR, DB_PATH, ECOMONS, MAX_DAILY_SCANS


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    DB_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as connection:
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


def get_state():
    with get_connection() as connection:
        return _ensure_today(connection)


def confirm_scan(card_id):
    with get_connection() as connection:
        state = _ensure_today(connection)
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