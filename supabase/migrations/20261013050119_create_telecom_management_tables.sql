/*
# Telecom Operator Management — Relational Tables

## Overview
Creates three relational tables for managing telecom operator customer data,
CRM orders, and fixed-base charges with plan/actual tracking. A fourth
"Statistics" view is computed on the fly in the frontend from these tables.

## New Tables

### 1. customers — Telecom operator customers (Sheet 1)
- id (uuid, PK)
- customer_name (text) — full customer/company name
- customer_code (text, unique) — internal customer code
- contract_number (text) — contract reference
- address (text) — service address
- phone (text) — contact phone
- email (text) — contact email
- contract_date (date) — date contract was signed
- status (text) — active / suspended / terminated
- tariff_plan (text) — current tariff plan name
- monthly_fee (numeric) — recurring monthly fee
- created_at (timestamptz)

### 2. orders — CRM orders (Sheet 2)
- id (uuid, PK)
- order_number (text, unique) — order number from main CRM
- customer_id (uuid, FK → customers) — linked customer
- connection_point (text) — connection point address/node
- charge_amount (numeric) — amount of charges for this order
- status (text) — new / in_progress / construction / completed / cancelled
- comments (text) — free-text comments
- order_date (date) — date order was placed
- created_at (timestamptz)

### 3. fixed_charges — Fixed-base charges with plan/actual (Sheet 3)
- id (uuid, PK)
- customer_id (uuid, FK → customers) — linked customer
- order_id (uuid, FK → orders, nullable) — linked order (for construction-type orders)
- charge_type (text) — type of charge (e.g. installation, monthly, construction)
- plan_amount (numeric) — planned amount
- actual_amount (numeric) — actual amount (filled when status = actual)
- status (text) — plan / actual
- billing_month (date) — the month this charge applies to
- current_status (text) — free-text current work status
- created_at (timestamptz)

## Security
- Single-tenant app (no sign-in). RLS enabled on all tables.
- TO anon, authenticated with USING (true) / WITH CHECK (true) — data is intentionally shared.
- Four separate policies per table (SELECT, INSERT, UPDATE, DELETE).

## Notes
1. Statistics (Sheet 4) are computed in the frontend — no table needed.
2. Orders with status = 'construction' can be linked to fixed_charges via order_id.
3. All amount columns use numeric(12,2) for currency precision.
*/

