import { Schema, model, type Types } from "mongoose";

export type FoodType = "VEGETARIAN" | "NON_VEGETARIAN" | "VEGAN";

export interface MenuVariant {
  id: string;
  name: string;
  priceDeltaPaise: number;
  available: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaPaise: number;
  available: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
}

export interface MenuOffer {
  percentage: number;
  label: string;
}

export interface MenuItem {
  restaurantId: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description?: string;
  imageUrl?: string;
  basePricePaise: number;
  offer?: MenuOffer;
  foodType: FoodType;
  allergens: string[];
  spiceLevel: number;
  available: boolean;
  archived: boolean;
  featured: boolean;
  station: string;
  preparationMinutes: number;
  variants: MenuVariant[];
  modifierGroups: ModifierGroup[];
  createdAt?: Date;
  updatedAt?: Date;
}

const variantSchema = new Schema<MenuVariant>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    priceDeltaPaise: { type: Number, default: 0 },
    available: { type: Boolean, default: true }
  },
  { _id: false }
);

const modifierOptionSchema = new Schema<ModifierOption>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    priceDeltaPaise: { type: Number, default: 0 },
    available: { type: Boolean, default: true }
  },
  { _id: false }
);

const modifierGroupSchema = new Schema<ModifierGroup>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    minSelections: { type: Number, default: 0, min: 0 },
    maxSelections: { type: Number, default: 1, min: 0 },
    options: { type: [modifierOptionSchema], default: [] }
  },
  { _id: false }
);

const menuOfferSchema = new Schema<MenuOffer>(
  {
    percentage: { type: Number, required: true, min: 1, max: 90 },
    label: { type: String, required: true, trim: true, maxlength: 80 }
  },
  { _id: false }
);

const menuItemSchema = new Schema<MenuItem>(
  {
    restaurantId: { type: Schema.Types.ObjectId, ref: "RestaurantConfig", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 1000 },
    imageUrl: { type: String, trim: true, maxlength: 2048 },
    basePricePaise: { type: Number, required: true, min: 0 },
    offer: { type: menuOfferSchema },
    foodType: { type: String, enum: ["VEGETARIAN", "NON_VEGETARIAN", "VEGAN"], default: "VEGETARIAN" },
    allergens: { type: [String], default: [] },
    spiceLevel: { type: Number, default: 0, min: 0, max: 5 },
    available: { type: Boolean, default: true, index: true },
    archived: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false, index: true },
    station: { type: String, default: "MAIN", trim: true, uppercase: true, maxlength: 40 },
    preparationMinutes: { type: Number, default: 15, min: 0, max: 240 },
    variants: { type: [variantSchema], default: [] },
    modifierGroups: { type: [modifierGroupSchema], default: [] }
  },
  { timestamps: true, versionKey: "version" }
);

menuItemSchema.index({ restaurantId: 1, categoryId: 1, archived: 1, available: 1 });
menuItemSchema.index({ restaurantId: 1, featured: 1, archived: 1, available: 1 });
menuItemSchema.index({ name: "text", description: "text" });

export const MenuItemModel = model<MenuItem>("MenuItem", menuItemSchema);
