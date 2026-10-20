-- Migrate old order statuses to new Russian status values
UPDATE orders SET status = 'tech_check' WHERE status = 'new';
UPDATE orders SET status = 'tech_positive' WHERE status = 'in_progress';
UPDATE orders SET status = 'org_in_progress' WHERE status = 'construction';
UPDATE orders SET status = 'in_service' WHERE status = 'completed';
UPDATE orders SET status = 'client_refusal' WHERE status = 'cancelled';

-- Also update any existing order_comments status_note references
UPDATE order_comments SET status_note = 'Организация услуг' WHERE status_note = 'Стройка';
