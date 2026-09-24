import { Schema, model, type Types } from "mongoose";

export type PaymentProvider = "CASH" | "RAZORPAY";
export type PaymentRecordStatus = "PENDING" | "PAID" | "FAILED" | "REFUND_PENDING" | "REFUNDED";

export interface Payment {
  restaurantId: Types.ObjectId;
  orderId: Types.ObjectId;
  provider: PaymentProvider;
  status: PaymentRecordStatus;
  amountPaise: number;
  currency: string;
  cashReceivedPaise?: number;
  changePaise?: number;
  providerOrderId?: string;
  providerPaymentId?: string;
  refundAmountPaise: number;
  createdByAccountId?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const paymentSchema = new Schema<Payment>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    provider: { type: String, enum: ["CASH", "RAZORPAY"], required: true },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUND_PENDING", "REFUNDED"], default: "PENDING", index: true },
    amountPaise: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, minlength: 3, maxlength: 3 },
    cashReceivedPaise: { type: Number, min: 0 },
    changePaise: { type: Number, min: 0 },
    providerOrderId: { type: String, trim: true, index: true },
    providerPaymentId: { type: String, trim: true, index: true },
    refundAmountPaise: { type: Number, default: 0, min: 0 },
    createdByAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true, versionKey: "version" }
);

paymentSchema.index({ restaurantId: 1, providerOrderId: 1 }, { unique: true, partialFilterExpression: { providerOrderId: { $type: "string" } } });
paymentSchema.index({ restaurantId: 1, providerPaymentId: 1 }, { unique: true, partialFilterExpression: { providerPaymentId: { $type: "string" } } });
paymentSchema.index({ restaurantId: 1, orderId: 1, status: 1 });

export const PaymentModel = model<Payment>("Payment", paymentSchema);
