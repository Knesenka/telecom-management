import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, Building2, Users, DollarSign, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DataGrid } from '@/components/DataGrid';
import { downloadCSV, toCSV } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import type { Customer, Order, FixedCharge, ColumnDef } from '@/types';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_BG_COLORS } from '@/types';

interface StatRow {
  id: string;
  customer_name: string;
  total_orders: number;
  total_order_amount: number;
  total_plan: number;
  total_actual: number;
  monthly_fee: number;
  variance: number;
}

const customerColumns: ColumnDef<StatRow>[] = [
  { key: 'customer_name', label: 'Клиент', type: 'text', defaultVisible: true, width: '200px' },
  { key: 'total_orders', label: 'Кол-во заказов', type: 'number', defaultVisible: true, align: 'right' },
  { key: 'total_order_amount', label: 'Сумма заказов', type: 'currency', defaultVisible: true, align: 'right' },
  { key: 'monthly_fee', label: 'Абон. плата', type: 'currency', defaultVisible: true, align: 'right' },
  { key: 'total_plan', label: 'План (фикс.)', type: 'currency', defaultVisible: true, align: 'right' },
  { key: 'total_actual', label: 'Факт (фикс.)', type: 'currency', defaultVisible: true, align: 'right' },
  { key: 'variance', label: 'Отклонение (fx)', type: 'currency', formula: true, defaultVisible: true, align: 'right' },
];

type ViewMode = 'byCustomer' | 'byQuarter' | 'byYear' | 'byStatus';

