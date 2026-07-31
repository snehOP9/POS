import { z } from "zod";

import { PERMISSIONS, ROLES } from "../domain/access.js";
import { ORDER_ITEM_STATUSES, ORDER_MODES, ORDER_STATUSES } from "../domain/orderTransitions.js";
import { objectIdSchema, paiseSchema } from "../middleware/validateRequest.js";

const blank = z.object({}).passthrough();
const optionalBlank = blank.optional().default({});
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).passthrough();

export const loginRequestSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128)
  }).strict(),
  params: blank,
  query: blank
});

export const refreshRequestSchema = z.object({ body: optionalBlank, params: blank, query: blank });
export const logoutRequestSchema = z.object({ body: optionalBlank, params: blank, query: blank });

export const menuQuerySchema = z.object({
  body: optionalBlank,
  params: blank,
  query: z.object({
    search: z.string().trim().max(100).optional(),
    category: objectIdSchema.optional(),
    vegetarian: z.enum(["true", "false"]).optional(),
    available: z.enum(["true", "false"]).optional(),
    featured: z.enum(["true", "false"]).optional()
  }).passthrough()
});

export const menuItemParamsSchema = z.object({ body: optionalBlank, params: z.object({ id: objectIdSchema }), query: blank });

const variantInputSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(100),
  priceDeltaPaise: z.number().int().min(-100_000_00).max(100_000_00).default(0),
  available: z.boolean().default(true)
}).strict();

const modifierOptionInputSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(100),
  priceDeltaPaise: z.number().int().min(-100_000_00).max(100_000_00).default(0),
  available: z.boolean().default(true)
}).strict();

const modifierGroupInputSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(100),
  minSelections: z.number().int().min(0).max(20).default(0),
  maxSelections: z.number().int().min(0).max(20).default(1),
  options: z.array(modifierOptionInputSchema).max(30).default([])
}).strict().superRefine((value, context) => {
  if (value.minSelections > value.maxSelections) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["minSelections"], message: "cannot exceed maxSelections" });
  }
  if (new Set(value.options.map((option) => option.id)).size !== value.options.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "option IDs must be unique" });
  }
});

export const createCategoryRequestSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.string().url().max(2048).optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    visible: z.boolean().default(true)
  }).strict(),
  params: blank,
  query: blank
});

export const createMenuItemRequestSchema = z.object({
  body: z.object({
    categoryId: objectIdSchema,
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(1000).optional(),
    imageUrl: z.string().url().max(2048).optional(),
    basePricePaise: paiseSchema,
    foodType: z.enum(["VEGETARIAN", "NON_VEGETARIAN", "VEGAN"]).default("VEGETARIAN"),
    allergens: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    spiceLevel: z.number().int().min(0).max(5).default(0),
    available: z.boolean().default(true),
    featured: z.boolean().default(false),
    station: z.string().trim().min(1).max(40).default("MAIN"),
    preparationMinutes: z.number().int().min(0).max(240).default(15),
    variants: z.array(variantInputSchema).max(20).default([]),
    modifierGroups: z.array(modifierGroupInputSchema).max(15).default([])
  }).strict(),
  params: blank,
  query: blank
});

export const updateMenuAvailabilityRequestSchema = z.object({
  body: z.object({ available: z.boolean() }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

const orderLineSchema = z.object({
  menuItemId: objectIdSchema,
  quantity: z.number().int().min(1).max(99),
  variantId: z.string().trim().min(1).max(60).optional(),
  modifierOptionIds: z.array(z.string().trim().min(1).max(60)).max(40).optional(),
  note: z.string().trim().max(500).optional()
}).strict();

export const orderQuoteRequestSchema = z.object({
  body: z.object({ items: z.array(orderLineSchema).min(1).max(100) }).strict(),
  params: blank,
  query: blank
});

export const createOrderRequestSchema = z.object({
  body: z.object({
    mode: z.enum(ORDER_MODES),
    items: z.array(orderLineSchema).min(1).max(100),
    tableId: objectIdSchema.optional(),
    tableToken: z.string().trim().min(16).max(200).optional(),
    tableSessionId: objectIdSchema.optional(),
    guestCount: z.number().int().min(1).max(50).optional(),
    guestName: z.string().trim().min(1).max(100).optional(),
    guestPhone: z.string().trim().min(5).max(30).optional(),
    draft: z.boolean().default(false)
  }).strict(),
  params: blank,
  query: blank
});

export const waiterTableOrderRequestSchema = createOrderRequestSchema.extend({
  params: z.object({ id: objectIdSchema })
});

export const orderListRequestSchema = z.object({
  body: optionalBlank,
  params: blank,
  query: paginationQuery.extend({ status: z.enum(ORDER_STATUSES).optional() })
});

export const orderParamsSchema = z.object({ body: optionalBlank, params: z.object({ id: objectIdSchema }), query: blank });

export const orderStatusRequestSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().trim().min(1).max(500).optional(),
    expectedVersion: z.number().int().min(0).optional()
  }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const orderItemStatusRequestSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_ITEM_STATUSES),
    note: z.string().trim().max(500).optional(),
    expectedVersion: z.number().int().min(0).optional()
  }).strict(),
  params: z.object({ id: objectIdSchema, lineId: z.string().uuid() }),
  query: blank
});

