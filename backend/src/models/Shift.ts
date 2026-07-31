import { Schema, model, type Types } from "mongoose";

export interface Shift {
  restaurantId: Types.ObjectId;
  cashierId: Types.ObjectId;
  registerName: string;
  status: "OPEN" | "CLOSED";
  openingCashPaise: number;
  closingCashPaise?: number;
  expectedCashPaise?: number;
  cashSalesPaise: number;
  openedAt: Date;
  closedAt?: Date;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const shiftSchema = new Schema<Shift>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    cashierId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    registerName: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    openingCashPaise: { type: Number, required: true, min: 0 },
    closingCashPaise: { type: Number, min: 0 },
    expectedCashPaise: { type: Number, min: 0 },
    cashSalesPaise: { type: Number, default: 0, min: 0 },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    note: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true, versionKey: "version" }
);

shiftSchema.index(
  { restaurantId: 1, cashierId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);

export const ShiftModel = model<Shift>("Shift", shiftSchema);
