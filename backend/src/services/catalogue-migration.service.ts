import { logger } from "../config/logger.js";
import { CategoryModel } from "../models/Category.js";
import { MenuItemModel } from "../models/MenuItem.js";
import { RestaurantConfigModel } from "../models/RestaurantConfig.js";
import { guestCatalogueAdditions } from "../scripts/seed-catalogue.js";

const DEMO_RESTAURANT_NAME = "EmberServe Demo Restaurant";

const categorySpecs = [
  { name: "Seasonal Signatures", description: "Limited-run dishes shaped by the market and the fire.", imageId: "28675074", sortOrder: 13 },
  { name: "For the Table", description: "Generous sharing plates made for two or more.", imageId: "33430556", sortOrder: 14 },
  { name: "Chai & Coffee", description: "Slow-brewed tea and coffee for the end, or the pause.", imageId: "17200460", sortOrder: 15 }
] as const;

const pexels = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;

/**
 * Inserts the public catalogue expansion for the demo restaurant exactly once.
 * Existing categories and dishes are deliberately untouched so operational
 * changes made in the staff workspace always win over this release migration.
 */
export async function ensureGuestCatalogueAdditions(): Promise<void> {
  const restaurant = await RestaurantConfigModel.findOne({ name: DEMO_RESTAURANT_NAME }).select("_id").lean();
  if (!restaurant) return;

  const categoryNames = categorySpecs.map(({ name }) => name);
  const existingCategories = await CategoryModel.find({ restaurantId: restaurant._id, name: { $in: categoryNames } }).select("_id name").lean();
  const existingCategoryNames = new Set(existingCategories.map((category) => category.name));
  const missingCategorySpecs = categorySpecs.filter(({ name }) => !existingCategoryNames.has(name));

  if (missingCategorySpecs.length > 0) {
    await Promise.all(missingCategorySpecs.map((spec) => CategoryModel.create({
      restaurantId: restaurant._id,
      name: spec.name,
      description: spec.description,
      imageUrl: pexels(spec.imageId),
      sortOrder: spec.sortOrder,
      visible: true
    })));
  }

  const categories = await CategoryModel.find({ restaurantId: restaurant._id, name: { $in: categoryNames } }).select("_id name").lean();
  const categoryByName = new Map(categories.map((category) => [category.name, category._id]));
  const additions = guestCatalogueAdditions(pexels);
  const itemNames = additions.map((item) => item.name);
  const existingItems = await MenuItemModel.find({ restaurantId: restaurant._id, name: { $in: itemNames } }).select("name").lean();
  const existingItemNames = new Set(existingItems.map((item) => item.name));
  const missingItems = additions.filter((item) => !existingItemNames.has(item.name));

  if (missingItems.length > 0) {
    await MenuItemModel.insertMany(missingItems.map((item) => {
      const categoryId = categoryByName.get(item.category);
      if (!categoryId) throw new Error(`Missing category while adding guest catalogue: ${item.category}`);
      return {
        ...item,
        restaurantId: restaurant._id,
        categoryId,
        available: true,
        archived: false,
        allergens: [],
        spiceLevel: 0
      };
    }));
  }

  if (missingCategorySpecs.length > 0 || missingItems.length > 0) {
    logger.info(
      { restaurantId: restaurant._id.toString(), addedCategories: missingCategorySpecs.length, addedItems: missingItems.length },
      "Applied guest catalogue expansion"
    );
  }
}
