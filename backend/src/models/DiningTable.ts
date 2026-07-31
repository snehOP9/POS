import { Schema, model, type Types } from "mongoose";

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "DISABLED";

export interface DiningTable {
  restaurantId: Types.ObjectId;
  number: number;
  label: string;
  capacity: number;
  zone?: string;
  status: TableStatus;
  qrToken: string;
  orderingEnabled: boolean;
  assignedWaiterId?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const diningTableSchema = new Schema<DiningTable>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    number: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    capacity: { type: Number, default: 4, min: 1, max: 50 },
    zone: { type: String, trim: true, maxlength: 80 },
    status: { type: String, enum: ["AVAILABLE", "OCCUPIED", "RESERVED", "DISABLED"], default: "AVAILABLE", index: true },
    qrToken: { type: String, required: true, unique: true, select: false },
    orderingEnabled: { type: Boolean, default: true },
    assignedWaiterId: { type: Schema.Types.ObjectId, ref: "Account", index: true }
  },
  { timestamps: true, versionKey: "version" }
);

diningTableSchema.index({ restaurantId: 1, number: 1 }, { unique: true });
diningTableSchema.index({ restaurantId: 1, status: 1, zone: 1 });

export const DiningTableModel = model<DiningTable>("DiningTable", diningTableSchema);
