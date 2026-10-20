-- Add new columns to orders table
ALTER TABLE orders ADD COLUMN endpoint_b text;
ALTER TABLE orders ADD COLUMN service_type text DEFAULT 'IP транзит';
ALTER TABLE orders ADD COLUMN action_type text DEFAULT 'Подключение';

-- Create lookup tables for services and actions
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default services
INSERT INTO services (name) VALUES
  ('IP транзит'),
  ('L2 VPN')
ON CONFLICT (name) DO NOTHING;

-- Insert default actions
INSERT INTO actions (name) VALUES
  ('Подключение'),
  ('Изменение конфигурации'),
  ('Отключение'),
  ('Изменение тарифного плана')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS on lookup tables
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_services" ON services FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_services" ON services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "select_actions" ON actions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_actions" ON actions FOR INSERT TO authenticated WITH CHECK (true);
