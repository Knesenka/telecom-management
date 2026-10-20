"""Конфигурация приложения — чтение переменных из .env."""

import os


def _load_env_file():
    """Читает .env из корня проекта и дополняет os.environ."""
    candidates = [
        os.path.join(os.path.dirname(__file__), '..', '.env'),
        os.path.join(os.path.dirname(__file__), '.env'),
    ]
    for env_path in candidates:
        if not os.path.exists(env_path):
            continue
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
        break


_load_env_file()

# Supabase REST API
SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL') or ''
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('VITE_SUPABASE_ANON_KEY') or ''

SECRET_KEY = os.environ.get('SECRET_KEY', 'telecom-management-secret-2024')