export function StatisticsSheet() {
  const { show } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [charges, setCharges] = useState<FixedCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('byCustomer');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [custRes, orderRes, chargeRes] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('fixed_charges').select('*'),
    ]);
    if (custRes.data) setCustomers(custRes.data as Customer[]);
    if (orderRes.data) setOrders(orderRes.data as Order[]);
    if (chargeRes.data) setCharges(chargeRes.data as FixedCharge[]);
    if (custRes.error || orderRes.error || chargeRes.error) {
      show('Ошибка загрузки данных для статистики', 'error');
    }
    setLoading(false);
  }, [show]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(n);

  // Summary cards
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === 'active').length;
  const totalOrders = orders.length;
  const totalOrderAmount = orders.reduce((s, o) => s + Number(o.charge_amount), 0);
  const constructionOrders = orders.filter((o) => o.status === 'org_in_progress');
  const totalPlan = charges.reduce((s, c) => s + Number(c.plan_amount), 0);
  const totalActual = charges.reduce((s, c) => s + Number(c.actual_amount), 0);
  const totalMonthlyFees = customers.reduce((s, c) => s + Number(c.monthly_fee), 0);

  // By customer data
  const byCustomer: StatRow[] = useMemo(() => {
    return customers.map((c) => {
      const custOrders = orders.filter((o) => o.customer_id === c.id);
      const custCharges = charges.filter((ch) => ch.customer_id === c.id);
      const totalPlan = custCharges.reduce((s, ch) => s + Number(ch.plan_amount), 0);
      const totalActual = custCharges.reduce((s, ch) => s + Number(ch.actual_amount), 0);
      return {
        id: c.id,
        customer_name: c.customer_name,
        total_orders: custOrders.length,
        total_order_amount: custOrders.reduce((s, o) => s + Number(o.charge_amount), 0),
        total_plan: totalPlan,
        total_actual: totalActual,
        monthly_fee: Number(c.monthly_fee),
        variance: totalActual - totalPlan,
      };
    }).sort((a, b) => b.total_order_amount - a.total_order_amount);
  }, [customers, orders, charges]);

  // By quarter data
  const byQuarter = useMemo(() => {
    const quarters = new Map<string, { id: string; period: string; orders: number; amount: number; plan: number; actual: number }>();
    for (const o of orders) {
      if (!o.order_date) continue;
      const d = new Date(o.order_date);
      const q = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      const existing = quarters.get(q) ?? { id: q, period: q, orders: 0, amount: 0, plan: 0, actual: 0 };
      existing.orders += 1;
      existing.amount += Number(o.charge_amount);
      quarters.set(q, existing);
    }
    for (const c of charges) {
      if (!c.billing_month) continue;
      const d = new Date(c.billing_month);
      const q = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      const existing = quarters.get(q) ?? { id: q, period: q, orders: 0, amount: 0, plan: 0, actual: 0 };
      existing.plan += Number(c.plan_amount);
      existing.actual += Number(c.actual_amount);
      quarters.set(q, existing);
    }
    return Array.from(quarters.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [orders, charges]);

  // By year data
  const byYear = useMemo(() => {
    const years = new Map<string, { id: string; period: string; orders: number; amount: number; plan: number; actual: number; monthly: number }>();
    for (const o of orders) {
      if (!o.order_date) continue;
      const y = String(new Date(o.order_date).getFullYear());
      const existing = years.get(y) ?? { id: y, period: y, orders: 0, amount: 0, plan: 0, actual: 0, monthly: 0 };
      existing.orders += 1;
      existing.amount += Number(o.charge_amount);
      years.set(y, existing);
    }
    for (const c of charges) {
      if (!c.billing_month) continue;
      const y = String(new Date(c.billing_month).getFullYear());
      const existing = years.get(y) ?? { id: y, period: y, orders: 0, amount: 0, plan: 0, actual: 0, monthly: 0 };
      existing.plan += Number(c.plan_amount);
      existing.actual += Number(c.actual_amount);
      years.set(y, existing);
    }
    return Array.from(years.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [orders, charges]);

  // By order status
  const byStatus = useMemo(() => {
    return ORDER_STATUSES.map((s) => {
      const filtered = orders.filter((o) => o.status === s.value);
      return {
        id: s.value,
        status: s.value,
        count: filtered.length,
        total_amount: filtered.reduce((sum, o) => sum + Number(o.charge_amount), 0),
      };
    });
  }, [orders]);

  const maxOrderAmount = Math.max(...byCustomer.map((c) => c.total_order_amount), 1);
  const maxQuarterAmount = Math.max(...byQuarter.map((q) => q.amount), 1);

  const handleExport = () => {
    let headers: string[] = [];
    let data: (string | number)[][] = [];
    if (view === 'byCustomer') {
      headers = ['Клиент', 'Кол-во заказов', 'Сумма заказов', 'Абон. плата', 'План', 'Факт', 'Отклонение'];
      data = byCustomer.map((r) => [r.customer_name, r.total_orders, r.total_order_amount, r.monthly_fee, r.total_plan, r.total_actual, r.variance]);
    } else if (view === 'byQuarter') {
      headers = ['Квартал', 'Заказов', 'Сумма заказов', 'План', 'Факт'];
      data = byQuarter.map((r) => [r.period, r.orders, r.amount, r.plan, r.actual]);
    } else if (view === 'byYear') {
      headers = ['Год', 'Заказов', 'Сумма заказов', 'План', 'Факт'];
      data = byYear.map((r) => [r.period, r.orders, r.amount, r.plan, r.actual]);
    } else {
      headers = ['Статус', 'Кол-во', 'Сумма'];
      data = byStatus.map((r) => [ORDER_STATUS_LABELS[r.status] || r.status, r.count, r.total_amount]);
    }
    downloadCSV('statistics.csv', toCSV(headers, data));
  };

  const summaryCards = [
    { label: 'Клиентов', value: String(totalCustomers), sub: `${activeCustomers} активных`, icon: Users, color: 'blue' },
    { label: 'Заказов', value: String(totalOrders), sub: `${constructionOrders.length} в организации услуг`, icon: Package, color: 'orange' },
    { label: 'Сумма заказов', value: fmt(totalOrderAmount), sub: 'по всем заказам', icon: DollarSign, color: 'emerald' },
    { label: 'Фикс. начисления', value: fmt(totalActual), sub: `план: ${fmt(totalPlan)}`, icon: Building2, color: 'sky' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    sky: 'bg-sky-50 border-sky-100 text-sky-700',
  };

  const views: { key: ViewMode; label: string }[] = [
    { key: 'byCustomer', label: 'По клиентам' },
    { key: 'byQuarter', label: 'По кварталам' },
    { key: 'byYear', label: 'По годам' },
    { key: 'byStatus', label: 'По статусам заказов' },
  ];

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-white border-b border-slate-200">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`rounded-xl border p-4 ${colorClasses[card.color]}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</span>
                <Icon className="w-4 h-4 opacity-60" />
              </div>
              <div className="text-xl font-bold">{card.value}</div>
              <div className="text-xs opacity-70 mt-0.5">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-slate-200">
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              view === v.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {v.label}
          </button>
        ))}
        <button
          onClick={handleExport}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          Экспорт
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {!loading && view === 'byCustomer' && (
          <>
            {/* Bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Сумма заказов по клиентам</h3>
              <div className="space-y-2">
                {byCustomer.slice(0, 10).map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-slate-600 truncate">{c.customer_name}</div>
                    <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${(c.total_order_amount / maxOrderAmount) * 100}%` }}
                      >
                        <span className="text-[10px] text-white font-medium">{fmt(c.total_order_amount)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <DataGrid
                columns={customerColumns}
                rows={byCustomer}
                searchPlaceholder="Поиск..."
                searchKeys={['customer_name']}
                exportFilename="stats_by_customer.csv"
              />
            </div>
          </>
        )}

        {!loading && view === 'byQuarter' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200">
              <div className="relative flex-1 min-w-[200px]">
                <input type="text" placeholder="Поиск..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-left">Квартал</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Заказов</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Сумма заказов</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">План</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Факт</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-blue-500 text-right">Отклонение (fx)</th>
                  </tr>
                </thead>
                <tbody>
                  {byQuarter.map((q, i) => (
                    <tr key={q.id} className={`border-b border-slate-100 hover:bg-blue-50/30 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{q.period}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{q.orders}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(q.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(q.plan)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(q.actual)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${q.actual - q.plan >= 0 ? 'text-emerald-600' : 'text-red-500'} bg-blue-50/30`}>
                        <span className="inline-flex items-center gap-1">
                          {q.actual - q.plan >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {fmt(q.actual - q.plan)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {byQuarter.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Нет данных</td></tr>
                  )}
                </tbody>
                {byQuarter.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100 font-semibold text-slate-800">
                      <td className="px-4 py-2.5">Итого</td>
                      <td className="px-4 py-2.5 text-right">{byQuarter.reduce((s, q) => s + q.orders, 0)}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(byQuarter.reduce((s, q) => s + q.amount, 0))}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(byQuarter.reduce((s, q) => s + q.plan, 0))}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(byQuarter.reduce((s, q) => s + q.actual, 0))}</td>
                      <td className="px-4 py-2.5 text-right text-blue-700">{fmt(byQuarter.reduce((s, q) => s + (q.actual - q.plan), 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {!loading && view === 'byYear' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-left">Год</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Заказов</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Сумма заказов</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">План (фикс.)</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-slate-500 text-right">Факт (фикс.)</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase text-blue-500 text-right">Отклонение (fx)</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear.map((y, i) => (
                    <tr key={y.id} className={`border-b border-slate-100 hover:bg-blue-50/30 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{y.period}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{y.orders}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(y.amount)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(y.plan)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{fmt(y.actual)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${y.actual - y.plan >= 0 ? 'text-emerald-600' : 'text-red-500'} bg-blue-50/30`}>
                        {fmt(y.actual - y.plan)}
                      </td>
                    </tr>
                  ))}
                  {byYear.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">Нет данных</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && view === 'byStatus' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {byStatus.map((s) => {
                return (
                  <div key={s.id} className={`rounded-xl border p-4 ${ORDER_STATUS_BG_COLORS[s.status] || 'border-slate-200 bg-slate-50'}`}>
                    <div className="text-sm font-semibold text-slate-700">{ORDER_STATUS_LABELS[s.status] || s.status}</div>
                    <div className="text-2xl font-bold text-slate-800 mt-1">{s.count}</div>
                    <div className="text-sm text-slate-600 mt-1">{fmt(s.total_amount)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
