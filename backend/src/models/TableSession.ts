import { Schema, model, type Types } from "mongoose";

export interface TableSession {
  restaurantId: Types.ObjectId;
  tableId: Types.ObjectId;
  openedByAccountId: Types.ObjectId;
  guestCount: number;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const tableSessionSchema = new Schema<TableSession>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    tableId: { type: Schema.Types.ObjectId, ref: "DiningTable", required: true, index: true },
    openedByAccountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    guestCount: { type: Number, default: 1, min: 1, max: 50 },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true, versionKey: "version" }
);

tableSessionSchema.index({ restaurantId: 1, tableId: 1, status: 1 });
tableSessionSchema.index(
  { tableId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);

export const TableSessionModel = model<TableSession>("TableSession", tableSessionSchema);
