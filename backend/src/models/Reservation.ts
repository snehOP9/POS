import { Schema, model, type Types } from "mongoose";

export const RESERVATION_STATUSES = ["REQUESTED", "CONFIRMED", "DECLINED", "CANCELLED"] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export interface Reservation {
  restaurantId: Types.ObjectId;
  displayId: string;
  status: ReservationStatus;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  partySize: number;
  reservationAt: Date;
  occasion?: string;
  notes?: string;
  consentAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const reservationSchema = new Schema<Reservation>({
  restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
  displayId: { type: String, required: true, trim: true, maxlength: 24 },
  status: { type: String, enum: RESERVATION_STATUSES, default: "REQUESTED", index: true },
  guestName: { type: String, required: true, trim: true, maxlength: 120 },
  guestEmail: { type: String, trim: true, lowercase: true, maxlength: 254 },
  guestPhone: { type: String, trim: true, maxlength: 30 },
  partySize: { type: Number, required: true, min: 1, max: 30 },
  reservationAt: { type: Date, required: true, index: true },
  occasion: { type: String, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 500 },
  consentAt: { type: Date, required: true }
}, { timestamps: true, versionKey: "version" });

reservationSchema.index({ restaurantId: 1, reservationAt: 1, status: 1 });
reservationSchema.index({ restaurantId: 1, displayId: 1 }, { unique: true });

export const ReservationModel = model<Reservation>("Reservation", reservationSchema);
