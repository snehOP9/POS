import { Types } from "mongoose";

import { badRequest, conflict } from "../lib/errors.js";
import { lineId } from "../lib/ids.js";
import type { MenuItem } from "../models/MenuItem.js";
import { MenuItemModel } from "../models/MenuItem.js";
import type { OrderItemSnapshot, OrderPricing } from "../models/Order.js";
import type { RestaurantConfig } from "../models/RestaurantConfig.js";

export interface OrderLineInput {
  menuItemId: string;
  quantity: number;
  variantId?: string;
  modifierOptionIds?: string[];
  note?: string;
}

export interface PriceQuote {
  items: OrderItemSnapshot[];
  pricing: OrderPricing;
}

function percentageOf(amountPaise: number, basisPoints: number): number {
  return Math.round((amountPaise * basisPoints) / 10_000);
}

function createPricing(restaurant: RestaurantConfig, subtotalPaise: number, discountPaise = 0): OrderPricing {
  const taxPaise = restaurant.tax.enabled
    ? restaurant.tax.inclusive
      ? Math.round((subtotalPaise * restaurant.tax.rateBasisPoints) / (10_000 + restaurant.tax.rateBasisPoints))
      : percentageOf(subtotalPaise, restaurant.tax.rateBasisPoints)
    : 0;
  const serviceChargePaise = restaurant.serviceCharge.enabled
    ? percentageOf(subtotalPaise, restaurant.serviceCharge.rateBasisPoints)
    : 0;
  const beforeDiscountPaise = subtotalPaise + (restaurant.tax.inclusive ? 0 : taxPaise) + serviceChargePaise;
  if (discountPaise > beforeDiscountPaise) {
    throw badRequest("DISCOUNT_EXCEEDS_TOTAL", "Discount cannot exceed the current total");
  }
  return {
    currency: restaurant.currency,
    subtotalPaise,
    taxPaise,
    serviceChargePaise,
    discountPaise,
    grandTotalPaise: beforeDiscountPaise - discountPaise
  };
}

function itemSnapshot(menuItem: MenuItem & { _id: Types.ObjectId }, input: OrderLineInput): OrderItemSnapshot {
  if (!menuItem.available) {
    throw conflict("MENU_ITEM_UNAVAILABLE", `${menuItem.name} is currently unavailable`);
  }

  const variant = input.variantId ? menuItem.variants.find((entry) => entry.id === input.variantId) : undefined;
  if (input.variantId && !variant) {
    throw badRequest("VARIANT_SELECTION_INVALID", `The selected variant is not valid for ${menuItem.name}`);
  }
  if (variant && !variant.available) {
    throw conflict("MENU_ITEM_UNAVAILABLE", `${menuItem.name} variant is currently unavailable`);
  }

  const requestedOptionIds = input.modifierOptionIds ?? [];
  if (new Set(requestedOptionIds).size !== requestedOptionIds.length) {
    throw badRequest("MODIFIER_SELECTION_INVALID", "A modifier cannot be selected twice");
  }

  const requestedIds = new Set(requestedOptionIds);
  const modifiers: OrderItemSnapshot["modifiers"] = [];
  const matchedIds = new Set<string>();

  for (const group of menuItem.modifierGroups) {
    const selected = group.options.filter((option) => requestedIds.has(option.id));
    if (selected.length < group.minSelections || selected.length > group.maxSelections) {
      throw badRequest("MODIFIER_SELECTION_INVALID", `${group.name} requires ${group.minSelections}–${group.maxSelections} selections`);
    }
    for (const option of selected) {
      if (!option.available) {
        throw conflict("MENU_ITEM_UNAVAILABLE", `${option.name} is currently unavailable`);
      }
      matchedIds.add(option.id);
      modifiers.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDeltaPaise: option.priceDeltaPaise
      });
    }
  }

  if (matchedIds.size !== requestedIds.size) {
    throw badRequest("MODIFIER_SELECTION_INVALID", `An unknown modifier was selected for ${menuItem.name}`);
  }

  const modifierPricePaise = modifiers.reduce((total, modifier) => total + modifier.priceDeltaPaise, 0);
  const unitPricePaise = menuItem.basePricePaise + (variant?.priceDeltaPaise ?? 0) + modifierPricePaise;
  const snapshot: OrderItemSnapshot = {
    lineId: lineId(),
    menuItemId: menuItem._id,
    name: menuItem.name,
    quantity: input.quantity,
    unitBasePricePaise: menuItem.basePricePaise,
    modifiers,
    unitPricePaise,
    lineSubtotalPaise: unitPricePaise * input.quantity,
    status: "PENDING",
    station: menuItem.station
  };
  if (menuItem.imageUrl) snapshot.imageUrl = menuItem.imageUrl;
  if (variant) {
    snapshot.variant = {
      id: variant.id,
      name: variant.name,
      priceDeltaPaise: variant.priceDeltaPaise
    };
  }
  if (input.note) snapshot.note = input.note;
  return snapshot;
}

export async function priceOrder(
  restaurant: RestaurantConfig & { _id: Types.ObjectId },
  requestedLines: OrderLineInput[],
  discountPaise = 0
): Promise<PriceQuote> {
  const menuItemIds = requestedLines.map((line) => line.menuItemId);
  const menuItems = await MenuItemModel.find({
    restaurantId: restaurant._id,
    _id: { $in: menuItemIds }
  });
  const itemsById = new Map(menuItems.map((menuItem) => [menuItem._id.toString(), menuItem]));

  const items = requestedLines.map((input) => {
    const menuItem = itemsById.get(input.menuItemId);
    if (!menuItem) throw badRequest("MENU_ITEM_NOT_FOUND", "A requested menu item does not exist");
    return itemSnapshot(menuItem, input);
  });
  const subtotalPaise = items.reduce((total, item) => total + item.lineSubtotalPaise, 0);
  return { items, pricing: createPricing(restaurant, subtotalPaise, discountPaise) };
}

export function repriceDiscount(restaurant: RestaurantConfig, orderItems: OrderItemSnapshot[], discountPaise: number): OrderPricing {
  const subtotalPaise = orderItems
    .filter((item) => item.status !== "CANCELLED")
    .reduce((total, item) => total + item.lineSubtotalPaise, 0);
  return createPricing(restaurant, subtotalPaise, discountPaise);
}
