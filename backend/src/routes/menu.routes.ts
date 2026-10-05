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
import { effectiveBasePricePaise } from "../services/pricing.service.js";
import { getSingleRestaurant, ownerRestaurant, publicRestaurant } from "../services/restaurant.service.js";
import { emitToRole } from "../services/socket.service.js";
import {
  createCategoryRequestSchema,
  createMenuItemRequestSchema,
  menuItemParamsSchema,
  menuQuerySchema,
  updateMenuItemRequestSchema,
  updateMenuAvailabilityRequestSchema
} from "./schemas.js";


function displayStation(station: string): string {
  return station.toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix: string, letter: string) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}

function publishMenuChanged(restaurantId: string, action: "created" | "updated" | "archived" | "availability", itemId?: string): void {
  const payload = { action, itemId, occurredAt: new Date().toISOString() };
  for (const role of ["CASHIER", "WAITER", "CUSTOMER"] as const) emitToRole(restaurantId, role, "menu:updated", payload);
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
    archived: { $ne: true },
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
      price: effectiveBasePricePaise(item) / 100,
      basePricePaise: item.basePricePaise,
      offer: item.offer,
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

menuRouter.get("/manage/catalogue", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const restaurant = await getSingleRestaurant();
  const [categories, menuItems] = await Promise.all([
    CategoryModel.find({ restaurantId: actor.restaurantId }).sort({ sortOrder: 1, name: 1 }),
    MenuItemModel.find({ restaurantId: actor.restaurantId, archived: { $ne: true } }).sort({ featured: -1, name: 1 })
  ]);
  const categoriesById = new Map(categories.map((category) => [category._id.toString(), category]));
  sendSuccess(response, {
    restaurant: ownerRestaurant(restaurant),
    categories: categories.map((category) => ({ id: category._id.toString(), name: category.name, description: category.description, imageUrl: category.imageUrl, sortOrder: category.sortOrder, visible: category.visible })),
    items: menuItems.map((item) => {
      const category = categoriesById.get(item.categoryId.toString());
      return { id: item._id.toString(), name: item.name, description: item.description, imageUrl: item.imageUrl, category: category ? { id: category._id.toString(), name: category.name } : undefined, categoryId: item.categoryId.toString(), price: effectiveBasePricePaise(item) / 100, basePricePaise: item.basePricePaise, offer: item.offer, currency: restaurant.currency, foodType: item.foodType, allergens: item.allergens, spiceLevel: item.spiceLevel, available: item.available, featured: item.featured, station: displayStation(item.station), stationCode: item.station, prepMinutes: item.preparationMinutes, preparationMinutes: item.preparationMinutes, variants: item.variants, modifierGroups: item.modifierGroups };
    })
  });
}));
menuRouter.get("/:id", validateRequest(menuItemParamsSchema), asyncHandler(async (request, response) => {
  const restaurant = await getSingleRestaurant();
  const item = await MenuItemModel.findOne({ _id: validatedParam(request, "id"), restaurantId: restaurant._id, available: true, archived: { $ne: true } });
  if (!item) throw notFound("MENU_ITEM_NOT_FOUND", "Menu item was not found");
  sendSuccess(response, {
    id: item._id.toString(),
    name: item.name,
    description: item.description,
    imageUrl: item.imageUrl,
    basePricePaise: item.basePricePaise,
    price: effectiveBasePricePaise(item) / 100,
    offer: item.offer,
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
  publishMenuChanged(actor.restaurantId, "updated");
  sendSuccess(response, { id: category._id.toString(), name: category.name, visible: category.visible }, 201);
}));

menuRouter.post("/items", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(createMenuItemRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const body = request.body as { categoryId: string } & Record<string, unknown>;
  const category = await CategoryModel.findOne({ _id: body.categoryId, restaurantId: actor.restaurantId });
  if (!category) throw notFound("CATEGORY_NOT_FOUND", "Category was not found");
  const item = await MenuItemModel.create({ restaurantId: actor.restaurantId, ...body });
  publishMenuChanged(actor.restaurantId, "created", item._id.toString());
  sendSuccess(response, { id: item._id.toString(), name: item.name, available: item.available }, 201);
}));

menuRouter.patch("/items/:id", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(updateMenuItemRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const body = request.body as { categoryId?: string; offer?: unknown } & Record<string, unknown>;
  if (body.categoryId) {
    const category = await CategoryModel.findOne({ _id: body.categoryId, restaurantId: actor.restaurantId });
    if (!category) throw notFound("CATEGORY_NOT_FOUND", "Category was not found");
  }
  const update = { ...body };
  const clearOffer = update.offer === null;
  if (clearOffer) delete update.offer;
  const item = await MenuItemModel.findOneAndUpdate({ _id: validatedParam(request, "id"), restaurantId: actor.restaurantId, archived: { $ne: true } }, clearOffer ? { $set: update, $unset: { offer: 1 } } : { $set: update }, { new: true, runValidators: true });
  if (!item) throw notFound("MENU_ITEM_NOT_FOUND", "Menu item was not found");
  publishMenuChanged(actor.restaurantId, "updated", item._id.toString());
  sendSuccess(response, { id: item._id.toString(), name: item.name, price: effectiveBasePricePaise(item) / 100, basePricePaise: item.basePricePaise, offer: item.offer, available: item.available });
}));

menuRouter.delete("/items/:id", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(menuItemParamsSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const item = await MenuItemModel.findOneAndUpdate({ _id: validatedParam(request, "id"), restaurantId: actor.restaurantId, archived: { $ne: true } }, { $set: { archived: true, available: false } }, { new: true, runValidators: true });
  if (!item) throw notFound("MENU_ITEM_NOT_FOUND", "Menu item was not found");
  publishMenuChanged(actor.restaurantId, "archived", item._id.toString());
  sendSuccess(response, { id: item._id.toString(), archived: true });
}));
menuRouter.patch("/items/:id/availability", requireAuth, requireRole("CASHIER"), requirePermission("canEditMenuAvailability"), validateRequest(updateMenuAvailabilityRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const { available } = request.body as { available: boolean };
  const item = await MenuItemModel.findOneAndUpdate(
    { _id: validatedParam(request, "id"), restaurantId: actor.restaurantId, archived: { $ne: true } },
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
  publishMenuChanged(actor.restaurantId, "availability", item._id.toString());
  sendSuccess(response, { id: item._id.toString(), available: item.available });
}));
