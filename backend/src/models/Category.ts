import { Schema, model, type Types } from "mongoose";

export interface Category {
  restaurantId: Types.ObjectId;
  name: string;
  description?: string;
  imageUrl?: string;
  sortOrder: number;
  visible: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const categorySchema = new Schema<Category>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    sortOrder: { type: Number, default: 0 },
    visible: { type: Boolean, default: true, index: true }
  },
  { timestamps: true, versionKey: "version" }
);

categorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });
categorySchema.index({ restaurantId: 1, visible: 1, sortOrder: 1 });

export const CategoryModel = model<Category>("Category", categorySchema);
