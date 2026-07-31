import { Schema, model, type Types } from "mongoose";

import { PERMISSIONS, ROLES, type Permission, type Role } from "../domain/access.js";

export interface Account {
  restaurantId: Types.ObjectId;
  email: string;
  displayName: string;
  passwordHash: string;
  refreshTokenHash?: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  tokenVersion: number;
  assignedTableIds: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

const accountSchema = new Schema<Account>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    permissions: [{ type: String, enum: PERMISSIONS }],
    active: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0, select: false },
    assignedTableIds: [{ type: Schema.Types.ObjectId, ref: "DiningTable" }]
  },
  { timestamps: true, versionKey: "version" }
);

accountSchema.index({ restaurantId: 1, email: 1 }, { unique: true });
accountSchema.index({ restaurantId: 1, role: 1, active: 1 });

export const AccountModel = model<Account>("Account", accountSchema);
