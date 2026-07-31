import type { KitchenStation, MenuItem } from "@/shared/types/domain";

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

export const normalizeMenuPayload = (payload: unknown): MenuItem[] => {
  const data = asRecord(payload);
  const rawItems = Array.isArray(data?.items) ? data.items : Array.isArray(payload) ? payload : [];
  return rawItems.flatMap((raw, index) => {
    const item = asRecord(raw);
    if (!item) return [];
    const categoryRecord = asRecord(item.category);
    const foodType = typeof item.foodType === "string" ? item.foodType.toUpperCase() : "";
    const isVegan = item.dietary === "vegan" || foodType === "VEGAN";
    const isVegetarian = item.isVegetarian === true || item.dietary === "veg" || isVegan || foodType === "VEGETARIAN";
    const dietary = isVegan ? "vegan" : isVegetarian ? "veg" : "non-veg";
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [];
    return [{
      id: readString(item.id ?? item._id, `remote-${index}`),
      name: readString(item.name, "Seasonal dish"),
      description: readString(item.description, "Prepared fresh by our kitchen."),
      category: readString(categoryRecord?.name ?? item.categoryName ?? item.category, "Kitchen specials"),
      price: typeof item.basePricePaise === "number" ? item.basePricePaise / 100 : readNumber(item.price ?? item.basePrice, 0),
      prepMinutes: readNumber(item.prepMinutes ?? item.preparationTime ?? item.preparationMinutes, 12),
      station: toStation(item.station),
      dietary,
      heat: Math.min(3, readNumber(item.heatLevel ?? item.spiceLevel, 0)) as 0 | 1 | 2 | 3,
      featured: item.featured === true || item.isFeatured === true,
      unavailable: item.available === false || item.isAvailable === false,
      color: colorWheel[index % colorWheel.length],
      glyph: readString(item.name, "D").slice(0, 1).toUpperCase(),
      tags,
    }];
  });
};
