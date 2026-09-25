import type { Types } from "mongoose";

import type { DiningTable } from "../models/DiningTable.js";
import type { KitchenTicket } from "../models/KitchenTicket.js";
import type { Order } from "../models/Order.js";
import type { Payment } from "../models/Payment.js";
import type { Shift } from "../models/Shift.js";
import type { TableSession } from "../models/TableSession.js";

type Identified<T> = T & { _id: Types.ObjectId };

export function serializeOrder(order: Identified<Order>) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    mode: order.mode,
    tableId: order.tableId?.toString(),
    tableSessionId: order.tableSessionId?.toString(),
    customerId: order.customerId?.toString(),
    guestName: order.guestName,
    guestPhone: order.guestPhone,
    status: order.status,
    paymentStatus: order.paymentStatus,
    source: order.source,
    version: order.version,
    items: order.items.map((item) => ({
      lineId: item.lineId,
      menuItemId: item.menuItemId.toString(),
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      unitPrice: item.unitPricePaise / 100,
      lineSubtotalPaise: item.lineSubtotalPaise,
      lineSubtotal: item.lineSubtotalPaise / 100,
      variant: item.variant,
      modifiers: item.modifiers,
      station: item.station,
      status: item.status,
      note: item.note
    })),
    pricing: {
      ...order.pricing,
      total: order.pricing.grandTotalPaise / 100
    },
    total: order.pricing.grandTotalPaise / 100,
    totalPaise: order.pricing.grandTotalPaise,
    timeline: order.timeline,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

export function serializeWaiterOrder(order: Identified<Order>) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    mode: order.mode,
    tableId: order.tableId?.toString(),
    tableSessionId: order.tableSessionId?.toString(),
    guestName: order.guestName,
    status: order.status,
    items: order.items.map((item) => ({
      lineId: item.lineId,
      name: item.name,
      quantity: item.quantity,
      variant: item.variant ? { id: item.variant.id, name: item.variant.name } : undefined,
      modifiers: item.modifiers.map((modifier) => ({ groupName: modifier.groupName, optionName: modifier.optionName })),
      station: item.station,
      status: item.status,
      note: item.note
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

export function serializeKitchenOrder(order: Identified<Order>) {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    mode: order.mode,
    tableId: order.tableId?.toString(),
    guestName: order.guestName,
    status: order.status,
    items: order.items.map((item) => ({
      lineId: item.lineId,
      name: item.name,
      quantity: item.quantity,
      variant: item.variant ? { id: item.variant.id, name: item.variant.name } : undefined,
      modifiers: item.modifiers.map((modifier) => ({ groupName: modifier.groupName, optionName: modifier.optionName })),
      station: item.station,
      status: item.status,
      note: item.note
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

export function serializeTicket(ticket: Identified<KitchenTicket>) {
  return {
    id: ticket._id.toString(),
    orderId: ticket.orderId.toString(),
    ticketNumber: ticket.ticketNumber,
    station: ticket.station,
    lineIds: ticket.lineIds,
    status: ticket.status,
    priority: ticket.priority,
    acceptedAt: ticket.acceptedAt,
    readyAt: ticket.readyAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  };
}

export function serializePayment(payment: Identified<Payment>) {
  return {
    id: payment._id.toString(),
    orderId: payment.orderId.toString(),
    provider: payment.provider,
    status: payment.status,
    amountPaise: payment.amountPaise,
    amount: payment.amountPaise / 100,
    currency: payment.currency,
    cashReceivedPaise: payment.cashReceivedPaise,
    cashReceived: payment.cashReceivedPaise === undefined ? undefined : payment.cashReceivedPaise / 100,
    changePaise: payment.changePaise,
    change: payment.changePaise === undefined ? undefined : payment.changePaise / 100,
    refundAmountPaise: payment.refundAmountPaise,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

export function serializeTable(table: Identified<DiningTable>) {
  return {
    id: table._id.toString(),
    number: table.number,
    label: table.label,
    capacity: table.capacity,
    zone: table.zone,
    status: table.status,
    orderingEnabled: table.orderingEnabled,
    assignedWaiterId: table.assignedWaiterId?.toString(),
    createdAt: table.createdAt,
    updatedAt: table.updatedAt
  };
}

export function serializeTableSession(session: Identified<TableSession>) {
  return {
    id: session._id.toString(),
    guestCount: session.guestCount,
    openedAt: session.openedAt,
    notes: session.notes
  };
}
export function serializeShift(shift: Identified<Shift>) {
  return {
    id: shift._id.toString(),
    cashierId: shift.cashierId.toString(),
    registerName: shift.registerName,
    status: shift.status,
    openingCashPaise: shift.openingCashPaise,
    closingCashPaise: shift.closingCashPaise,
    expectedCashPaise: shift.expectedCashPaise,
    cashSalesPaise: shift.cashSalesPaise,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    note: shift.note
  };
}