-- ============================================================
-- 1. customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_code text UNIQUE,
  contract_number text,
  address text,
  phone text,
  email text,
  contract_date date,
  status text NOT NULL DEFAULT 'active',
  tariff_plan text,
  monthly_fee numeric(12,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 2. orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  connection_point text,
  charge_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  comments text,
  order_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- 3. fixed_charges
-- ============================================================
CREATE TABLE IF NOT EXISTS fixed_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  charge_type text NOT NULL DEFAULT 'monthly',
  plan_amount numeric(12,2) DEFAULT 0,
  actual_amount numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'plan',
  billing_month date,
  current_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE fixed_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_fixed_charges" ON fixed_charges;
CREATE POLICY "anon_select_fixed_charges" ON fixed_charges FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_fixed_charges" ON fixed_charges;
CREATE POLICY "anon_insert_fixed_charges" ON fixed_charges FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_fixed_charges" ON fixed_charges;
CREATE POLICY "anon_update_fixed_charges" ON fixed_charges FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_fixed_charges" ON fixed_charges;
CREATE POLICY "anon_delete_fixed_charges" ON fixed_charges FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_fixed_charges_customer_id ON fixed_charges(customer_id);
CREATE INDEX IF NOT EXISTS idx_fixed_charges_order_id ON fixed_charges(order_id);
CREATE INDEX IF NOT EXISTS idx_fixed_charges_billing_month ON fixed_charges(billing_month);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- ============================================================
-- Seed sample data
-- ============================================================
INSERT INTO customers (customer_name, customer_code, contract_number, address, phone, email, contract_date, status, tariff_plan, monthly_fee)
SELECT * FROM (VALUES
  ('ООО Рога и Копыта', 'C-001', 'CN-2024-001', 'г. Москва, ул. Тверская, д. 10', '+7 495 123-45-67', 'info@rogakopyta.ru', '2024-01-15'::date, 'active', 'Бизнес Стандарт', 15000.00),
  ('АО ТелекомСервис', 'C-002', 'CN-2024-002', 'г. Санкт-Петербург, Невский пр., д. 50', '+7 812 765-43-21', 'office@telecomservis.ru', '2024-02-20'::date, 'active', 'Корпоративный', 45000.00),
  ('ИП Иванов И.И.', 'C-003', 'CN-2024-003', 'г. Казань, ул. Баумана, д. 15', '+7 843 555-12-34', 'ivanov.ip@mail.ru', '2024-03-10'::date, 'active', 'Старт', 3000.00),
  ('ООО ДатаЦентр', 'C-004', 'CN-2024-004', 'г. Новосибирск, Красный пр., д. 100', '+7 383 333-44-55', 'admin@datacenter.ru', '2024-04-05'::date, 'suspended', 'Премиум', 80000.00),
  ('АО СвязьИнвест', 'C-005', 'CN-2024-005', 'г. Екатеринбург, ул. Ленина, д. 25', '+7 343 777-88-99', 'info@sizinvesvest.ru', '2024-05-12'::date, 'active', 'Корпоративный', 52000.00),
  ('ООО НетворкСолюшнс', 'C-006', 'CN-2024-006', 'г. Краснодар, ул. Красная, д. 40', '+7 861 222-33-44', 'contact@networksol.ru', '2024-06-18'::date, 'active', 'Бизнес Стандарт', 18000.00),
  ('ИП Петров П.П.', 'C-007', 'CN-2024-007', 'г. Самара, ул. Куйбышева, д. 70', '+7 846 444-55-66', 'petrov.pp@mail.ru', '2024-07-22'::date, 'terminated', 'Старт', 2500.00),
  ('ООО ФайберОпт', 'C-008', 'CN-2024-008', 'г. Нижний Новгород, ул. Большая Покровская, д. 8', '+7 831 666-77-88', 'sales@fiberopt.ru', '2024-08-30'::date, 'active', 'Премиум', 95000.00)
)
AS t(customer_name, customer_code, contract_number, address, phone, email, contract_date, status, tariff_plan, monthly_fee)
WHERE NOT EXISTS (SELECT 1 FROM customers);

-- Insert sample orders (referencing customers by code)
INSERT INTO orders (order_number, customer_id, connection_point, charge_amount, status, comments, order_date)
SELECT o.order_number, c.id, o.connection_point, o.charge_amount, o.status, o.comments, o.order_date
FROM (VALUES
  ('ORD-2024-0001', 'C-001', 'Узел связи №15, г. Москва', 25000.00, 'completed', 'Подключение завершено в срок', '2024-02-01'::date),
  ('ORD-2024-0002', 'C-002', 'ОП-3, Невский район', 120000.00, 'construction', 'Строительство ВОЛС, этап 1', '2024-03-15'::date),
  ('ORD-2024-0003', 'C-003', 'АТС-12, г. Казань', 5000.00, 'completed', 'Стандартное подключение', '2024-03-20'::date),
  ('ORD-2024-0004', 'C-004', 'ЦОД-1, Новосибирск', 350000.00, 'construction', 'Строительство ingress-канала', '2024-05-01'::date),
  ('ORD-2024-0005', 'C-005', 'Узел связи №8, Екатеринбург', 78000.00, 'in_progress', 'Ожидание оборудования', '2024-06-10'::date),
  ('ORD-2024-0006', 'C-006', 'ОП-5, Краснодар', 22000.00, 'completed', 'Подключено', '2024-07-05'::date),
  ('ORD-2024-0007', 'C-008', 'ЦОД-2, Нижний Новгород', 180000.00, 'construction', 'Строительство_last mile', '2024-09-01'::date),
  ('ORD-2024-0008', 'C-001', 'Узел связи №22, Москва', 45000.00, 'in_progress', 'Согласование трассы', '2024-09-15'::date),
  ('ORD-2024-0009', 'C-002', 'ОП-7, Петроградский район', 65000.00, 'new', 'Новая заявка', '2024-10-01'::date),
  ('ORD-2024-0010', 'C-005', 'Узел связи №3, Екатеринбург', 33000.00, 'completed', 'Выполнено досрочно', '2024-08-12'::date)
)
AS o(order_number, customer_code, connection_point, charge_amount, status, comments, order_date)
JOIN customers c ON c.customer_code = o.customer_code
WHERE NOT EXISTS (SELECT 1 FROM orders);

-- Insert sample fixed charges
INSERT INTO fixed_charges (customer_id, charge_type, plan_amount, actual_amount, status, billing_month, current_status)
SELECT c.id, fc.charge_type, fc.plan_amount, fc.actual_amount, fc.status, fc.billing_month, fc.current_status
FROM (VALUES
  ('C-001', 'monthly', 15000.00, 15000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-001', 'monthly', 15000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты'),
  ('C-002', 'monthly', 45000.00, 45000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-002', 'monthly', 45000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты'),
  ('C-003', 'monthly', 3000.00, 3000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-003', 'monthly', 3000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты'),
  ('C-005', 'monthly', 52000.00, 52000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-005', 'monthly', 52000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты'),
  ('C-006', 'monthly', 18000.00, 18000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-006', 'monthly', 18000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты'),
  ('C-008', 'monthly', 95000.00, 95000.00, 'actual', '2024-09-01'::date, 'Оплачено'),
  ('C-008', 'monthly', 95000.00, 0.00, 'plan', '2024-10-01'::date, 'Ожидает оплаты')
)
AS fc(customer_code, charge_type, plan_amount, actual_amount, status, billing_month, current_status)
JOIN customers c ON c.customer_code = fc.customer_code
WHERE NOT EXISTS (SELECT 1 FROM fixed_charges);

-- Link construction orders to fixed_charges
INSERT INTO fixed_charges (customer_id, order_id, charge_type, plan_amount, actual_amount, status, billing_month, current_status)
SELECT o.customer_id, o.id, 'construction', o.charge_amount, 0, 'plan', o.order_date, o.comments
FROM orders o
WHERE o.status = 'construction'
AND NOT EXISTS (
  SELECT 1 FROM fixed_charges fc WHERE fc.order_id = o.id
);
