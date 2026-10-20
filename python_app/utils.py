"""Утилиты форматирования и экспорта."""

import csv
import io
from datetime import date, datetime


def format_currency(value):
    if value is None:
        return '—'
    try:
        n = float(value)
    except (TypeError, ValueError):
        return '—'
    s = f'{n:,.0f}'.replace(',', ' ')
    return f'{s} ₽'


def format_number(value):
    if value is None:
        return '—'
    try:
        n = float(value)
    except (TypeError, ValueError):
        return '—'
    return f'{n:,.0f}'.replace(',', ' ')


def format_date(value):
    if not value:
        return '—'
    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')
    if isinstance(value, datetime):
        return value.strftime('%d.%m.%Y')
    try:
        d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return d.strftime('%d.%m.%Y')
    except (ValueError, TypeError):
        return str(value)


def format_datetime(value):
    if not value:
        return '—'
    if isinstance(value, datetime):
        return value.strftime('%d.%m.%Y %H:%M')
    if isinstance(value, date):
        return value.strftime('%d.%m.%Y')
    try:
        d = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        return d.strftime('%d.%m.%Y %H:%M')
    except (ValueError, TypeError):
        return str(value)


def to_date_str(value):
    if not value or value == '':
        return None
    if isinstance(value, (date, datetime)):
        return value.isoformat()[:10]
    return str(value)[:10]


def parse_float(value):
    try:
        return float(value) if value not in (None, '') else 0
    except (TypeError, ValueError):
        return 0


def get_quarter(d):
    if not d:
        return ''
    if isinstance(d, str):
        try:
            d = datetime.fromisoformat(d).date()
        except ValueError:
            return ''
    q = (d.month - 1) // 3 + 1
    return f'Q{q} {d.year}'


def get_year(d):
    if not d:
        return ''
    if isinstance(d, str):
        try:
            d = datetime.fromisoformat(d).date()
        except ValueError:
            return ''
    return str(d.year)


def generate_csv(headers, rows):
    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(['' if cell is None else str(cell) for cell in row])
    return output.getvalue()
