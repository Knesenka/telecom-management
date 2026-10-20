import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DataGrid } from '@/components/DataGrid';
import { useToast } from '@/hooks/useToast';
import type { Order, Customer, ColumnDef, ServiceOption, ActionOption } from '@/types';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';

const ADD_NEW_VALUE = '__add_new__';
const todayStr = new Date().toISOString().split('T')[0];

interface OrderRow extends Order {
  customer_name: string;
  annual_charge: number;
}

export function OrdersSheet() {
  const { show } = useToast();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const [newService, setNewService] = useState('');
  const [showAddService, setShowAddService] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [showAddAction, setShowAddAction] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [orderRes, custRes, servRes, actRes] = await Promise.all([
      supabase.from('orders').select('*, customers(customer_name, customer_code)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('customer_name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('actions').select('*').order('name'),
    ]);
    if (orderRes.error) show('Ошибка загрузки заказов: ' + orderRes.error.message, 'error');
    if (custRes.data) setCustomers(custRes.data as Customer[]);
    if (servRes.data) setServices(servRes.data as ServiceOption[]);
    if (actRes.data) setActions(actRes.data as ActionOption[]);
    if (orderRes.data) {
      setRows(
        (orderRes.data as Order[]).map((o) => ({
          ...o,
          customer_name: o.customers?.customer_name ?? '—',
          annual_charge: Number(o.one_time_payment) + Number(o.monthly_payment) * 12,
        }))
      );
    }
    setLoading(false);
  }, [show]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const serviceNames = services.map((s) => s.name);
  const actionNames = actions.map((a) => a.name);

  const columns: ColumnDef<OrderRow>[] = [
    { key: 'order_number', label: '№ заказа', type: 'text', editable: true, defaultVisible: true, width: '140px' },
    { key: 'customer_name', label: 'Клиент', type: 'link', defaultVisible: true, width: '180px' },
    { key: 'connection_point', label: 'Точка А', type: 'text', editable: true, defaultVisible: true, width: '200px' },
    { key: 'endpoint_b', label: 'Точка Б', type: 'text', editable: true, defaultVisible: true, width: '200px' },
    { key: 'service_type', label: 'Услуга', type: 'select', options: [...serviceNames, ADD_NEW_VALUE], editable: true, defaultVisible: true, width: '160px' },
    { key: 'action_type', label: 'Действие', type: 'select', options: [...actionNames, ADD_NEW_VALUE], editable: true, defaultVisible: true, width: '180px' },
    { key: 'one_time_payment', label: 'Единоразовый платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
    { key: 'monthly_payment', label: 'Ежемесячный платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
    { key: 'status', label: 'Статус', type: 'badge', options: ORDER_STATUSES.map((s) => s.value), editable: true, defaultVisible: true, render: (row) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${ORDER_STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{ORDER_STATUS_LABELS[row.status] || row.status}</span> },
    { key: 'comments', label: 'Комментарии', type: 'text', editable: true, defaultVisible: true, width: '250px' },
    { key: 'order_date', label: 'Дата заказа', type: 'date', editable: true, defaultVisible: true },
    { key: 'annual_charge', label: 'Годовые начисления (fx)', type: 'currency', formula: true, defaultVisible: false, align: 'right', render: (row) => <span className="font-medium text-blue-900">{new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(Number(row.one_time_payment) + Number(row.monthly_payment) * 12)}</span> },
  ];

  const openModal = () => {
    setFormData({
      order_number: '',
      customer_id: '',
      connection_point: '',
      endpoint_b: '',
      service_type: 'IP транзит',
      action_type: 'Подключение',
      one_time_payment: 0,
      monthly_payment: 0,
      status: 'tech_check',
      comments: '',
      order_date: '',
    });
    setNewService('');
    setShowAddService(false);
    setNewAction('');
    setShowAddAction(false);
    setModalOpen(true);
  };

  const addServiceToDb = async (name: string): Promise<boolean> => {
    const { error } = await supabase.from('services').insert({ name });
    if (error) {
      show('Ошибка: ' + error.message, 'error');
      return false;
    }
    const { data } = await supabase.from('services').select('*').order('name');
    if (data) setServices(data as ServiceOption[]);
    show('Услуга добавлена', 'success');
    return true;
  };

  const addActionToDb = async (name: string): Promise<boolean> => {
    const { error } = await supabase.from('actions').insert({ name });
    if (error) {
      show('Ошибка: ' + error.message, 'error');
      return false;
    }
    const { data } = await supabase.from('actions').select('*').order('name');
    if (data) setActions(data as ActionOption[]);
    show('Действие добавлено', 'success');
    return true;
  };

  const handleModalServiceChange = (value: string) => {
    if (value === ADD_NEW_VALUE) {
      setShowAddService(true);
      setNewService('');
    } else {
      setFormData({ ...formData, service_type: value });
    }
  };

  const handleModalActionChange = (value: string) => {
    if (value === ADD_NEW_VALUE) {
      setShowAddAction(true);
      setNewAction('');
    } else {
      setFormData({ ...formData, action_type: value });
    }
  };

  const confirmAddService = async () => {
    if (!newService.trim()) return;
    const ok = await addServiceToDb(newService.trim());
    if (ok) {
      setFormData({ ...formData, service_type: newService.trim() });
      setNewService('');
      setShowAddService(false);
    }
  };

  const confirmAddAction = async () => {
    if (!newAction.trim()) return;
    const ok = await addActionToDb(newAction.trim());
    if (ok) {
      setFormData({ ...formData, action_type: newAction.trim() });
      setNewAction('');
      setShowAddAction(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.order_date && String(formData.order_date) > todayStr) {
      show('Дата заказа не может быть позже сегодняшнего дня', 'error');
      return;
    }
    const { data: inserted, error } = await supabase.from('orders').insert({
      order_number: formData.order_number || null,
      customer_id: formData.customer_id || null,
      connection_point: formData.connection_point || null,
      endpoint_b: formData.endpoint_b || null,
      service_type: formData.service_type || null,
      action_type: formData.action_type || null,
      one_time_payment: Number(formData.one_time_payment) || 0,
      monthly_payment: Number(formData.monthly_payment) || 0,
      charge_amount: Number(formData.monthly_payment) || 0,
      status: formData.status || 'tech_check',
      comments: formData.comments || null,
      order_date: formData.order_date || null,
    }).select().single();
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      if (inserted.status === 'org_in_progress' && formData.comments) {
        await supabase.from('order_comments').insert({
          order_id: inserted.id,
          author: 'Система',
          message: String(formData.comments),
          status_note: 'Создан заказ',
        });
      }
      show('Заказ добавлен', 'success');
      setModalOpen(false);
      fetchData();
    }
  };

  const handleEdit = async (row: OrderRow, column: string, value: string | number) => {
    if (column === 'customer_name') return;
    if (value === ADD_NEW_VALUE) {
      if (column === 'service_type') {
        const name = prompt('Введите название новой услуги:');
        if (name && name.trim()) {
          const ok = await addServiceToDb(name.trim());
          if (ok) {
            await supabase.from('orders').update({ service_type: name.trim() }).eq('id', row.id);
            fetchData();
          }
        }
      } else if (column === 'action_type') {
        const name = prompt('Введите название нового действия:');
        if (name && name.trim()) {
          const ok = await addActionToDb(name.trim());
          if (ok) {
            await supabase.from('orders').update({ action_type: name.trim() }).eq('id', row.id);
            fetchData();
          }
        }
      }
      return;
    }
    const updateValue = value === '' ? null : value;
    if ((column === 'order_date') && updateValue && String(updateValue) > todayStr) {
      show('Дата не может быть позже сегодняшнего дня', 'error');
      return;
    }
    const { error } = await supabase.from('orders').update({ [column]: updateValue }).eq('id', row.id);
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      if (column === 'status' && value === 'org_in_progress') {
        await supabase.from('order_comments').insert({
          order_id: row.id,
          author: 'Система',
          message: 'Заказ переведён в стадию "Выполняется организация услуг"',
          status_note: 'Организация услуг',
        });
      }
      fetchData();
    }
  };

  const handleDelete = async (row: OrderRow) => {
    if (!confirm(`Удалить заказ "${row.order_number}"?`)) return;
    const { error } = await supabase.from('orders').delete().eq('id', row.id);
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      show('Заказ удалён', 'success');
      fetchData();
    }
  };

  const statusOptions = ORDER_STATUSES;

  const selectLabel = (opt: string, addLabel: string): string => {
    if (opt === ADD_NEW_VALUE) return addLabel;
    return ORDER_STATUS_LABELS[opt] || opt;
  };

  return (
    <>
      <DataGrid
        columns={columns}
        rows={rows}
        loading={loading}
        searchPlaceholder="Поиск заказов..."
        searchKeys={['order_number', 'connection_point', 'endpoint_b', 'comments']}
        onAdd={openModal}
        addLabel="Добавить заказ"
        onEdit={handleEdit}
        onDelete={handleDelete}
        exportFilename="orders.csv"
      />
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Новый заказ</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Номер заказа (CRM)<span className="text-red-500 ml-0.5">*</span></label>
                <input type="text" required value={String(formData.order_number ?? '')}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Клиент</label>
                <select value={String(formData.customer_id ?? '')}
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition">
                  <option value="">— Выбрать —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customer_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Точка А</label>
                  <input type="text" value={String(formData.connection_point ?? '')}
                    onChange={(e) => setFormData({ ...formData, connection_point: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Точка Б</label>
                  <input type="text" value={String(formData.endpoint_b ?? '')}
                    onChange={(e) => setFormData({ ...formData, endpoint_b: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Услуга</label>
                  {!showAddService ? (
                    <select value={String(formData.service_type ?? 'IP транзит')}
                      onChange={(e) => handleModalServiceChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition">
                      {serviceNames.map((s) => <option key={s} value={s}>{s}</option>)}
                      <option value={ADD_NEW_VALUE}>— Добавить услугу —</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" autoFocus value={newService}
                        onChange={(e) => setNewService(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddService(); } }}
                        placeholder="Название услуги"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                      <button type="button" onClick={confirmAddService}
                        className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                        OK
                      </button>
                      <button type="button" onClick={() => { setShowAddService(false); setNewService(''); }}
                        className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Действие</label>
                  {!showAddAction ? (
                    <select value={String(formData.action_type ?? 'Подключение')}
                      onChange={(e) => handleModalActionChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition">
                      {actionNames.map((a) => <option key={a} value={a}>{a}</option>)}
                      <option value={ADD_NEW_VALUE}>— Добавить действие —</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input type="text" autoFocus value={newAction}
                        onChange={(e) => setNewAction(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmAddAction(); } }}
                        placeholder="Название действия"
                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                      <button type="button" onClick={confirmAddAction}
                        className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                        OK
                      </button>
                      <button type="button" onClick={() => { setShowAddAction(false); setNewAction(''); }}
                        className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                        Отмена
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Единоразовый платеж (₽)</label>
                  <input type="number" step="0.01" value={String(formData.one_time_payment ?? 0)}
                    onChange={(e) => setFormData({ ...formData, one_time_payment: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Ежемесячный платеж (₽)</label>
                  <input type="number" step="0.01" value={String(formData.monthly_payment ?? 0)}
                    onChange={(e) => setFormData({ ...formData, monthly_payment: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Статус</label>
                  <select value={String(formData.status ?? 'tech_check')}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition">
                    {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Дата заказа</label>
                <input type="date" max={todayStr} value={String(formData.order_date ?? '')}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Комментарии</label>
                <textarea rows={3} value={String(formData.comments ?? '')}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  Отмена
                </button>
                <button type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
