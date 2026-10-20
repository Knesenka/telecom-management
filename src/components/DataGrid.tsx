import { useMemo, useState, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings2, Download, Plus, Search, X, GripVertical } from 'lucide-react';
import type { ColumnDef } from '@/types';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS, ORDER_STATUSES, getStatusLabel, CUSTOMER_STATUS_COLORS, CHARGE_STATUS_LABELS } from '@/types';
import { downloadCSV, toCSV } from '@/lib/utils';

const todayStr = new Date().toISOString().split('T')[0];

interface DataGridProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  rows: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  onAdd?: () => void;
  addLabel?: string;
  onEdit?: (row: T, column: string, value: string | number) => void;
  onDelete?: (row: T) => void;
  exportFilename?: string;
  toolbarExtra?: ReactNode;
  initialVisibleColumns?: string[];
}

export function DataGrid<T extends { id: string }>({
  columns,
  rows,
  loading,
  searchPlaceholder = 'Поиск...',
  searchKeys = [],
  onAdd,
  addLabel = 'Добавить',
  onEdit,
  onDelete,
  exportFilename = 'export.csv',
  toolbarExtra,
  initialVisibleColumns,
}: DataGridProps<T>) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (initialVisibleColumns) return initialVisibleColumns;
    return columns.filter((c) => c.defaultVisible !== false).map((c) => String(c.key));
  });
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map((c) => String(c.key)));
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const orderedColumns = columnOrder
    .map((key) => columns.find((c) => String(c.key) === key))
    .filter((c): c is ColumnDef<T> => c !== undefined);

  const activeColumns = orderedColumns.filter((c) => visibleColumns.includes(String(c.key)));

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

  const filteredRows = useMemo(() => {
    if (!search || searchKeys.length === 0) return rows;
    const lower = search.toLowerCase();
    return rows.filter((row) =>
      searchKeys.some((key) => {
        const val = row[key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lower);
      })
    );
  }, [rows, search, searchKeys]);

  const toggleSort = (key: string) => {
    const col = orderedColumns.find((c) => String(c.key) === key);
    if (col?.sortable === false) return;
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const col = orderedColumns.find((c) => String(c.key) === sortKey);
    if (!col) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      let valA: unknown = (a as Record<string, unknown>)[sortKey];
      let valB: unknown = (b as Record<string, unknown>)[sortKey];
      if (col.type === 'link' && col.render) {
        valA = (a as Record<string, unknown>)[sortKey];
        valB = (b as Record<string, unknown>)[sortKey];
      }
      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDir === 'asc' ? -1 : 1;
      if (strA > strB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortKey, sortDir, orderedColumns]);

  const handleExport = () => {
    const headers = activeColumns.map((c) => c.label);
    const data = sortedRows.map((row) =>
      activeColumns.map((col) => {
        const val = (row as Record<string, unknown>)[String(col.key)];
        if (val === null || val === undefined) return '';
        if (col.type === 'currency') return val as number;
        return String(val);
      })
    );
    downloadCSV(exportFilename, toCSV(headers, data));
  };

  const startEdit = (rowId: string, column: string, currentValue: unknown) => {
    if (!onEdit) return;
    const col = orderedColumns.find((c) => String(c.key) === column);
    if (col?.editable === false || !col?.editable) return;
    setEditingCell({ rowId, column });
    setEditValue(String(currentValue ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell || !onEdit) return;
    const row = rows.find((r) => r.id === editingCell.rowId);
    if (row) {
      const col = orderedColumns.find((c) => String(c.key) === editingCell.column);
      const isNumeric = col?.type === 'number' || col?.type === 'currency';
      const value = isNumeric ? Number(editValue) : (editValue === '' ? null : editValue);
      onEdit(row, editingCell.column, value as string | number);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const badgeColor = (status: string): string => {
    const colors: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      suspended: 'bg-amber-100 text-amber-700 border-amber-200',
      terminated: 'bg-red-100 text-red-700 border-red-200',
      plan: 'bg-sky-100 text-sky-700 border-sky-200',
      actual: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      ...ORDER_STATUS_COLORS,
    };
    return colors[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const renderCell = (row: T, col: ColumnDef<T>): ReactNode => {
    if (col.render) return col.render(row);
    const value = (row as Record<string, unknown>)[String(col.key)];
    if (col.type === 'currency') {
      return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0);
    }
    if (col.type === 'number') {
      return new Intl.NumberFormat('ru-RU').format(Number(value) || 0);
    }
    if (col.type === 'date') {
      if (!value) return <span className="text-slate-400">—</span>;
      return new Date(value as string).toLocaleDateString('ru-RU');
    }
    if (col.type === 'badge') {
      const status = String(value);
      const label = getStatusLabel(status);
      const colors = ORDER_STATUS_COLORS[status] || CUSTOMER_STATUS_COLORS[status] || (status === 'actual' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : status === 'plan' ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-600 border-slate-200');
      return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors}`}>{label}</span>;
    }
    if (col.type === 'link') {
      const display = (row as Record<string, unknown>)[String(col.key)];
      if (!display) return <span className="text-slate-400">—</span>;
      return <span className="font-medium text-slate-700">{String(display)}</span>;
    }
    if (!value && value !== 0) return <span className="text-slate-400">—</span>;
    return String(value);
  };

  const isEditing = (rowId: string, column: string) =>
    editingCell?.rowId === rowId && editingCell?.column === column;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {toolbarExtra}

        <div className="relative">
          <button
            onClick={() => setShowColumnSettings((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Settings2 className="w-4 h-4" />
            Колонки
          </button>
          {showColumnSettings && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColumnSettings(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-xl min-w-[220px] max-h-[320px] overflow-y-auto">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                  Видимые колонки
                </div>
                {orderedColumns.map((col) => (
                  <label
                    key={String(col.key)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(String(col.key))}
                      onChange={() => toggleColumn(String(col.key))}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                    />
                    <span className="text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <Download className="w-4 h-4" />
          Экспорт
        </button>

        {onAdd && (
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {addLabel}
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
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
                    if (draggedCol && draggedCol !== colKey) {
                      moveColumn(draggedCol, colKey);
                    }
                    setDraggedCol(null);
                    setDragOverCol(null);
                  }}
                  onDragEnd={() => { setDraggedCol(null); setDragOverCol(null); }}
                  onClick={() => toggleSort(colKey)}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition select-none ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.formula ? 'bg-blue-50/50' : ''} ${isDragged ? 'opacity-40 bg-blue-100' : ''} ${isDragOver ? 'bg-blue-200/60' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : ''}`}>
                    <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                    {col.formula && <span className="text-blue-500" title="Вычисляемое поле">fx</span>}
                    {col.label}
                    {sortKey === colKey ? (
                      sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      col.sortable !== false && <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </div>
                </th>
                );
              })}
              {onDelete && <th className="w-10 px-2 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={activeColumns.length + 1} className="text-center py-12 text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                    Загрузка...
                  </div>
                </td>
              </tr>
            )}
            {!loading && sortedRows.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} className="text-center py-12 text-slate-400">
                  Нет данных
                </td>
              </tr>
            )}
            {!loading && sortedRows.map((row, idx) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 hover:bg-blue-50/30 transition ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}
              >
                {activeColumns.map((col) => {
                  const editable = col.editable && onEdit;
                  const editing = isEditing(row.id, String(col.key));
                  const value = (row as Record<string, unknown>)[String(col.key)];
                  return (
                    <td
                      key={String(col.key)}
                      onClick={() => editable && !editing && startEdit(row.id, String(col.key), value)}
                      className={`px-4 py-2.5 text-slate-700 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${
                        col.formula ? 'bg-blue-50/30 font-medium text-blue-900' : ''
                      } ${editable ? 'cursor-text hover:bg-blue-50/50 rounded' : ''} whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]`}
                    >
                      {editing ? (
                        col.type === 'select' || col.type === 'badge' ? (
                          <select
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                          >
                            {col.options?.map((opt) => {
                              const label = opt === '__add_new__' ? '— Добавить —' : getStatusLabel(opt);
                              return <option key={opt} value={opt}>{label}</option>;
                            })}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={col.type === 'number' || col.type === 'currency' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                            max={col.type === 'date' ? todayStr : undefined}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit();
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className={`w-full px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${col.align === 'right' ? 'text-right' : ''}`}
                          />
                        )
                      ) : (
                        renderCell(row, col)
                      )}
                    </td>
                  );
                })}
                {onDelete && (
                  <td className="px-2 py-2.5 text-center">
                    <button
                      onClick={() => onDelete(row)}
                      className="text-slate-300 hover:text-red-500 transition p-1"
                      title="Удалить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with summary */}
      {sortedRows.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center justify-between">
          <span>Всего записей: {sortedRows.length}</span>
          {activeColumns.some((c) => c.type === 'currency') && (
            <span>
              {activeColumns
                .filter((c) => c.type === 'currency' && !c.formula)
                .map((col) => {
                  const total = sortedRows.reduce((sum, r) => sum + (Number((r as Record<string, unknown>)[String(col.key)]) || 0), 0);
                  return `${col.label}: ${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 0 }).format(total)}`;
                })
                .join(' · ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
