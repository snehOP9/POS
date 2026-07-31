import { Router } from "express";

import { asyncHandler } from "../lib/asyncHandler.js";
import { notFound } from "../lib/errors.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { CategoryModel } from "../models/Category.js";
import { MenuItemModel } from "../models/MenuItem.js";
import { createNotification } from "../services/notification.service.js";
import { getSingleRestaurant, publicRestaurant } from "../services/restaurant.service.js";
import {
  createCategoryRequestSchema,
  createMenuItemRequestSchema,
  menuItemParamsSchema,
  menuQuerySchema,
  updateMenuAvailabilityRequestSchema
} from "./schemas.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function displayStation(station: string): string {
  return station.toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}

export const menuRouter = Router();

menuRouter.get("/", validateRequest(menuQuerySchema), asyncHandler(async (request, response) => {
  const query = validatedQuery<{
    search?: string;
    category?: string;
    vegetarian?: "true" | "false";
    available?: "true" | "false";
    featured?: "true" | "false";
  }>(request);
  const restaurant = await getSingleRestaurant();
  const filter: Record<string, unknown> = {
    restaurantId: restaurant._id,
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.available ? { available: query.available === "true" } : { available: true }),
    ...(query.featured ? { featured: query.featured === "true" } : {}),
    ...(query.vegetarian === "true" ? { foodType: { $in: ["VEGETARIAN", "VEGAN"] } } : {})
  };
  if (query.search) filter.$text = { $search: query.search };
  const [categories, menuItems] = await Promise.all([
    CategoryModel.find({ restaurantId: restaurant._id, visible: true }).sort({ sortOrder: 1, name: 1 }),
    query.search
      ? MenuItemModel.find(filter).sort({ score: { $meta: "textScore" }, featured: -1, name: 1 })
      : MenuItemModel.find(filter).sort({ featured: -1, name: 1 })
  ]);
  const categoriesById = new Map(categories.map((category) => [category._id.toString(), category]));
  const items = menuItems.map((item) => {
    const category = categoriesById.get(item.categoryId.toString());
    return {
      id: item._id.toString(),
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      category: category ? { id: category._id.toString(), name: category.name } : undefined,
      categoryId: item.categoryId.toString(),
      price: item.basePricePaise / 100,
      basePricePaise: item.basePricePaise,
      currency: restaurant.currency,
      foodType: item.foodType,
      allergens: item.allergens,
      spiceLevel: item.spiceLevel,
      available: item.available,
      featured: item.featured,
      station: displayStation(item.station),
      stationCode: item.station,
      prepMinutes: item.preparationMinutes,
      preparationMinutes: item.preparationMinutes,
      variants: item.variants,
      modifierGroups: item.modifierGroups
    };
  });
  sendSuccess(response, {
    restaurant: publicRestaurant(restaurant),
    categories: categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder
    })),
    items
  });
}));

menuRouter.get("/:id", validateRequest(menuItemParamsSchema), asyncHandler(async (request, response) => {
  const restaurant = await getSingleRestaurant();
  const item = await MenuItemModel.findOne({ _id: validatedParam(request, "id"), restaurantId: restaurant._id, available: true });
  if (!item) throw notFound("MENU_ITEM_NOT_FOUND", "Menu item was not found");
  sendSuccess(response, {
    id: item._id.toString(),
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    basePricePaise: item.basePricePaise,
    price: item.basePricePaise / 100,
    foodType: item.foodType,
    allergens: item.allergens,
    spiceLevel: item.spiceLevel,
    available: item.available,
    station: displayStation(item.station),
    stationCode: item.station,
    prepMinutes: item.preparationMinutes,
    variants: item.variants,
    modifierGroups: item.modifierGroups
  });
}));

menuRouter.post("/categories", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(createCategoryRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const category = await CategoryModel.create({ restaurantId: actor.restaurantId, ...(request.body as object) });
  sendSuccess(response, { id: category._id.toString(), name: category.name, visible: category.visible }, 201);
}));

menuRouter.post("/items", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(createMenuItemRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const body = request.body as { categoryId: string } & Record<string, unknown>;
  const category = await CategoryModel.findOne({ _id: body.categoryId, restaurantId: actor.restaurantId });
  if (!category) throw notFound("CATEGORY_NOT_FOUND", "Category was not found");
  const item = await MenuItemModel.create({ restaurantId: actor.restaurantId, ...body });
  sendSuccess(response, { id: item._id.toString(), name: item.name, available: item.available }, 201);
}));

menuRouter.patch("/items/:id/availability", requireAuth, requireRole("CASHIER"), requirePermission("canEditMenuAvailability"), validateRequest(updateMenuAvailabilityRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const { available } = request.body as { available: boolean };
  const item = await MenuItemModel.findOneAndUpdate(
    { _id: validatedParam(request, "id"), restaurantId: actor.restaurantId },
    { $set: { available } },
    { new: true, runValidators: true }
  );
  if (!item) throw notFound("MENU_ITEM_NOT_FOUND", "Menu item was not found");
  await createNotification({
    restaurantId: actor.restaurantId,
    role: "CASHIER",
    type: "MENU_AVAILABILITY_CHANGED",
    title: "Menu availability changed",
    message: `${item.name} is now ${available ? "available" : "unavailable"}`,
    entityType: "MenuItem",
    entityId: item._id.toString()
  });
  sendSuccess(response, { id: item._id.toString(), available: item.available });
}));
