"""Константы и справочники для приложения."""

ORDER_STATUSES = [
    ('tech_check', 'Определение технической возможности'),
    ('tech_positive', 'Результат проработки положительный'),
    ('org_in_progress', 'Выполняется организация услуг'),
    ('in_service', 'Услуга эксплуатируется'),
    ('acceptance', 'Приемка'),
    ('tech_impossible', 'Нет технической возможности'),
    ('client_refusal', 'Отказ клиента'),
]

ORDER_STATUS_LABELS = dict(ORDER_STATUSES)

ORDER_STATUS_COLORS = {
    'tech_check': ('bg-yellow-100', 'text-yellow-800', 'border-yellow-200'),
    'tech_positive': ('bg-sky-100', 'text-sky-700', 'border-sky-200'),
    'org_in_progress': ('bg-orange-100', 'text-orange-700', 'border-orange-200'),
    'in_service': ('bg-emerald-100', 'text-emerald-700', 'border-emerald-200'),
    'acceptance': ('bg-lime-100', 'text-lime-700', 'border-lime-200'),
    'tech_impossible': ('bg-red-100', 'text-red-700', 'border-red-200'),
    'client_refusal': ('bg-pink-100', 'text-pink-700', 'border-pink-200'),
}

CUSTOMER_STATUS_LABELS = {
    'active': 'Активен',
    'suspended': 'Приостановлен',
    'terminated': 'Расторгнут',
}

CUSTOMER_STATUS_COLORS = {
    'active': ('bg-emerald-100', 'text-emerald-700', 'border-emerald-200'),
    'suspended': ('bg-amber-100', 'text-amber-700', 'border-amber-200'),
    'terminated': ('bg-red-100', 'text-red-700', 'border-red-200'),
}

CHARGE_STATUS_LABELS = {
    'plan': 'План',
    'actual': 'Факт',
}

CHARGE_TYPE_LABELS = {
    'monthly': 'Ежемесячный',
    'installation': 'Подключение',
    'construction': 'Строительство',
    'one-time': 'Разовый',
}

TARIFF_PLANS = ['Старт', 'Бизнес Стандарт', 'Корпоративный', 'Премиум']

DEFAULT_SERVICES = ['IP транзит', 'L2 VPN']
DEFAULT_ACTIONS = ['Подключение', 'Изменение конфигурации', 'Отключение', 'Изменение тарифного плана']


def status_badge_classes(status, color_map):
    bg, text, border = color_map.get(status, ('bg-slate-100', 'text-slate-600', 'border-slate-200'))
    return f'{bg} {text} {border}'
