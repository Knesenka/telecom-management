import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DataGrid } from '@/components/DataGrid';
import { useToast } from '@/hooks/useToast';
import type { FixedCharge, Customer, Order, ColumnDef } from '@/types';

interface ChargeRow extends Omit<FixedCharge, 'plan_amount' | 'actual_amount'> {
  customer_name: string;
  order_number: string;
  plan_amount?: number;
  actual_amount?: number;
  order_status?: string;
  isAuto?: boolean;
}

const columns: ColumnDef<ChargeRow>[] = [
  { key: 'customer_name', label: 'Клиент', type: 'link', defaultVisible: true, width: '180px' },
  { key: 'order_number', label: '№ заказа', type: 'text', defaultVisible: true, width: '140px' },
  { key: 'charge_type', label: 'Тип', type: 'text', editable: true, defaultVisible: true, render: (row) => row.charge_type === 'monthly' ? 'Ежемесячный' : row.charge_type === 'installation' ? 'Подключение' : row.charge_type === 'construction' ? 'Строительство' : row.charge_type === 'one-time' ? 'Разовый' : row.charge_type },
  { key: 'one_time_payment', label: 'Единоразовый платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
  { key: 'monthly_payment', label: 'Ежемесячный платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
  { key: 'status', label: 'Статус', type: 'badge', options: ['plan', 'actual'], editable: true, defaultVisible: true, render: (row) => row.isAuto ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-emerald-100 text-emerald-700 border-emerald-200">Факт</span> : <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${row.status === 'actual' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-sky-100 text-sky-700 border-sky-200'}`}>{row.status === 'actual' ? 'Факт' : 'План'}</span> },
  { key: 'billing_month', label: 'Месяц', type: 'date', editable: true, defaultVisible: true },
  { key: 'current_status', label: 'Текущий статус', type: 'text', editable: true, defaultVisible: true, width: '250px' },
];

export function FixedChargesSheet() {
  const { show } = useToast();
  const [rows, setRows] = useState<ChargeRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [
      { data: chargeData, error: chargeError },
      { data: custData, error: custError },
      { data: orderData, error: orderError },
    ] = await Promise.all([
      supabase
        .from('fixed_charges')
        .select('*, customers(customer_name, customer_code), orders(order_number)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('customer_name'),
      supabase.from('orders').select('*, customers(customer_name)').eq('status', 'in_service').order('created_at', { ascending: false }),
    ]);
    if (chargeError) show('Ошибка загрузки начислений: ' + chargeError.message, 'error');
    if (custError) show('Ошибка загрузки клиентов: ' + custError.message, 'error');
    if (orderError) show('Ошибка загрузки заказов: ' + orderError.message, 'error');
    if (custData) setCustomers(custData as Customer[]);
    const chargeRows: ChargeRow[] = chargeData
      ? (chargeData as FixedCharge[]).map((c) => ({
          ...c,
          customer_name: c.customers?.customer_name ?? '—',
          order_number: c.orders?.order_number ?? '',
        }))
      : [];
    const autoRows: ChargeRow[] = orderData
      ? (orderData as Order[]).map((o) => ({
          id: `auto-${o.id}`,
          customer_id: o.customer_id,
          order_id: o.id,
          charge_type: 'monthly',
          one_time_payment: Number(o.one_time_payment) || 0,
          monthly_payment: Number(o.monthly_payment) || 0,
          status: 'actual',
          billing_month: null,
          current_status: null,
          created_at: o.created_at,
          customer_name: o.customers?.customer_name ?? '—',
          order_number: o.order_number,
          order_status: o.status,
          isAuto: true,
        }))
      : [];
    setRows([...chargeRows, ...autoRows]);
    setLoading(false);
  }, [show]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAdd = async (data: Record<string, unknown>) => {
    const { error } = await supabase.from('fixed_charges').insert({
      customer_id: data.customer_id || null,
      charge_type: data.charge_type || 'monthly',
      one_time_payment: Number(data.one_time_payment) || 0,
      monthly_payment: Number(data.monthly_payment) || 0,
      status: data.status || 'plan',
      billing_month: data.billing_month || null,
      current_status: data.current_status || null,
    });
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      show('Начисление добавлено', 'success');
      setModalOpen(false);
      fetchData();
    }
  };

  const handleEdit = async (row: ChargeRow, column: string, value: string | number) => {
    if (column === 'customer_name' || column === 'order_number' || row.isAuto) return;
    const updateValue = value === '' ? null : value;
    const updates: Record<string, unknown> = { [column]: updateValue };
    const { error } = await supabase.from('fixed_charges').update(updates).eq('id', row.id);
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      fetchData();
    }
  };

  const handleDelete = async (row: ChargeRow) => {
    if (row.isAuto) return;
    if (!confirm('Удалить начисление?')) return;
    const { error } = await supabase.from('fixed_charges').delete().eq('id', row.id);
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      show('Начисление удалено', 'success');
      fetchData();
    }
  };

  const oneTimeTotal = rows.reduce((s, r) => s + Number(r.one_time_payment), 0);
  const monthlyTotal = rows.reduce((s, r) => s + Number(r.monthly_payment), 0);
  const constructionCount = rows.filter((r) => r.charge_type === 'construction').length;

  return (
    <>
      <div className="flex gap-3 px-4 pt-3 bg-white">
        <div className="flex-1 bg-sky-50 border border-sky-100 rounded-lg px-4 py-2.5">
          <div className="text-xs text-sky-600 font-medium uppercase tracking-wide">Единоразовые платежи</div>
          <div className="text-lg font-bold text-sky-900">
            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(oneTimeTotal)}
          </div>
        </div>
        <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
          <div className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Ежемесячные платежи</div>
          <div className="text-lg font-bold text-emerald-900">
            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(monthlyTotal)}
          </div>
        </div>
        <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5">
          <div className="text-xs text-orange-600 font-medium uppercase tracking-wide">Строительство</div>
          <div className="text-lg font-bold text-orange-900">{constructionCount} заказов</div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          columns={columns}
          rows={rows}
          loading={loading}
          searchPlaceholder="Поиск начислений..."
          searchKeys={['customer_name', 'order_number', 'current_status']}
          onAdd={() => setModalOpen(true)}
          addLabel="Добавить начисление"
          onEdit={handleEdit}
          onDelete={handleDelete}
          exportFilename="fixed_charges.csv"
        />
      </div>
      <ChargeModal
        open={modalOpen}
        customers={customers}
        onSubmit={handleAdd}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

