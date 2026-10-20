import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { getStatusLabel } from '@/types';

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  options?: string[];
  required?: boolean;
  default?: string | number;
}

interface RecordModalProps {
  open: boolean;
  title: string;
  fields: FormField[];
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

export function RecordModal({ open, title, fields, initialData, onSubmit, onClose }: RecordModalProps) {
  const [data, setData] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const field of fields) {
      init[field.key] = initialData?.[field.key] ?? field.default ?? '';
    }
    return init;
  });

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
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={String(data[field.key] ?? '')}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                  required={field.required}
                >
                  <option value="">— Выбрать —</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{getStatusLabel(opt)}</option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  value={String(data[field.key] ?? '')}
                  onChange={(e) => setData({ ...data, [field.key]: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none"
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  max={field.type === 'date' ? new Date().toISOString().split('T')[0] : undefined}
                  value={String(data[field.key] ?? '')}
                  onChange={(e) => setData({
                    ...data,
                    [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value,
                  })}
                  step={field.type === 'number' ? '0.01' : undefined}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                  required={field.required}
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
