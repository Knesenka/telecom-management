import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, User, Clock, ChevronDown, ChevronUp, Download, GripVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { downloadCSV, toCSV } from '@/lib/utils';
import type { Order, OrderComment, Customer, ColumnDef, ServiceOption, ActionOption } from '@/types';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types';

const todayStr = new Date().toISOString().split('T')[0];

interface ConstructionRow extends Order {
  customer_name: string;
}

const columns: ColumnDef<ConstructionRow>[] = [
  { key: 'order_number', label: '№ заказа', type: 'text', editable: true, defaultVisible: true, width: '130px' },
  { key: 'customer_name', label: 'Клиент', type: 'link', defaultVisible: true, width: '170px' },
  { key: 'connection_point', label: 'Точка А', type: 'text', editable: true, defaultVisible: true, width: '180px' },
  { key: 'endpoint_b', label: 'Точка Б', type: 'text', editable: true, defaultVisible: true, width: '180px' },
  { key: 'service_type', label: 'Услуга', type: 'select', editable: true, defaultVisible: true, width: '140px' },
  { key: 'action_type', label: 'Действие', type: 'select', editable: true, defaultVisible: true, width: '160px' },
  { key: 'launch_date', label: 'Дата запуска', type: 'date', editable: true, defaultVisible: true },
  { key: 'org_deadline', label: 'Срок организации (дн.)', type: 'number', editable: true, defaultVisible: true, align: 'right' },
  { key: 'control_date', label: 'Контрольная дата', type: 'date', editable: false, defaultVisible: true },
  { key: 'one_time_payment', label: 'Единоразовый платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
  { key: 'monthly_payment', label: 'Ежемесячный платеж', type: 'currency', editable: true, defaultVisible: true, align: 'right' },
  { key: 'status', label: 'Статус', type: 'badge', options: ORDER_STATUSES.map((s) => s.value), editable: true, defaultVisible: true },
];

const visibleKeys = columns.map((c) => String(c.key));

export function ConstructionSheet() {
  const { show } = useToast();
  const [rows, setRows] = useState<ConstructionRow[]>([]);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(visibleKeys);
  const [columnOrder, setColumnOrder] = useState<string[]>(visibleKeys);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showColSettings, setShowColSettings] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [panelHeight, setPanelHeight] = useState(300);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [newComment, setNewComment] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newStatusNote, setNewStatusNote] = useState('');
  const [serviceOptions, setServiceOptions] = useState<string[]>(['IP транзит', 'L2 VPN']);
  const [actionOptions, setActionOptions] = useState<string[]>(['Подключение', 'Изменение конфигурации', 'Отключение', 'Изменение тарифного плана']);

  const startDrag = (e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = panelHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => {
      const delta = dragStartY.current - e.clientY;
      const containerHeight = containerRef.current?.offsetHeight ?? 600;
      const newHeight = Math.max(80, Math.min(containerHeight - 120, dragStartHeight.current + delta));
      setPanelHeight(newHeight);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [orderRes, servRes, actRes] = await Promise.all([
      supabase.from('orders').select('*, customers(customer_name, customer_code)').eq('status', 'org_in_progress').order('created_at', { ascending: false }),
      supabase.from('services').select('*').order('name'),
      supabase.from('actions').select('*').order('name'),
    ]);
    if (orderRes.error) {
      show('Ошибка загрузки: ' + orderRes.error.message, 'error');
    } else {
      setRows(
        (orderRes.data as Order[]).map((o) => ({
          ...o,
          customer_name: o.customers?.customer_name ?? '—',
        }))
      );
    }
    if (servRes.data) setServiceOptions((servRes.data as ServiceOption[]).map((s) => s.name));
    if (actRes.data) setActionOptions((actRes.data as ActionOption[]).map((a) => a.name));
    setLoading(false);
  }, [show]);

  const fetchComments = useCallback(async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error) {
      show('Ошибка загрузки комментариев: ' + error.message, 'error');
    } else {
      setComments(data as OrderComment[]);
    }
  }, [show]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedOrderId) {
      fetchComments(selectedOrderId);
    } else {
      setComments([]);
    }
  }, [selectedOrderId, fetchComments]);

  const orderedColumns = columnOrder
    .map((key) => columns.find((c) => String(c.key) === key))
    .filter((c): c is ColumnDef<ConstructionRow> => c !== undefined);

  const activeColumns = orderedColumns.filter((c) => visibleCols.includes(String(c.key)));

  const moveColumn = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setColumnOrder((prev) => {
      const fromIdx = prev.indexOf(fromKey);
      const toIdx = prev.indexOf(toKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromKey);
      return next;
    });
  };

  const filteredRows = (() => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter((r) =>
      [r.order_number, r.customer_name, r.connection_point, r.endpoint_b].some(
        (v) => v && String(v).toLowerCase().includes(lower)
      )
    );
  })();

  const sortedRows = (() => {
    if (!sortKey) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = (a as unknown as unknown as Record<string, unknown>)[sortKey];
      const valB = (b as unknown as unknown as Record<string, unknown>)[sortKey];
      if (valA === null || valA === undefined) return sortDir === 'asc' ? -1 : 1;
      if (valB === null || valB === undefined) return sortDir === 'asc' ? 1 : -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortKey(null); setSortDir('asc'); }
    } else { setSortKey(key); setSortDir('asc'); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(Number(n) || 0);
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

  const badgeColor = (status: string): string => {
    return ORDER_STATUS_COLORS[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const handleEdit = async (row: ConstructionRow, column: string, value: string | number) => {
    if (column === 'customer_name') return;
    if (value === '__add_new__') {
      if (column === 'service_type') {
        const name = prompt('Введите название новой услуги:');
        if (name && name.trim()) {
          const { error: insErr } = await supabase.from('services').insert({ name: name.trim() });
          if (insErr) { show('Ошибка: ' + insErr.message, 'error'); return; }
          const { data: servData } = await supabase.from('services').select('*').order('name');
          if (servData) setServiceOptions((servData as ServiceOption[]).map((s) => s.name));
          await supabase.from('orders').update({ service_type: name.trim() }).eq('id', row.id);
          show('Услуга добавлена', 'success');
          fetchData();
        }
      } else if (column === 'action_type') {
        const name = prompt('Введите название нового действия:');
        if (name && name.trim()) {
          const { error: insErr } = await supabase.from('actions').insert({ name: name.trim() });
          if (insErr) { show('Ошибка: ' + insErr.message, 'error'); return; }
          const { data: actData } = await supabase.from('actions').select('*').order('name');
          if (actData) setActionOptions((actData as ActionOption[]).map((a) => a.name));
          await supabase.from('orders').update({ action_type: name.trim() }).eq('id', row.id);
          show('Действие добавлено', 'success');
          fetchData();
        }
      }
      return;
    }
    const updateValue = value === '' ? null : value;
    if (column === 'launch_date' && updateValue && String(updateValue) > todayStr) {
      show('Дата не может быть позже сегодняшнего дня', 'error');
      return;
    }
    const updates: Record<string, unknown> = { [column]: updateValue };

    if (column === 'launch_date' || column === 'org_deadline') {
      const launchDate = column === 'launch_date' ? String(value) : row.launch_date;
      const days = column === 'org_deadline' ? Number(value) : Number(row.org_deadline ?? 0);
      if (launchDate && days > 0) {
        const base = new Date(launchDate);
        base.setDate(base.getDate() + days);
        updates.control_date = base.toISOString().split('T')[0];
      } else {
        updates.control_date = null;
      }
    }

    const { error } = await supabase.from('orders').update(updates).eq('id', row.id);
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      fetchData();
    }
  };

  const startEdit = (rowId: string, column: string, currentValue: unknown) => {
    const col = columns.find((c) => String(c.key) === column);
    if (!col?.editable) return;
    setEditingCell({ rowId, column });
    if ((col.type === 'number' || col.type === 'currency') && (currentValue === 0 || currentValue === '0' || currentValue === null)) {
      setEditValue('');
    } else {
      setEditValue(String(currentValue ?? ''));
    }
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const row = rows.find((r) => r.id === editingCell.rowId);
    if (row) {
      const col = columns.find((c) => String(c.key) === editingCell.column);
      const isNumeric = col?.type === 'number' || col?.type === 'currency';
      const value = isNumeric ? Number(editValue) : (editValue === '' ? null : editValue);
      handleEdit(row, editingCell.column, value as string | number);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const isEditing = (rowId: string, column: string) =>
    editingCell?.rowId === rowId && editingCell?.column === column;

  const handleDelete = async (row: ConstructionRow) => {
    if (!confirm(`Удалить заказ "${row.order_number}"? Связанные комментарии также будут удалены.`)) return;
    await supabase.from('order_comments').delete().eq('order_id', row.id);
    const { error } = await supabase.from('orders').delete().eq('id', row.id);
    if (error) {
      show('Ошибка удаления: ' + error.message, 'error');
    } else {
      show('Заказ удалён', 'success');
      setSelectedOrderId(null);
      fetchData();
    }
  };

  const handleAddComment = async () => {
    if (!selectedOrderId || !newComment.trim()) return;
    const { error } = await supabase.from('order_comments').insert({
      order_id: selectedOrderId,
      author: newAuthor.trim() || 'Аноним',
      message: newComment.trim(),
      status_note: newStatusNote.trim() || null,
    });
    if (error) {
      show('Ошибка: ' + error.message, 'error');
    } else {
      setNewComment('');
      setNewStatusNote('');
      fetchComments(selectedOrderId);
    }
  };

  const handleExport = () => {
    const headers = activeColumns.map((c) => c.label);
    const data = sortedRows.map((row) =>
      activeColumns.map((col) => {
        const val = (row as unknown as Record<string, unknown>)[String(col.key)];
        return val === null || val === undefined ? '' : String(val);
      })
    );
    downloadCSV('construction_orders.csv', toCSV(headers, data));
  };

  const selectedRow = rows.find((r) => r.id === selectedOrderId);

  const renderCell = (row: ConstructionRow, col: ColumnDef<ConstructionRow>) => {
    const value = (row as unknown as Record<string, unknown>)[String(col.key)];
    if (col.type === 'currency') return fmt(Number(value) || 0);
    if (col.type === 'date') return value ? new Date(value as string).toLocaleDateString('ru-RU') : <span className="text-slate-400">—</span>;
    if (col.type === 'number') return value ? <span>{String(value)} дн.</span> : <span className="text-slate-400">—</span>;
    if (col.type === 'badge') return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor(String(value))}`}>{ORDER_STATUS_LABELS[String(value)] || String(value)}</span>;
    if (col.type === 'link') return <span className="font-medium text-slate-700">{String(value)}</span>;
    if (!value) return <span className="text-slate-400">—</span>;
    return String(value);
  };

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск..."
          className="flex-1 min-w-[180px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        />
        <div className="relative">
          <button
            onClick={() => setShowColSettings((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            Колонки
          </button>
          {showColSettings && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColSettings(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-xl min-w-[220px] max-h-[320px] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">Видимые колонки</div>
                {orderedColumns.map((col) => (
                  <label key={String(col.key)} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(String(col.key))}
                      onChange={() => setVisibleCols((prev) => prev.includes(String(col.key)) ? prev.filter((k) => k !== String(col.key)) : [...prev, String(col.key)])}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span className="text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          <Download className="w-4 h-4" />
          Экспорт
        </button>
      </div>

      {/* Top: data grid */}
      <div className={`overflow-auto ${collapsed ? 'flex-none max-h-[120px]' : 'flex-1'}`} style={collapsed ? {} : { flexBasis: `calc(100% - ${panelHeight}px - 6px)` }}>
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-[1]">
            <tr className="bg-slate-50 border-b border-slate-200">
              {activeColumns.map((col) => {
                const colKey = String(col.key);
                const isDragged = draggedCol === colKey;
                const isDragOver = dragOverCol === colKey && draggedCol !== colKey;
                return (
                <th
                  key={colKey}
                  draggable
                  onDragStart={(e) => {
                    setDraggedCol(colKey);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (draggedCol && draggedCol !== colKey) setDragOverCol(colKey);
                  }}
                  onDragLeave={() => setDragOverCol((prev) => prev === colKey ? null : prev)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedCol && draggedCol !== colKey) moveColumn(draggedCol, colKey);
                    setDraggedCol(null);
                    setDragOverCol(null);
                  }}
                  onDragEnd={() => { setDraggedCol(null); setDragOverCol(null); }}
                  onClick={() => toggleSort(colKey)}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition select-none ${col.align === 'right' ? 'text-right' : 'text-left'} ${isDragged ? 'opacity-40 bg-blue-100' : ''} ${isDragOver ? 'bg-blue-200/60' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                    <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    {col.label}
                    {sortKey === colKey ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                  </div>
                </th>
                );
              })}
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={activeColumns.length + 1} className="text-center py-8 text-slate-400">
                <div className="inline-flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  Загрузка...
                </div>
              </td></tr>
            )}
            {!loading && sortedRows.length === 0 && (
              <tr><td colSpan={activeColumns.length + 1} className="text-center py-8 text-slate-400">
                Нет заказов в стадии организации услуг
              </td></tr>
            )}
            {!loading && sortedRows.map((row, idx) => (
              <tr
                key={row.id}
                onClick={() => setSelectedOrderId(row.id)}
                className={`border-b border-slate-100 cursor-pointer transition ${
                  selectedOrderId === row.id ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : idx % 2 ? 'bg-slate-50/30' : ''
                } hover:bg-blue-50/30`}
              >
                {activeColumns.map((col) => {
                  const editing = isEditing(row.id, String(col.key));
                  const value = (row as unknown as Record<string, unknown>)[String(col.key)];
                  return (
                    <td
                      key={String(col.key)}
                      onClick={(e) => {
                        if (col.editable) {
                          e.stopPropagation();
                          startEdit(row.id, String(col.key), value);
                        }
                      }}
                      className={`px-4 py-2.5 text-slate-700 ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                        col.editable ? 'cursor-text' : ''
                      } whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]`}
                    >
                      {editing ? (
                        col.type === 'badge' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            {ORDER_STATUSES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                        ) : col.type === 'select' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            {col.key === 'service_type' && <>
                              {serviceOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              <option value="__add_new__">— Добавить услугу —</option>
                            </>}
                            {col.key === 'action_type' && <>
                              {actionOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                              <option value="__add_new__">— Добавить действие —</option>
                            </>}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={col.type === 'number' || col.type === 'currency' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                            max={col.type === 'date' ? todayStr : undefined}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                            placeholder={col.type === 'number' || col.type === 'currency' ? '0' : undefined}
                            className={`w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${col.align === 'right' ? 'text-right' : ''}`}
                          />
                        )
                      ) : renderCell(row, col)}
                    </td>
                  );
                })}
                <td className="px-2 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(row)}
                    className="text-slate-300 hover:text-red-500 transition p-1"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drag handle */}
      {!collapsed && (
        <div
          onMouseDown={startDrag}
          className={`flex items-center justify-center h-1.5 bg-slate-200 hover:bg-blue-400 transition-colors cursor-row-resize flex-shrink-0 ${isDragging ? 'bg-blue-500' : ''}`}
        >
          <div className="w-10 h-1 rounded-full bg-slate-400 group-hover:bg-blue-600" />
        </div>
      )}

      {/* Bottom: comments chat panel */}
      <div className={`border-t border-slate-200 bg-white flex flex-col ${collapsed ? 'flex-none' : 'flex-shrink-0'}`} style={{ height: collapsed ? 'auto' : `${panelHeight}px` }}>
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition"
          onClick={() => setCollapsed((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-slate-700">
              Текущий статус
            </span>
            {selectedRow && (
              <span className="text-xs text-slate-400">
                — {selectedRow.order_number} · {selectedRow.customer_name}
              </span>
            )}
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Comments list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/50">
              {!selectedOrderId && (
                <div className="text-center py-6 text-sm text-slate-400">
                  Выберите заказ в таблице выше, чтобы увидеть историю комментариев
                </div>
              )}
              {selectedOrderId && comments.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400">
                  Пока нет комментариев по этому заказу
                </div>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg border border-slate-100 px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700">{c.author}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(c.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {c.status_note && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          {c.status_note}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{c.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment input */}
            {selectedOrderId && (
              <div className="border-t border-slate-100 px-4 py-3 bg-white">
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Ваше имя"
                    className="w-32 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <input
                    type="text"
                    value={newStatusNote}
                    onChange={(e) => setNewStatusNote(e.target.value)}
                    placeholder="Метка статуса (необязательно)"
                    className="w-48 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Добавить комментарий..."
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Отправить
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
