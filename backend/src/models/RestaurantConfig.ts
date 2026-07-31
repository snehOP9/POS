import { Schema, model } from "mongoose";

export interface RestaurantConfig {
  name: string;
  tagline?: string;
  description?: string;
  phone?: string;
  supportEmail?: string;
  address?: string;
  currency: string;
  timezone: string;
  tax: { enabled: boolean; rateBasisPoints: number; inclusive: boolean };
  serviceCharge: { enabled: boolean; rateBasisPoints: number };
  invoicePrefix: string;
  receiptFooter?: string;
  razorpayPublicKey?: string;
  tableCount: number;
  orderingModes: Array<"DINE_IN" | "PICKUP" | "COUNTER">;
  deliveryEnabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const restaurantConfigSchema = new Schema<RestaurantConfig>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    tagline: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    phone: { type: String, trim: true, maxlength: 30 },
    supportEmail: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true, maxlength: 500 },
    currency: { type: String, default: "INR", uppercase: true, minlength: 3, maxlength: 3 },
    timezone: { type: String, default: "Asia/Kolkata" },
    tax: {
      enabled: { type: Boolean, default: true },
      rateBasisPoints: { type: Number, default: 500, min: 0, max: 10000 },
      inclusive: { type: Boolean, default: false }
    },
    serviceCharge: {
      enabled: { type: Boolean, default: false },
      rateBasisPoints: { type: Number, default: 0, min: 0, max: 10000 }
    },
    invoicePrefix: { type: String, default: "EMBER", uppercase: true, maxlength: 16 },
    receiptFooter: { type: String, trim: true, maxlength: 500 },
    razorpayPublicKey: { type: String, trim: true },
    tableCount: { type: Number, default: 0, min: 0, max: 500 },
    orderingModes: [{ type: String, enum: ["DINE_IN", "PICKUP", "COUNTER"] }],
    deliveryEnabled: { type: Boolean, default: false },
    primaryColor: { type: String, default: "#F59E0B" },
    secondaryColor: { type: String, default: "#1C1917" }
  },
  { timestamps: true, versionKey: "version" }
);

export const RestaurantConfigModel = model<RestaurantConfig>("RestaurantConfig", restaurantConfigSchema);
