import { useState } from 'react';
import { Users, Package, CreditCard, BarChart3, Database, HardHat } from 'lucide-react';
import { ToastProvider } from '@/hooks/useToast';
import { CustomersSheet } from '@/sheets/CustomersSheet';
import { OrdersSheet } from '@/sheets/OrdersSheet';
import { FixedChargesSheet } from '@/sheets/FixedChargesSheet';
import { StatisticsSheet } from '@/sheets/StatisticsSheet';
import { ConstructionSheet } from '@/sheets/ConstructionSheet';

type Sheet = 'customers' | 'orders' | 'construction' | 'charges' | 'statistics';

const tabs: { key: Sheet; label: string; icon: typeof Users; description: string }[] = [
  { key: 'customers', label: 'Клиенты', icon: Users, description: 'База клиентов оператора связи' },
  { key: 'orders', label: 'Заказы', icon: Package, description: 'Заказы из CRM, точки подключения, начисления' },
  { key: 'construction', label: 'Заказы в стройке', icon: HardHat, description: 'Заказы в стадии организации: сроки, платежи, комментарии' },
  { key: 'charges', label: 'Фикс. начисления', icon: CreditCard, description: 'Начисления по фикс. базе: план/факт, строительство' },
  { key: 'statistics', label: 'Статистика', icon: BarChart3, description: 'Продажи по кварталам, годам, клиентам' },
];

function App() {
  const [activeSheet, setActiveSheet] = useState<Sheet>('customers');
  const currentTab = tabs.find((t) => t.key === activeSheet)!;

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col bg-slate-100">
        {/* Top header */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-sm">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Телеком Оператор — Учёт</h1>
              <p className="text-xs text-slate-400 leading-tight">Реляционная таблица · портфолио</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveSheet(tab.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                    activeSheet === tab.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        {/* Sheet description bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-2">
          <div className="flex items-center gap-2">
            <currentTab.icon className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-slate-700">{currentTab.label}</span>
            <span className="text-xs text-slate-400">— {currentTab.description}</span>
          </div>
        </div>

        {/* Sheet content */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeSheet === 'customers' && (
            <div className="flex-1 overflow-hidden bg-white">
              <CustomersSheet />
            </div>
          )}
          {activeSheet === 'orders' && (
            <div className="flex-1 overflow-hidden bg-white">
              <OrdersSheet />
            </div>
          )}
          {activeSheet === 'construction' && (
            <div className="flex-1 overflow-hidden bg-white">
              <ConstructionSheet />
            </div>
          )}
          {activeSheet === 'charges' && (
            <div className="flex-1 overflow-hidden flex flex-col bg-white">
              <FixedChargesSheet />
            </div>
          )}
          {activeSheet === 'statistics' && (
            <div className="flex-1 overflow-hidden bg-slate-50">
              <StatisticsSheet />
            </div>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;
