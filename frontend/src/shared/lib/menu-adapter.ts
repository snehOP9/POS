import type { KitchenStation, MenuCategory, MenuItem, MenuModifierGroup, MenuModifierOption, MenuVariant, RestaurantPricingConfig } from "@/shared/types/domain";
import { fallbackRestaurantPricing } from "@/shared/lib/cart";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === "object" && value !== null ? value as UnknownRecord : undefined;

const readString = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;
const readNumber = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? value : fallback;

const validStations: KitchenStation[] = ["Hot", "Tandoor", "Cold", "Bar"];
const toStation = (value: unknown): KitchenStation => {
  if (validStations.includes(value as KitchenStation)) return value as KitchenStation;
  const station = typeof value === "string" ? value.toUpperCase() : "";
  if (station.includes("TANDOOR") || station.includes("GRILL")) return "Tandoor";
  if (station.includes("COLD") || station.includes("DESSERT")) return "Cold";
  if (station.includes("BAR") || station.includes("DRINK")) return "Bar";
  return "Hot";
};

const colorWheel = ["butter", "mushroom", "prawn", "millet", "kokum", "paneer", "kheer", "lamb"];

const variants = (value: unknown): MenuVariant[] => Array.isArray(value) ? value.flatMap((raw) => {
  const variant = asRecord(raw);
  if (!variant || typeof variant.id !== "string" || typeof variant.name !== "string") return [];
  return [{ id: variant.id, name: variant.name, priceDelta: typeof variant.priceDeltaPaise === "number" ? variant.priceDeltaPaise / 100 : readNumber(variant.priceDelta, 0), available: variant.available !== false }];
}) : [];

const modifierOptions = (value: unknown): MenuModifierOption[] => Array.isArray(value) ? value.flatMap((raw) => {
  const option = asRecord(raw);
  if (!option || typeof option.id !== "string" || typeof option.name !== "string") return [];
  return [{ id: option.id, name: option.name, priceDelta: typeof option.priceDeltaPaise === "number" ? option.priceDeltaPaise / 100 : readNumber(option.priceDelta, 0), available: option.available !== false }];
}) : [];

const modifierGroups = (value: unknown): MenuModifierGroup[] => Array.isArray(value) ? value.flatMap((raw) => {
  const group = asRecord(raw);
  if (!group || typeof group.id !== "string" || typeof group.name !== "string") return [];
  return [{
    id: group.id,
    name: group.name,
    minSelections: Math.max(0, readNumber(group.minSelections, 0)),
    maxSelections: Math.max(0, readNumber(group.maxSelections, 1)),
    options: modifierOptions(group.options),
  }];
}) : [];

export const normalizeRestaurantPricing = (payload: unknown): RestaurantPricingConfig => {
  const data = asRecord(payload);
  const restaurant = asRecord(data?.restaurant);
  const tax = asRecord(restaurant?.tax);
  const serviceCharge = asRecord(restaurant?.serviceCharge);
  return {
    currency: readString(restaurant?.currency, fallbackRestaurantPricing.currency),
    tax: {
      enabled: tax?.enabled === true,
      rateBasisPoints: Math.max(0, Math.min(10_000, readNumber(tax?.rateBasisPoints, fallbackRestaurantPricing.tax.rateBasisPoints))),
      inclusive: tax?.inclusive === true,
    },
    serviceCharge: {
      enabled: serviceCharge?.enabled === true,
      rateBasisPoints: Math.max(0, Math.min(10_000, readNumber(serviceCharge?.rateBasisPoints, fallbackRestaurantPricing.serviceCharge.rateBasisPoints))),
    },
  };
};

export const normalizeMenuPayload = (payload: unknown): MenuItem[] => {
  const data = asRecord(payload);
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(payload) ? payload : [];
  return rawItems.flatMap((raw, index) => {
    const item = asRecord(raw);
    if (!item) return [];
    const categoryRecord = asRecord(item.category);
    const foodType = typeof item.foodType === "string" ? item.foodType.toUpperCase() : "";
    const rawOffer = asRecord(item.offer);
    const basePrice = typeof item.basePricePaise === "number" ? item.basePricePaise / 100 : readNumber(item.basePrice, readNumber(item.price, 0));
    const isVegan = item.dietary === "vegan" || foodType === "VEGAN";
    const isVegetarian = item.isVegetarian === true || item.dietary === "veg" || isVegan || foodType === "VEGETARIAN";
    const dietary = isVegan ? "vegan" : isVegetarian ? "veg" : "non-veg";
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [];
    return [{
      id: readString(item.id ?? item._id, `remote-${index}`),
      name: readString(item.name, "Seasonal dish"),
      description: readString(item.description, "Prepared fresh by our kitchen."),
      category: readString(categoryRecord?.name ?? item.categoryName ?? item.category, "Kitchen specials"),
      categoryId: typeof item.categoryId === "string" ? item.categoryId : typeof categoryRecord?.id === "string" ? categoryRecord.id : undefined,
      price: readNumber(item.price, basePrice),
      basePrice,
      offer: rawOffer && typeof rawOffer.percentage === "number" && typeof rawOffer.label === "string" ? { percentage: rawOffer.percentage, label: rawOffer.label } : undefined,
      imageUrl: typeof item.imageUrl === "string" && item.imageUrl.trim() ? item.imageUrl : undefined,
      prepMinutes: readNumber(item.prepMinutes ?? item.preparationTime ?? item.preparationMinutes, 12),
      station: toStation(item.station),
      dietary,
      heat: Math.min(3, readNumber(item.heatLevel ?? item.spiceLevel, 0)) as 0 | 1 | 2 | 3,
      featured: item.featured === true || item.isFeatured === true,
      unavailable: item.available === false || item.isAvailable === false,
      color: colorWheel[index % colorWheel.length],
      glyph: readString(item.name, "D").slice(0, 1).toUpperCase(),
      tags,
      variants: variants(item.variants),
      modifierGroups: modifierGroups(item.modifierGroups),
    }];
  });
};

export const normalizeMenuCategories = (payload: unknown): MenuCategory[] => {
  const data = asRecord(payload);
  const rawCategories = Array.isArray(data?.categories) ? data.categories : [];
  return rawCategories.flatMap((raw, index) => {
    const category = asRecord(raw);
    if (!category) return [];
    return [{
      id: readString(category.id ?? category._id, `category-${index}`),
      name: readString(category.name, "Uncategorized"),
      description: typeof category.description === "string" ? category.description : undefined,
      imageUrl: typeof category.imageUrl === "string" && category.imageUrl.trim() ? category.imageUrl : undefined,
      sortOrder: readNumber(category.sortOrder, index),
      visible: category.visible !== false,
    }];
  });
};