export const tableTokenParamsSchema = z.object({ body: optionalBlank, params: z.object({ token: z.string().min(16).max(200) }), query: blank });
export const tableParamsSchema = z.object({ body: optionalBlank, params: z.object({ id: objectIdSchema }), query: blank });
export const tableOpenRequestSchema = z.object({
  body: z.object({ guestCount: z.number().int().min(1).max(50), note: z.string().trim().max(500).optional() }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const kitchenQuerySchema = z.object({
  body: optionalBlank,
  params: blank,
  query: z.object({
    station: z.string().trim().min(1).max(40).optional(),
    status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]).optional()
  }).passthrough()
});

export const kitchenTicketStatusRequestSchema = z.object({
  body: z.object({ status: z.enum(["NEW", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"]) }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const kitchenTicketItemStatusRequestSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_ITEM_STATUSES),
    note: z.string().trim().max(500).optional(),
    expectedVersion: z.number().int().min(0).optional()
  }).strict(),
  params: z.object({ id: objectIdSchema, lineId: z.string().uuid() }),
  query: blank
});

export const kitchenPriorityRequestSchema = z.object({
  body: z.object({
    priority: z.enum(["NORMAL", "PRIORITY", "RUSH", "REFIRE"]),
    reason: z.string().trim().min(3).max(500)
  }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const cashPaymentRequestSchema = z.object({
  body: z.object({ orderId: objectIdSchema, cashReceivedPaise: paiseSchema }).strict(),
  params: blank,
  query: blank
});

export const razorpayCreateRequestSchema = z.object({
  body: z.object({ orderId: objectIdSchema }).strict(),
  params: blank,
  query: blank
});

export const razorpayVerifyRequestSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().trim().min(1).max(100),
    razorpayPaymentId: z.string().trim().min(1).max(100),
    razorpaySignature: z.string().trim().regex(/^[a-f\d]{64}$/i)
  }).strict(),
  params: blank,
  query: blank
});

export const paymentRefundRequestSchema = z.object({
  body: z.object({ refundAmountPaise: paiseSchema.optional() }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const shiftOpenRequestSchema = z.object({
  body: z.object({
    openingCashPaise: paiseSchema,
    registerName: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500).optional()
  }).strict(),
  params: blank,
  query: blank
});

export const shiftCloseRequestSchema = z.object({
  body: z.object({ closingCashPaise: paiseSchema, note: z.string().trim().max(500).optional() }).strict(),
  params: blank,
  query: blank
});

export const discountRequestSchema = z.object({
  body: z.object({
    discountPaise: paiseSchema,
    reason: z.string().trim().min(3).max(500),
    expectedVersion: z.number().int().min(0).optional()
  }).strict(),
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const reportQuerySchema = z.object({
  body: optionalBlank,
  params: blank,
  query: z.object({
    from: z.coerce.date(),
    to: z.coerce.date()
  }).passthrough().refine((value) => value.to >= value.from, { message: "to must be after from", path: ["to"] })
});

export const notificationListRequestSchema = z.object({ body: optionalBlank, params: blank, query: paginationQuery });

export const notificationReadRequestSchema = z.object({
  body: optionalBlank,
  params: z.object({ id: objectIdSchema }),
  query: blank
});

export const staffRegistrationRequestSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    displayName: z.string().trim().min(1).max(100),
    password: z.string().min(8).max(128),
    role: z.enum(ROLES),
    permissions: z.array(z.enum(PERMISSIONS)).default([])
  }).strict(),
  params: blank,
  query: blank
});