function ChargeModal({
  open,
  customers,
  onSubmit,
  onClose,
}: {
  open: boolean;
  customers: Customer[];
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<Record<string, unknown>>(() => ({
    customer_id: '',
    charge_type: 'monthly',
    one_time_payment: 0,
    monthly_payment: 0,
    status: 'plan',
    billing_month: '',
    current_status: '',
  }));

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Новое начисление</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <XIcon />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Клиент<span className="text-red-500 ml-0.5">*</span></label>
            <select
              value={String(data.customer_id ?? '')}
              onChange={(e) => setData({ ...data, customer_id: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
              required
            >
              <option value="">— Выбрать —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.customer_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Тип начисления</label>
            <select
              value={String(data.charge_type)}
              onChange={(e) => setData({ ...data, charge_type: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
            >
              <option value="monthly">Ежемесячный</option>
              <option value="installation">Подключение</option>
              <option value="construction">Строительство</option>
              <option value="one-time">Разовый</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Единоразовый платеж (₽)</label>
              <input type="number" step="0.01" value={String(data.one_time_payment ?? 0)}
                onChange={(e) => setData({ ...data, one_time_payment: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Ежемесячный платеж (₽)</label>
              <input type="number" step="0.01" value={String(data.monthly_payment ?? 0)}
                onChange={(e) => setData({ ...data, monthly_payment: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Статус</label>
            <select value={String(data.status)}
              onChange={(e) => setData({ ...data, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition">
              <option value="plan">План</option>
              <option value="actual">Факт</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Месяц начисления</label>
            <input type="date" value={String(data.billing_month ?? '')}
              onChange={(e) => setData({ ...data, billing_month: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Текущий статус работ</label>
            <input type="text" value={String(data.current_status ?? '')}
              onChange={(e) => setData({ ...data, current_status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              Отмена
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
