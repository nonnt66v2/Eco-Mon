from flask import Flask, jsonify, request

from config import ALLOWED_HEADERS, ALLOWED_METHODS, ALLOWED_ORIGIN, API_HOST, API_PORT, get_public_config
from db.init_db import confirm_scan, get_catalog, get_state, initialize_db, reset_state


app = Flask(__name__)

initialize_db()


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN
    response.headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS
    response.headers['Access-Control-Allow-Methods'] = ALLOWED_METHODS
    return response


@app.route('/api/catalog', methods=['GET', 'OPTIONS'])
def catalog():
    if request.method == 'OPTIONS':
        return ('', 204)
    return jsonify(get_catalog())


@app.route('/api/state', methods=['GET', 'OPTIONS'])
def state():
    if request.method == 'OPTIONS':
        return ('', 204)
    return jsonify({'state': get_state()})


@app.route('/api/config', methods=['GET', 'OPTIONS'])
def public_config():
    if request.method == 'OPTIONS':
        return ('', 204)
    return jsonify(get_public_config())


@app.route('/api/confirm', methods=['POST', 'OPTIONS'])
def confirm():
    if request.method == 'OPTIONS':
        return ('', 204)

    payload = request.get_json(silent=True) or {}
    card_id = payload.get('cardId')
    if not card_id:
        return jsonify({'error': 'cardId is required'}), 400

    try:
        state, card = confirm_scan(card_id)
    except PermissionError as error:
        return jsonify({'error': str(error)}), 409
    except ValueError as error:
        return jsonify({'error': str(error)}), 404

    return jsonify({'state': state, 'card': card})


@app.route('/api/reset', methods=['POST', 'OPTIONS'])
def reset():
    if request.method == 'OPTIONS':
        return ('', 204)
    return jsonify({'state': reset_state()})


def main():
    initialize_db()
    print(f'EcoMon Flask backend running on http://{API_HOST}:{API_PORT}')
    app.run(host=API_HOST, port=API_PORT, debug=False)


if __name__ == '__main__':
    main()