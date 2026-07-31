export type Role = "CUSTOMER" | "WAITER" | "KITCHEN" | "CASHIER";

export type OrderStatus =
  | "DRAFT"
  | "PLACED"
  | "CONFIRMED"
  | "ACCEPTED_BY_KITCHEN"
  | "PREPARING"
  | "PARTIALLY_READY"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "REJECTED";

export type ItemStatus = "PENDING" | "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PAYMENT_PENDING" | "PARTIALLY_PAID" | "PAID" | "PAYMENT_FAILED" | "REFUND_PENDING" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type DiningMode = "DINE_IN" | "PICKUP" | "COUNTER";
export type KitchenStation = "Hot" | "Tandoor" | "Cold" | "Bar";

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  prepMinutes: number;
  station: KitchenStation;
  dietary: "veg" | "non-veg" | "vegan";
  heat?: 0 | 1 | 2 | 3;
  featured?: boolean;
  unavailable?: boolean;
  color: string;
  glyph: string;
  tags: string[];
}

export interface CartLine {
  id: string;
  item: MenuItem;
  quantity: number;
  note?: string;
  modifiers?: string[];
}

export interface DiningTable {
  id: string;
  label: string;
  zone: string;
  seats: number;
  guests: number;
  status: "available" | "seated" | "attention" | "ready" | "bill";
  elapsedMinutes: number;
  total: number;
  orderId?: string;
  waiter: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  status: ItemStatus;
  modifiers?: string[];
  note?: string;
}

export interface Order {
  id: string;
  displayId: string;
  tableLabel: string;
  tableId?: string;
  mode: DiningMode;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  customerName?: string;
  total: number;
  items: OrderItem[];
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  displayId: string;
  tableLabel: string;
  station: KitchenStation;
  priority: "normal" | "rush" | "refire";
  startedAt: string;
  status: "new" | "preparing" | "ready";
  items: OrderItem[];
  note?: string;
}

export interface ToastMessage {
  id: string;
  tone: "success" | "danger" | "info";
  message: string;
}

export interface AuthSession {
  role: Role;
  name: string;
  accessToken?: string;
  preview?: boolean;
}
