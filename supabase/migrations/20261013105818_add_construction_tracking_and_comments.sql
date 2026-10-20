/*
# Add construction order fields, payment columns, and order comments

## Overview
Adds columns for construction order tracking (launch date, deadlines, payments),
adds one-time/monthly payment columns to fixed_charges, and creates an
order_comments table for a chat-style comment log per construction order.

## Modified Tables

### orders — new columns for construction tracking
- launch_date (date) — дата запуска услуги
- org_deadline (date) — срок организации
- control_date (date) — контрольная дата
- one_time_payment (numeric) — единоразовый платеж
- monthly_payment (numeric) — ежемесячный платеж

### fixed_charges — new payment columns
- one_time_payment (numeric) — единоразовый платеж
- monthly_payment (numeric) — ежемесячный платеж

## New Tables

### order_comments — chat-style comments for construction orders
- id (uuid, PK)
- order_id (uuid, FK → orders) — linked order
- author (text) — кто оставил комментарий
- message (text) — текст комментария
- status_note (text) — текущий статус (короткая метка)
- created_at (timestamptz)

## Security
- order_comments: single-tenant, RLS enabled, TO anon, authenticated.

## Notes
1. All new columns are nullable / default 0 so existing rows are unaffected.
2. order_comments references orders via FK with ON DELETE CASCADE.
*/

-- ============================================================
-- 1. Add columns to orders
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'launch_date') THEN
    ALTER TABLE orders ADD COLUMN launch_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'org_deadline') THEN
    ALTER TABLE orders ADD COLUMN org_deadline date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'control_date') THEN
    ALTER TABLE orders ADD COLUMN control_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'one_time_payment') THEN
    ALTER TABLE orders ADD COLUMN one_time_payment numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'monthly_payment') THEN
    ALTER TABLE orders ADD COLUMN monthly_payment numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 2. Add columns to fixed_charges
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_charges' AND column_name = 'one_time_payment') THEN
    ALTER TABLE fixed_charges ADD COLUMN one_time_payment numeric(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_charges' AND column_name = 'monthly_payment') THEN
    ALTER TABLE fixed_charges ADD COLUMN monthly_payment numeric(12,2) DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 3. Create order_comments table
-- ============================================================
CREATE TABLE IF NOT EXISTS order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Система',
  message text NOT NULL,
  status_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_comments" ON order_comments;
CREATE POLICY "anon_select_order_comments" ON order_comments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_comments" ON order_comments;
CREATE POLICY "anon_insert_order_comments" ON order_comments FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_comments" ON order_comments;
CREATE POLICY "anon_update_order_comments" ON order_comments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_comments" ON order_comments;
CREATE POLICY "anon_delete_order_comments" ON order_comments FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_order_comments_order_id ON order_comments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_created_at ON order_comments(created_at);

-- ============================================================
-- 4. Seed comments for existing construction orders
-- ============================================================
INSERT INTO order_comments (order_id, author, message, status_note)
SELECT o.id, 'Система', o.comments, 'Создан заказ'
FROM orders o
WHERE o.status = 'construction'
AND NOT EXISTS (
  SELECT 1 FROM order_comments oc WHERE oc.order_id = o.id
);
