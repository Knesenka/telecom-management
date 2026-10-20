import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DataGrid } from '@/components/DataGrid';
import { RecordModal, type FormField } from '@/components/RecordModal';
import { useToast } from '@/hooks/useToast';
import type { Customer, ColumnDef } from '@/types';
import { CUSTOMER_STATUS_LABELS } from '@/types';

const fields: FormField[] = [
  { key: 'customer_name', label: 'Наименование клиента', type: 'text', required: true },
  { key: 'customer_code', label: 'ИНН', type: 'text' },
  { key: 'contract_number', label: 'Номер договора', type: 'text' },
  { key: 'address', label: 'Адрес', type: 'text' },
  { key: 'phone', label: 'Телефон', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'contract_date', label: 'Дата договора', type: 'date' },
  { key: 'status', label: 'Статус', type: 'select', options: ['active', 'suspended', 'terminated'], default: 'active' },
  { key: 'tariff_plan', label: 'Тарифный план', type: 'select', options: ['Старт', 'Бизнес Стандарт', 'Корпоративный', 'Премиум'] },
  { key: 'monthly_fee', label: 'Абон. плата (₽)', type: 'number', default: 0 },
];

const columns: ColumnDef<Customer>[] = [
  { key: 'customer_name', label: 'Клиент', type: 'text', editable: true, defaultVisible: true, width: '200px' },
  { key: 'customer_code', label: 'ИНН', type: 'text', editable: true, defaultVisible: true },
  { key: 'contract_number', label: 'Договор', type: 'text', editable: true, defaultVisible: true },
  { key: 'address', label: 'Адрес', type: 'text', editable: true, defaultVisible: false },
  { key: 'phone', label: 'Телефон', type: 'text', editable: true, defaultVisible: true },
  { key: 'email', label: 'Email', type: 'text', editable: true, defaultVisible: false },
  { key: 'contract_date', label: 'Дата договора', type: 'date', editable: true, defaultVisible: true },
  { key: 'status', label: 'Статус', type: 'badge', options: ['active', 'suspended', 'terminated'], editable: true, defaultVisible: true, render: (row) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${row.status === 'active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : row.status === 'suspended' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{CUSTOMER_STATUS_LABELS[row.status] || row.status}</span> },
  { key: 'tariff_plan', label: 'Тариф', type: 'text', editable: true, defaultVisible: true },
  { key: 'monthly_fee', label: 'Абон. плата', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
  { key: 'annual_fee', label: 'Годовая плата (fx)', type: 'currency', formula: true, defaultVisible: true, align: 'right' },
];

export function CustomersSheet() {
  const { show } = useToast();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) {
      show('Ошибка загрузки клиентов: ' + error.message, 'error');
    } else {
      setRows(data as Customer[]);
    }
    setLoading(false);
  }, [show]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const extendedRows = rows.map((r) => ({ ...r, annual_fee: Number(r.monthly_fee) * 12 }));

  const handleAdd = async (data: Record<string, unknown>) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === '' || value === undefined || value === null) {
        cleaned[key] = null;
      } else {
        cleaned[key] = value;
      }
    }
    const { error } = await supabase.from('customers').insert(cleaned);
    if (error) {
      show('Ошибка добавления: ' + error.message, 'error');
    } else {
      show('Клиент добавлен', 'success');
      setModalOpen(false);
      fetchData();
    }
  };

  const handleEdit = async (row: Customer, column: string, value: string | number) => {
    const { error } = await supabase.from('customers').update({ [column]: value }).eq('id', row.id);
    if (error) {
      show('Ошибка обновления: ' + error.message, 'error');
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [column]: value } : r)));
    }
  };

  const handleDelete = async (row: Customer) => {
    if (!confirm(`Удалить клиента "${row.customer_name}"?`)) return;
    const { error } = await supabase.from('customers').delete().eq('id', row.id);
    if (error) {
      show('Ошибка удаления: ' + error.message, 'error');
    } else {
      show('Клиент удалён', 'success');
      fetchData();
    }
  };

  return (
    <>
      <DataGrid
        columns={columns}
        rows={extendedRows}
        loading={loading}
        searchPlaceholder="Поиск клиентов..."
        searchKeys={['customer_name', 'customer_code', 'contract_number', 'address']}
        onAdd={() => setModalOpen(true)}
        addLabel="Добавить клиента"
        onEdit={handleEdit}
        onDelete={handleDelete}
        exportFilename="customers.csv"
      />
      <RecordModal
        open={modalOpen}
        title="Новый клиент"
        fields={fields}
        onSubmit={handleAdd}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
