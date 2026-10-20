export type CustomerStatus = 'active' | 'suspended' | 'terminated';

export interface Customer {
  id: string;
  customer_name: string;
  customer_code: string | null;
  contract_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contract_date: string | null;
  status: string;
  tariff_plan: string | null;
  monthly_fee: number;
  created_at: string;
}

export type OrderStatus =
  | 'tech_check'
  | 'tech_positive'
  | 'org_in_progress'
  | 'in_service'
  | 'acceptance'
  | 'tech_impossible'
  | 'client_refusal';

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'tech_check', label: 'Определение технической возможности' },
  { value: 'tech_positive', label: 'Результат проработки положительный' },
  { value: 'org_in_progress', label: 'Выполняется организация услуг' },
  { value: 'in_service', label: 'Услуга эксплуатируется' },
  { value: 'acceptance', label: 'Приемка' },
  { value: 'tech_impossible', label: 'Нет технической возможности' },
  { value: 'client_refusal', label: 'Отказ клиента' },
];

export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUSES.map((s) => [s.value, s.label]),
);

export const ORDER_STATUS_COLORS: Record<string, string> = {
  tech_check: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  tech_positive: 'bg-sky-100 text-sky-700 border-sky-200',
  org_in_progress: 'bg-orange-100 text-orange-700 border-orange-200',
  in_service: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  acceptance: 'bg-lime-100 text-lime-700 border-lime-200',
  tech_impossible: 'bg-red-100 text-red-700 border-red-200',
  client_refusal: 'bg-pink-100 text-pink-700 border-pink-200',
};

export const ORDER_STATUS_BG_COLORS: Record<string, string> = {
  tech_check: 'border-yellow-200 bg-yellow-50',
  tech_positive: 'border-sky-200 bg-sky-50',
  org_in_progress: 'border-orange-200 bg-orange-50',
  in_service: 'border-emerald-200 bg-emerald-50',
  acceptance: 'border-lime-200 bg-lime-50',
  tech_impossible: 'border-red-200 bg-red-50',
  client_refusal: 'border-pink-200 bg-pink-50',
};

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  connection_point: string | null;
  endpoint_b: string | null;
  service_type: string | null;
  action_type: string | null;
  charge_amount: number;
  status: string;
  comments: string | null;
  order_date: string | null;
  launch_date: string | null;
  org_deadline: number | null;
  control_date: string | null;
  one_time_payment: number;
  monthly_payment: number;
  created_at: string;
  customers?: Pick<Customer, 'customer_name' | 'customer_code'>;
}

export interface OrderComment {
  id: string;
  order_id: string;
  author: string;
  message: string;
  status_note: string | null;
  created_at: string;
}

export interface ServiceOption {
  id: string;
  name: string;
}

export interface ActionOption {
  id: string;
  name: string;
}

export type ChargeStatus = 'plan' | 'actual';

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  suspended: 'Приостановлен',
  terminated: 'Расторгнут',
};

export const CUSTOMER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  suspended: 'bg-amber-100 text-amber-700 border-amber-200',
  terminated: 'bg-red-100 text-red-700 border-red-200',
};

export const CHARGE_STATUS_LABELS: Record<string, string> = {
  plan: 'План',
  actual: 'Факт',
};

export const CHARGE_TYPE_LABELS: Record<string, string> = {
  monthly: 'Ежемесячный',
  installation: 'Подключение',
  construction: 'Строительство',
  'one-time': 'Разовый',
};

export function getStatusLabel(value: string): string {
  return ORDER_STATUS_LABELS[value]
    || CUSTOMER_STATUS_LABELS[value]
    || CHARGE_STATUS_LABELS[value]
    || CHARGE_TYPE_LABELS[value]
    || value;
}

export interface FixedCharge {
  id: string;
  customer_id: string | null;
  order_id: string | null;
  charge_type: string;
  plan_amount: number;
  actual_amount: number;
  one_time_payment: number;
  monthly_payment: number;
  status: string;
  billing_month: string | null;
  current_status: string | null;
  created_at: string;
  customers?: Pick<Customer, 'customer_name' | 'customer_code'>;
  orders?: Pick<Order, 'order_number'>;
}

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  type?: 'text' | 'number' | 'currency' | 'date' | 'select' | 'badge' | 'link';
  options?: string[];
  sortable?: boolean;
  editable?: boolean;
  defaultVisible?: boolean;
  width?: string;
  formula?: boolean;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
}
