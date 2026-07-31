import { Schema, model, type Types } from "mongoose";

export type KitchenTicketStatus = "NEW" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
export type KitchenPriority = "NORMAL" | "PRIORITY" | "RUSH" | "REFIRE";

export interface KitchenTicket {
  restaurantId: Types.ObjectId;
  orderId: Types.ObjectId;
  ticketNumber: string;
  station: string;
  lineIds: string[];
  status: KitchenTicketStatus;
  priority: KitchenPriority;
  acceptedAt?: Date;
  readyAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const kitchenTicketSchema = new Schema<KitchenTicket>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    ticketNumber: { type: String, required: true },
    station: { type: String, required: true, trim: true, uppercase: true },
    lineIds: { type: [String], required: true },
    status: { type: String, enum: ["NEW", "ACCEPTED", "PREPARING", "READY", "COMPLETED", "CANCELLED"], default: "NEW", index: true },
    priority: { type: String, enum: ["NORMAL", "PRIORITY", "RUSH", "REFIRE"], default: "NORMAL", index: true },
    acceptedAt: { type: Date },
    readyAt: { type: Date }
  },
  { timestamps: true, versionKey: "version" }
);

kitchenTicketSchema.index({ restaurantId: 1, station: 1, status: 1, createdAt: 1 });
kitchenTicketSchema.index({ restaurantId: 1, ticketNumber: 1 }, { unique: true });

export const KitchenTicketModel = model<KitchenTicket>("KitchenTicket", kitchenTicketSchema);
