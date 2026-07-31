import { Schema, model, type Types } from "mongoose";

import {
  ORDER_ITEM_STATUSES,
  ORDER_MODES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type OrderItemStatus,
  type OrderMode,
  type OrderStatus,
  type PaymentStatus
} from "../domain/orderTransitions.js";
import type { Role } from "../domain/access.js";

export interface OrderItemModifierSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDeltaPaise: number;
}

export interface OrderItemSnapshot {
  lineId: string;
  menuItemId: Types.ObjectId;
  name: string;
  imageUrl?: string;
  quantity: number;
  unitBasePricePaise: number;
  variant?: { id: string; name: string; priceDeltaPaise: number };
  modifiers: OrderItemModifierSnapshot[];
  unitPricePaise: number;
  lineSubtotalPaise: number;
  status: OrderItemStatus;
  station: string;
  note?: string;
}

export interface OrderPricing {
  currency: string;
  subtotalPaise: number;
  taxPaise: number;
  serviceChargePaise: number;
  discountPaise: number;
  grandTotalPaise: number;
}

export interface OrderTimelineEvent {
  type: string;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  timestamp: Date;
  actorId?: Types.ObjectId;
  actorRole?: Role;
  note?: string;
  source: "API" | "SYSTEM" | "WEBHOOK";
}

export interface Order {
  restaurantId: Types.ObjectId;
  orderNumber: string;
  mode: OrderMode;
  tableId?: Types.ObjectId;
  tableSessionId?: Types.ObjectId;
  customerId?: Types.ObjectId;
  createdByAccountId: Types.ObjectId;
  guestName?: string;
  guestPhone?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItemSnapshot[];
  pricing: OrderPricing;
  timeline: OrderTimelineEvent[];
  source: "CUSTOMER" | "WAITER" | "CASHIER";
  version: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const modifierSnapshotSchema = new Schema<OrderItemModifierSnapshot>(
  {
    groupId: { type: String, required: true },
    groupName: { type: String, required: true },
    optionId: { type: String, required: true },
    optionName: { type: String, required: true },
    priceDeltaPaise: { type: Number, required: true }
  },
  { _id: false }
);

const orderItemSchema = new Schema<OrderItemSnapshot>(
  {
    lineId: { type: String, required: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true },
    name: { type: String, required: true },
    imageUrl: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    unitBasePricePaise: { type: Number, required: true, min: 0 },
    variant: {
      id: { type: String },
      name: { type: String },
      priceDeltaPaise: { type: Number }
    },
    modifiers: { type: [modifierSnapshotSchema], default: [] },
    unitPricePaise: { type: Number, required: true, min: 0 },
    lineSubtotalPaise: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_ITEM_STATUSES, default: "PENDING" },
    station: { type: String, required: true },
    note: { type: String, trim: true, maxlength: 500 }
  },
  { _id: false }
);

const pricingSchema = new Schema<OrderPricing>(
  {
    currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    subtotalPaise: { type: Number, required: true, min: 0 },
    taxPaise: { type: Number, required: true, min: 0 },
    serviceChargePaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, required: true, min: 0 },
    grandTotalPaise: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const timelineSchema = new Schema<OrderTimelineEvent>(
  {
    type: { type: String, required: true },
    previousStatus: { type: String, enum: ORDER_STATUSES },
    newStatus: { type: String, enum: ORDER_STATUSES },
    timestamp: { type: Date, required: true, default: Date.now },
    actorId: { type: Schema.Types.ObjectId, ref: "Account" },
    actorRole: { type: String, enum: ["CUSTOMER", "WAITER", "KITCHEN", "CASHIER"] },
    note: { type: String, trim: true, maxlength: 500 },
    source: { type: String, enum: ["API", "SYSTEM", "WEBHOOK"], default: "API" }
  },
  { _id: false }
);

const orderSchema = new Schema<Order>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    mode: { type: String, enum: ORDER_MODES, required: true },
    tableId: { type: Schema.Types.ObjectId, ref: "DiningTable", index: true },
    tableSessionId: { type: Schema.Types.ObjectId, ref: "TableSession", index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Account", index: true },
    createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    guestName: { type: String, trim: true, maxlength: 100 },
    guestPhone: { type: String, trim: true, maxlength: 30 },
    status: { type: String, enum: ORDER_STATUSES, default: "DRAFT", index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "UNPAID", index: true },
    items: { type: [orderItemSchema], validate: [(items: OrderItemSnapshot[]) => items.length > 0, "Order needs items"] },
    pricing: { type: pricingSchema, required: true },
    timeline: { type: [timelineSchema], default: [] },
    source: { type: String, enum: ["CUSTOMER", "WAITER", "CASHIER"], required: true }
  },
  { timestamps: true, versionKey: "version", optimisticConcurrency: true }
);

orderSchema.index({ restaurantId: 1, orderNumber: 1 }, { unique: true });
orderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, tableSessionId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, customerId: 1, createdAt: -1 });

export const OrderModel = model<Order>("Order", orderSchema);
