import { Schema, model } from "mongoose";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OpeningHour {
  day: Weekday;
  opens?: string;
  closes?: string;
  closed: boolean;
}

export interface PublicProfile {
  cuisine?: string;
  story?: string;
  chefName?: string;
  chefRole?: string;
  heroImageUrl?: string;
  galleryImageUrls: string[];
  bookingUrl?: string;
  reservationEnabled: boolean;
  publicContactEnabled: boolean;
  openingHours: OpeningHour[];
  parkingNote?: string;
  accessibilityNote?: string;
  instagramUrl?: string;
}

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
  publicProfile: PublicProfile;
  createdAt?: Date;
  updatedAt?: Date;
}

const openingHourSchema = new Schema<OpeningHour>({
  day: { type: String, enum: WEEKDAYS, required: true },
  opens: { type: String, trim: true, maxlength: 5 },
  closes: { type: String, trim: true, maxlength: 5 },
  closed: { type: Boolean, default: false }
}, { _id: false });

const publicProfileSchema = new Schema<PublicProfile>({
  cuisine: { type: String, trim: true, maxlength: 120 },
  story: { type: String, trim: true, maxlength: 2_000 },
  chefName: { type: String, trim: true, maxlength: 120 },
  chefRole: { type: String, trim: true, maxlength: 120 },
  heroImageUrl: { type: String, trim: true, maxlength: 2_048 },
  galleryImageUrls: [{ type: String, trim: true, maxlength: 2_048 }],
  bookingUrl: { type: String, trim: true, maxlength: 2_048 },
  reservationEnabled: { type: Boolean, default: true },
  publicContactEnabled: { type: Boolean, default: false },
  openingHours: { type: [openingHourSchema], default: [] },
  parkingNote: { type: String, trim: true, maxlength: 500 },
  accessibilityNote: { type: String, trim: true, maxlength: 500 },
  instagramUrl: { type: String, trim: true, maxlength: 2_048 }
}, { _id: false });

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
    secondaryColor: { type: String, default: "#1C1917" },
    publicProfile: { type: publicProfileSchema, default: () => ({ galleryImageUrls: [], openingHours: [] }) }
  },
  { timestamps: true, versionKey: "version" }
);

export const RestaurantConfigModel = model<RestaurantConfig>("RestaurantConfig", restaurantConfigSchema);
