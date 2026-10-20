"""Клиент Supabase REST API для доступа к данным."""

import json
import urllib.request
import urllib.error

from config import SUPABASE_URL, SUPABASE_ANON_KEY

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError(
        'SUPABASE_URL / SUPABASE_ANON_KEY не заданы. '
        'Проверьте файл .env в корне проекта.'
    )

_BASE = SUPABASE_URL.rstrip('/')
_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}


def _url(table, params=None):
    q = '/rest/v1/' + table
    if params:
        from urllib.parse import urlencode
        q += '?' + urlencode(params)
    return _BASE + q


def _req(method, url, body=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, headers=_HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode('utf-8')
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        raise RuntimeError(f'Supabase {method} {url} -> {e.code}: {raw}') from None


def select_all(table, select='*', order=None, filters=None, limit=None):
    """Возвращает список dict из таблицы."""
    params = {'select': select}
    if order:
        params['order'] = order
    if limit:
        params['limit'] = str(limit)
    if filters:
        params.update(filters)
    return _req('GET', _url(table, params)) or []


def select_one(table, select='*', filters=None):
    """Возвращает один dict или None."""
    params = {'select': select, 'limit': '1'}
    if filters:
        params.update(filters)
    rows = _req('GET', _url(table, params)) or []
    return rows[0] if rows else None


def insert(table, payload):
    """Вставляет строку и возвращает её."""
    rows = _req('POST', _url(table), payload)
    if isinstance(rows, list):
        return rows[0] if rows else None
    return rows


def update(table, payload, eq_field, eq_value):
    """Обновляет строки по условию eq_field=eq_value и возвращает их.

    eq_value — чистое значение (без префикса eq.)."""
    params = {eq_field: f'eq.{eq_value}'}
    rows = _req('PATCH', _url(table, params), payload)
    if isinstance(rows, list):
        return rows[0] if rows else None
    return rows


def delete(table, eq_field, eq_value):
    """Удаляет строки по условию eq_field=eq_value."""
    params = {eq_field: f'eq.{eq_value}'}
    _req('DELETE', _url(table, params), None)
