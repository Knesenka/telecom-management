"""Главный модуль Flask-приложения «Телеком Оператор — Учёт»."""

import os
import sys
from datetime import date, datetime, timedelta

from flask import (
    Flask, render_template, request, jsonify, Response,
    redirect, url_for, flash,
)

sys.path.insert(0, os.path.dirname(__file__))

from config import SECRET_KEY
import db
from constants import (
    ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
    CUSTOMER_STATUS_LABELS, CUSTOMER_STATUS_COLORS,
    CHARGE_STATUS_LABELS, CHARGE_TYPE_LABELS, TARIFF_PLANS,
)
from utils import (
    format_currency, format_date, format_datetime,
    to_date_str, parse_float, get_quarter, get_year, generate_csv,
)

app = Flask(__name__)
app.secret_key = SECRET_KEY

app.jinja_env.globals['format_currency'] = format_currency
app.jinja_env.globals['format_date'] = format_date
app.jinja_env.globals['format_datetime'] = format_datetime


@app.context_processor
def inject_globals():
    return {
        'ORDER_STATUSES': ORDER_STATUSES,
        'ORDER_STATUS_LABELS': ORDER_STATUS_LABELS,
        'ORDER_STATUS_COLORS': ORDER_STATUS_COLORS,
        'CUSTOMER_STATUS_LABELS': CUSTOMER_STATUS_LABELS,
        'CUSTOMER_STATUS_COLORS': CUSTOMER_STATUS_COLORS,
        'CHARGE_STATUS_LABELS': CHARGE_STATUS_LABELS,
        'CHARGE_TYPE_LABELS': CHARGE_TYPE_LABELS,
        'TARIFF_PLANS': TARIFF_PLANS,
    }


TABS = [
    ('customers', 'Клиенты', 'База клиентов оператора связи'),
    ('orders', 'Заказы', 'Заказы из CRM, точки подключения, начисления'),
    ('construction', 'Заказы в стройке', 'Заказы в стадии организации: сроки, платежи, комментарии'),
    ('charges', 'Фикс. начисления', 'Начисления по фикс. базе: план/факт, строительство'),
    ('statistics', 'Статистика', 'Продажи по кварталам, годам, клиентам'),
]


def _clean(value):
    """Преобразует пустую строку в None."""
    if value is None or value == '':
        return None
    return value


def _date_or_none(value):
    return to_date_str(value)


# ============================================================
# Главная
# ============================================================
@app.route('/')
def index():
    return redirect(url_for('customers'))


# ============================================================
# Клиенты
# ============================================================
@app.route('/customers')
def customers():
    rows = db.select_all('customers', order='created_at.desc')
    for r in rows:
        r['annual_fee'] = parse_float(r.get('monthly_fee')) * 12
    return render_template('customers.html', tabs=TABS, active='customers', rows=rows)


@app.route('/customers/add', methods=['POST'])
def customers_add():
    f = request.form
    db.insert('customers', {
        'customer_name': _clean(f.get('customer_name')),
        'customer_code': _clean(f.get('customer_code')),
        'contract_number': _clean(f.get('contract_number')),
        'address': _clean(f.get('address')),
        'phone': _clean(f.get('phone')),
        'email': _clean(f.get('email')),
        'contract_date': _date_or_none(f.get('contract_date')),
        'status': f.get('status') or 'active',
        'tariff_plan': _clean(f.get('tariff_plan')),
        'monthly_fee': parse_float(f.get('monthly_fee')),
    })
    flash('Клиент добавлен', 'success')
    return redirect(url_for('customers'))


@app.route('/customers/<cid>/edit', methods=['POST'])
def customers_edit(cid):
    data = request.get_json(force=True)
    column = data.get('column')
    value = data.get('value')
    allowed = {
        'customer_name', 'customer_code', 'contract_number', 'address',
        'phone', 'email', 'contract_date', 'status', 'tariff_plan', 'monthly_fee',
    }
    if column not in allowed:
        return jsonify({'error': 'Колонка недоступна'}), 400
    if column == 'monthly_fee':
        value = parse_float(value)
    if column == 'contract_date':
        value = _date_or_none(value)
    if value == '':
        value = None
    db.update('customers', {column: value}, 'id', cid)
    return jsonify({'ok': True})


@app.route('/customers/<cid>/delete', methods=['POST'])
def customers_delete(cid):
    db.delete('customers', 'id', cid)
    flash('Клиент удалён', 'success')
    return redirect(url_for('customers'))


