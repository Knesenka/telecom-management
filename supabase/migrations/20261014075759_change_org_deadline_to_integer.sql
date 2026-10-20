-- Change org_deadline from date to integer (number of days)
-- First drop the column if it exists, then re-add as integer
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'org_deadline') THEN
    ALTER TABLE orders DROP COLUMN org_deadline;
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN org_deadline integer;

-- Update the types definition
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'org_deadline'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE orders ALTER COLUMN org_deadline TYPE integer USING NULL;
  END IF;
END $$;