@app.route('/customers/export')
def customers_export():
    rows = db.select_all('customers', order='created_at.desc')
    headers = ['Клиент', 'ИНН', 'Договор', 'Адрес', 'Телефон', 'Email',
               'Дата договора', 'Статус', 'Тариф', 'Абон. плата']
    data = [[
        r.get('customer_name'), r.get('customer_code'),
        r.get('contract_number'), r.get('address'),
        r.get('phone'), r.get('email'),
        format_date(r.get('contract_date')),
        CUSTOMER_STATUS_LABELS.get(r.get('status'), r.get('status')),
        r.get('tariff_plan'),
        format_currency(r.get('monthly_fee')),
    ] for r in rows]
    return Response(generate_csv(headers, data), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=customers.csv'})


# ============================================================
# Заказы
# ============================================================
def _fetch_orders():
    rows = db.select_all('orders', select='*, customers(customer_name, customer_code)',
                         order='created_at.desc')
    for r in rows:
        cust = r.get('customers') or {}
        r['customer_name'] = cust.get('customer_name') or '—'
        r['annual_charge'] = parse_float(r.get('one_time_payment')) + parse_float(r.get('monthly_payment')) * 12
    return rows


@app.route('/orders')
def orders():
    rows = _fetch_orders()
    customers_list = db.select_all('customers', order='customer_name')
    services = [s['name'] for s in db.select_all('services', order='name')]
    actions = [a['name'] for a in db.select_all('actions', order='name')]
    return render_template('orders.html', tabs=TABS, active='orders', rows=rows,
                           customers_list=customers_list, services=services, actions=actions)


@app.route('/orders/add', methods=['POST'])
def orders_add():
    f = request.form
    order_date = _date_or_none(f.get('order_date'))
    today = date.today().isoformat()
    if order_date and order_date > today:
        flash('Дата заказа не может быть позже сегодняшнего дня', 'error')
        return redirect(url_for('orders'))
    payload = {
        'order_number': _clean(f.get('order_number')),
        'customer_id': _clean(f.get('customer_id')),
        'connection_point': _clean(f.get('connection_point')),
        'endpoint_b': _clean(f.get('endpoint_b')),
        'service_type': _clean(f.get('service_type')),
        'action_type': _clean(f.get('action_type')),
        'one_time_payment': parse_float(f.get('one_time_payment')),
        'monthly_payment': parse_float(f.get('monthly_payment')),
        'charge_amount': parse_float(f.get('monthly_payment')),
        'status': f.get('status') or 'tech_check',
        'comments': _clean(f.get('comments')),
        'order_date': order_date,
    }
    inserted = db.insert('orders', payload)
    if inserted and inserted.get('status') == 'org_in_progress' and f.get('comments'):
        db.insert('order_comments', {
            'order_id': inserted['id'],
            'author': 'Система',
            'message': f.get('comments'),
            'status_note': 'Создан заказ',
        })
    flash('Заказ добавлен', 'success')
    return redirect(url_for('orders'))


@app.route('/orders/<oid>/edit', methods=['POST'])
def orders_edit(oid):
    data = request.get_json(force=True)
    column = data.get('column')
    value = data.get('value')
    allowed = {
        'order_number', 'connection_point', 'endpoint_b', 'service_type', 'action_type',
        'one_time_payment', 'monthly_payment', 'status', 'comments',
        'order_date', 'launch_date', 'org_deadline',
    }
    if column not in allowed:
        return jsonify({'error': 'Колонка недоступна'}), 400
    if column in ('one_time_payment', 'monthly_payment'):
        value = parse_float(value)
    if column in ('order_date', 'launch_date'):
        value = _date_or_none(value)
        today = date.today().isoformat()
        if value and value > today:
            return jsonify({'error': 'Дата не может быть позже сегодняшнего дня'}), 400
    if column == 'org_deadline':
        try:
            value = int(value) if value not in (None, '', 'null') else None
        except (TypeError, ValueError):
            value = None
    if value == '':
        value = None
    db.update('orders', {column: value}, 'id', oid)
    if column == 'status' and value == 'org_in_progress':
        db.insert('order_comments', {
            'order_id': oid, 'author': 'Система',
            'message': 'Заказ переведён в стадию "Выполняется организация услуг"',
            'status_note': 'Организация услуг',
        })
    return jsonify({'ok': True})


@app.route('/orders/<oid>/delete', methods=['POST'])
def orders_delete(oid):
    db.delete('order_comments', 'order_id', oid)
    db.delete('orders', 'id', oid)
    flash('Заказ удалён', 'success')
    return redirect(url_for('orders'))


@app.route('/orders/export')
def orders_export():
    rows = _fetch_orders()
    headers = ['№ заказа', 'Клиент', 'Точка А', 'Точка Б', 'Услуга', 'Действие',
               'Единоразовый платеж', 'Ежемесячный платеж', 'Статус', 'Комментарии', 'Дата заказа']
    data = [[
        r.get('order_number'), r.get('customer_name'),
        r.get('connection_point'), r.get('endpoint_b'),
        r.get('service_type'), r.get('action_type'),
        format_currency(r.get('one_time_payment')),
        format_currency(r.get('monthly_payment')),
        ORDER_STATUS_LABELS.get(r.get('status'), r.get('status')),
        r.get('comments'), format_date(r.get('order_date')),
    ] for r in rows]
    return Response(generate_csv(headers, data), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=orders.csv'})


# ============================================================
# Заказы в стройке
# ============================================================
@app.route('/construction')
def construction():
    rows = db.select_all('orders', select='*, customers(customer_name)',
                         filters={'status': 'eq.org_in_progress'},
                         order='created_at.desc')
    for r in rows:
        cust = r.get('customers') or {}
        r['customer_name'] = cust.get('customer_name') or '—'
    services = [s['name'] for s in db.select_all('services', order='name')]
    actions = [a['name'] for a in db.select_all('actions', order='name')]
    selected_id = request.args.get('order_id')
    comments = []
    if selected_id:
        comments = db.select_all('order_comments',
                                 filters={'order_id': f'eq.{selected_id}'},
                                 order='created_at.asc')
    return render_template('construction.html', tabs=TABS, active='construction', rows=rows,
                           services=services, actions=actions,
                           selected_id=selected_id, comments=comments)


@app.route('/construction/<oid>/edit', methods=['POST'])
def construction_edit(oid):
    data = request.get_json(force=True)
    column = data.get('column')
    value = data.get('value')
    allowed = {
        'order_number', 'connection_point', 'endpoint_b', 'service_type', 'action_type',
        'launch_date', 'org_deadline', 'one_time_payment', 'monthly_payment', 'status',
    }
    if column not in allowed:
        return jsonify({'error': 'Колонка недоступна'}), 400
    updates = {}
    if column in ('one_time_payment', 'monthly_payment'):
        updates[column] = parse_float(value)
    elif column == 'org_deadline':
        try:
            updates[column] = int(value) if value not in (None, '', 'null') else None
        except (TypeError, ValueError):
            updates[column] = None
    elif column == 'launch_date':
        v = _date_or_none(value)
        today = date.today().isoformat()
        if v and v > today:
            return jsonify({'error': 'Дата не может быть позже сегодняшнего дня'}), 400
        updates[column] = v
    else:
        updates[column] = value if value not in (None, '') else None
    if column in ('launch_date', 'org_deadline'):
        row = db.select_one('orders', select='launch_date, org_deadline',
                            filters={'id': f'eq.{oid}'})
        launch = updates.get('launch_date', row.get('launch_date')) if row else None
        days = updates.get('org_deadline', row.get('org_deadline')) if row else None
        if launch and days and int(days) > 0:
            d = datetime.strptime(str(launch)[:10], '%Y-%m-%d').date()
            updates['control_date'] = (d + timedelta(days=int(days))).isoformat()
        else:
            updates['control_date'] = None
    db.update('orders', updates, 'id', oid)
    return jsonify({'ok': True})


@app.route('/construction/<oid>/delete', methods=['POST'])
def construction_delete(oid):
    db.delete('order_comments', 'order_id', oid)
    db.delete('orders', 'id', oid)
    flash('Заказ удалён', 'success')
    return redirect(url_for('construction'))


@app.route('/construction/<oid>/comments/add', methods=['POST'])
def construction_comment_add(oid):
    f = request.form
    msg = (f.get('message') or '').strip()
    if not msg:
        flash('Комментарий не может быть пустым', 'error')
        return redirect(url_for('construction', order_id=oid))
    db.insert('order_comments', {
        'order_id': oid,
        'author': (f.get('author') or '').strip() or 'Аноним',
        'message': msg,
        'status_note': (f.get('status_note') or '').strip() or None,
    })
    flash('Комментарий добавлен', 'success')
    return redirect(url_for('construction', order_id=oid))


@app.route('/construction/export')
def construction_export():
    rows = db.select_all('orders', select='*, customers(customer_name)',
                         filters={'status': 'eq.org_in_progress'},
                         order='created_at.desc')
    headers = ['№ заказа', 'Клиент', 'Точка А', 'Точка Б', 'Услуга', 'Действие',
               'Дата запуска', 'Срок (дн.)', 'Контрольная дата',
               'Единоразовый платеж', 'Ежемесячный платеж', 'Статус']
    data = []
    for r in rows:
        cust = r.get('customers') or {}
        data.append([
            r.get('order_number'), cust.get('customer_name') or '—',
            r.get('connection_point'), r.get('endpoint_b'),
            r.get('service_type'), r.get('action_type'),
            format_date(r.get('launch_date')),
            r.get('org_deadline') or '',
            format_date(r.get('control_date')),
            format_currency(r.get('one_time_payment')),
            format_currency(r.get('monthly_payment')),
            ORDER_STATUS_LABELS.get(r.get('status'), r.get('status')),
        ])
    return Response(generate_csv(headers, data), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=construction_orders.csv'})


# ============================================================
# Фикс. начисления
# ============================================================
@app.route('/charges')
def charges():
    charge_rows = db.select_all(
        'fixed_charges',
        select='*, customers(customer_name, customer_code), orders(order_number)',
        order='created_at.desc',
    )
    auto_rows = db.select_all(
        'orders', select='*, customers(customer_name)',
        filters={'status': 'eq.in_service'}, order='created_at.desc',
    )
    all_rows = []
    for r in charge_rows:
        cust = r.get('customers') or {}
        order = r.get('orders') or {}
        r['customer_name'] = cust.get('customer_name') or '—'
        r['order_number'] = order.get('order_number') or ''
        r['is_auto'] = False
        all_rows.append(r)
    for o in auto_rows:
        cust = o.get('customers') or {}
        all_rows.append({
            'id': f"auto-{o['id']}",
            'customer_id': o.get('customer_id'),
            'order_id': o['id'],
            'charge_type': 'monthly',
            'one_time_payment': parse_float(o.get('one_time_payment')),
            'monthly_payment': parse_float(o.get('monthly_payment')),
            'status': 'actual',
            'billing_month': None,
            'current_status': None,
            'created_at': o.get('created_at'),
            'customer_name': cust.get('customer_name') or '—',
            'order_number': o.get('order_number'),
            'is_auto': True,
        })
    one_time_total = sum(parse_float(r.get('one_time_payment')) for r in all_rows)
    monthly_total = sum(parse_float(r.get('monthly_payment')) for r in all_rows)
    construction_count = sum(1 for r in all_rows if r.get('charge_type') == 'construction')
    customers_list = db.select_all('customers', order='customer_name')
    return render_template('charges.html', tabs=TABS, active='charges', rows=all_rows,
                           customers_list=customers_list,
                           one_time_total=one_time_total,
                           monthly_total=monthly_total,
                           construction_count=construction_count)


@app.route('/charges/add', methods=['POST'])
def charges_add():
    f = request.form
    db.insert('fixed_charges', {
        'customer_id': _clean(f.get('customer_id')),
        'charge_type': f.get('charge_type') or 'monthly',
        'one_time_payment': parse_float(f.get('one_time_payment')),
        'monthly_payment': parse_float(f.get('monthly_payment')),
        'status': f.get('status') or 'plan',
        'billing_month': _date_or_none(f.get('billing_month')),
        'current_status': _clean(f.get('current_status')),
    })
    flash('Начисление добавлено', 'success')
    return redirect(url_for('charges'))


@app.route('/charges/<cid>/edit', methods=['POST'])
def charges_edit(cid):
    if cid.startswith('auto-'):
        return jsonify({'error': 'Автоматические начисления нельзя редактировать'}), 400
    data = request.get_json(force=True)
    column = data.get('column')
    value = data.get('value')
    allowed = {
        'charge_type', 'one_time_payment', 'monthly_payment',
        'status', 'billing_month', 'current_status',
    }
    if column not in allowed:
        return jsonify({'error': 'Колонка недоступна'}), 400
    if column in ('one_time_payment', 'monthly_payment'):
        value = parse_float(value)
    if column == 'billing_month':
        value = _date_or_none(value)
    if value == '':
        value = None
    db.update('fixed_charges', {column: value}, 'id', cid)
    return jsonify({'ok': True})


@app.route('/charges/<cid>/delete', methods=['POST'])
def charges_delete(cid):
    if cid.startswith('auto-'):
        flash('Автоматические начисления нельзя удалить', 'error')
        return redirect(url_for('charges'))
    db.delete('fixed_charges', 'id', cid)
    flash('Начисление удалено', 'success')
    return redirect(url_for('charges'))


@app.route('/charges/export')
def charges_export():
    rows = db.select_all(
        'fixed_charges',
        select='*, customers(customer_name), orders(order_number)',
        order='created_at.desc',
    )
    headers = ['Клиент', '№ заказа', 'Тип', 'Единоразовый платеж',
               'Ежемесячный платеж', 'Статус', 'Месяц', 'Текущий статус']
    data = []
    for r in rows:
        cust = r.get('customers') or {}
        order = r.get('orders') or {}
        data.append([
            cust.get('customer_name') or '—',
            order.get('order_number') or '',
            CHARGE_TYPE_LABELS.get(r.get('charge_type'), r.get('charge_type')),
            format_currency(r.get('one_time_payment')),
            format_currency(r.get('monthly_payment')),
            CHARGE_STATUS_LABELS.get(r.get('status'), r.get('status')),
            format_date(r.get('billing_month')),
            r.get('current_status') or '',
        ])
    return Response(generate_csv(headers, data), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=fixed_charges.csv'})


# ============================================================
# Статистика
# ============================================================
@app.route('/statistics')
def statistics():
    customers_list = db.select_all('customers')
    orders_list = db.select_all('orders')
    charges_list = db.select_all('fixed_charges')

    total_customers = len(customers_list)
    active_customers = sum(1 for c in customers_list if c.get('status') == 'active')
    total_orders = len(orders_list)
    total_order_amount = sum(parse_float(o.get('charge_amount')) for o in orders_list)
    construction_count = sum(1 for o in orders_list if o.get('status') == 'org_in_progress')
    total_plan = sum(parse_float(c.get('plan_amount')) for c in charges_list)
    total_actual = sum(parse_float(c.get('actual_amount')) for c in charges_list)

    by_customer = []
    for c in customers_list:
        cust_orders = [o for o in orders_list if o.get('customer_id') == c['id']]
        cust_charges = [ch for ch in charges_list if ch.get('customer_id') == c['id']]
        plan = sum(parse_float(ch.get('plan_amount')) for ch in cust_charges)
        actual = sum(parse_float(ch.get('actual_amount')) for ch in cust_charges)
        by_customer.append({
            'id': c['id'],
            'customer_name': c.get('customer_name'),
            'total_orders': len(cust_orders),
            'total_order_amount': sum(parse_float(o.get('charge_amount')) for o in cust_orders),
            'monthly_fee': parse_float(c.get('monthly_fee')),
            'total_plan': plan,
            'total_actual': actual,
            'variance': actual - plan,
        })
    by_customer.sort(key=lambda x: x['total_order_amount'], reverse=True)
    max_order_amount = max((c['total_order_amount'] for c in by_customer), default=1) or 1

    quarters = {}
    for o in orders_list:
        q = get_quarter(o.get('order_date'))
        if not q:
            continue
        e = quarters.setdefault(q, {'id': q, 'period': q, 'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0})
        e['orders'] += 1
        e['amount'] += parse_float(o.get('charge_amount'))
    for c in charges_list:
        q = get_quarter(c.get('billing_month'))
        if not q:
            continue
        e = quarters.setdefault(q, {'id': q, 'period': q, 'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0})
        e['plan'] += parse_float(c.get('plan_amount'))
        e['actual'] += parse_float(c.get('actual_amount'))
    by_quarter = sorted(quarters.values(), key=lambda x: x['period'])

    years = {}
    for o in orders_list:
        y = get_year(o.get('order_date'))
        if not y:
            continue
        e = years.setdefault(y, {'id': y, 'period': y, 'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0, 'monthly': 0})
        e['orders'] += 1
        e['amount'] += parse_float(o.get('charge_amount'))
    for c in charges_list:
        y = get_year(c.get('billing_month'))
        if not y:
            continue
        e = years.setdefault(y, {'id': y, 'period': y, 'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0, 'monthly': 0})
        e['plan'] += parse_float(c.get('plan_amount'))
        e['actual'] += parse_float(c.get('actual_amount'))
    by_year = sorted(years.values(), key=lambda x: x['period'])

    by_status = []
    for val, label in ORDER_STATUSES:
        filtered = [o for o in orders_list if o.get('status') == val]
        by_status.append({
            'id': val, 'status': val, 'label': label,
            'count': len(filtered),
            'total_amount': sum(parse_float(o.get('charge_amount')) for o in filtered),
        })

    view = request.args.get('view', 'byCustomer')
    if view not in {'byCustomer', 'byQuarter', 'byYear', 'byStatus'}:
        view = 'byCustomer'

    return render_template('statistics.html', tabs=TABS, active='statistics',
                           total_customers=total_customers, active_customers=active_customers,
                           total_orders=total_orders, total_order_amount=total_order_amount,
                           construction_count=construction_count,
                           total_plan=total_plan, total_actual=total_actual,
                           by_customer=by_customer, max_order_amount=max_order_amount,
                           by_quarter=by_quarter, by_year=by_year, by_status=by_status,
                           view=view)


@app.route('/statistics/export')
def statistics_export():
    view = request.args.get('view', 'byCustomer')
    customers_list = db.select_all('customers')
    orders_list = db.select_all('orders')
    charges_list = db.select_all('fixed_charges')

    if view == 'byCustomer':
        headers = ['Клиент', 'Кол-во заказов', 'Сумма заказов', 'Абон. плата', 'План', 'Факт', 'Отклонение']
        data = []
        for c in customers_list:
            cust_orders = [o for o in orders_list if o.get('customer_id') == c['id']]
            cust_charges = [ch for ch in charges_list if ch.get('customer_id') == c['id']]
            plan = sum(parse_float(ch.get('plan_amount')) for ch in cust_charges)
            actual = sum(parse_float(ch.get('actual_amount')) for ch in cust_charges)
            data.append([c.get('customer_name'), len(cust_orders),
                         sum(parse_float(o.get('charge_amount')) for o in cust_orders),
                         parse_float(c.get('monthly_fee')), plan, actual, actual - plan])
    elif view in ('byQuarter', 'byYear'):
        fn = get_quarter if view == 'byQuarter' else get_year
        headers = ['Период', 'Заказов', 'Сумма заказов', 'План', 'Факт']
        data = _build_period(orders_list, charges_list, fn)
    else:
        headers = ['Статус', 'Кол-во', 'Сумма']
        data = [[label, len([o for o in orders_list if o.get('status') == val]),
                 sum(parse_float(o.get('charge_amount')) for o in orders_list if o.get('status') == val)]
                for val, label in ORDER_STATUSES]
    return Response(generate_csv(headers, data), mimetype='text/csv',
                    headers={'Content-Disposition': 'attachment; filename=statistics.csv'})


def _build_period(orders_list, charges_list, fn):
    periods = {}
    for o in orders_list:
        p = fn(o.get('order_date'))
        if not p:
            continue
        e = periods.setdefault(p, {'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0})
        e['orders'] += 1
        e['amount'] += parse_float(o.get('charge_amount'))
    for c in charges_list:
        p = fn(c.get('billing_month'))
        if not p:
            continue
        e = periods.setdefault(p, {'orders': 0, 'amount': 0, 'plan': 0, 'actual': 0})
        e['plan'] += parse_float(c.get('plan_amount'))
        e['actual'] += parse_float(c.get('actual_amount'))
    return [[p, periods[p]['orders'], periods[p]['amount'], periods[p]['plan'], periods[p]['actual']]
            for p in sorted(periods.keys())]


# ============================================================
# Справочники
# ============================================================
@app.route('/api/services/add', methods=['POST'])
def services_add():
    name = (request.get_json(force=True).get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400
    try:
        db.insert('services', {'name': name})
    except Exception:
        return jsonify({'error': 'Такая услуга уже существует'}), 400
    return jsonify({'ok': True, 'name': name})


@app.route('/api/actions/add', methods=['POST'])
def actions_add():
    name = (request.get_json(force=True).get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Название не может быть пустым'}), 400
    try:
        db.insert('actions', {'name': name})
    except Exception:
        return jsonify({'error': 'Такое действие уже существует'}), 400
    return jsonify({'ok': True, 'name': name})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
