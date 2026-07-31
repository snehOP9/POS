import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { CASHIER_SUPERVISOR_PERMISSIONS } from "../domain/access.js";
import { opaqueToken } from "../lib/ids.js";
import { AccountModel } from "../models/Account.js";
import { CategoryModel } from "../models/Category.js";
import { DiningTableModel } from "../models/DiningTable.js";
import { MenuItemModel } from "../models/MenuItem.js";
import { RestaurantConfigModel } from "../models/RestaurantConfig.js";
import { hashPassword } from "../services/auth.service.js";

async function seed(): Promise<void> {
  if (env.NODE_ENV === "production" && !env.ALLOW_PRODUCTION_SEED) {
    throw new Error("Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true only for an intentional, controlled demo seed.");
  }
  const demoPassword = env.SEED_DEMO_PASSWORD ?? (env.NODE_ENV === "development" ? "demo-password" : undefined);
  if (!demoPassword) {
    throw new Error("SEED_DEMO_PASSWORD is required outside development");
  }
  await connectDatabase();
  const restaurant = await RestaurantConfigModel.findOneAndUpdate(
    { name: "EmberServe Demo Restaurant" },
    {
      $set: {
        tagline: "Fire, flavour, and faster service.",
        description: "A production-shaped demonstration restaurant for EmberServe POS.",
        currency: "INR",
        timezone: env.RESTAURANT_TIMEZONE,
        tax: { enabled: true, rateBasisPoints: 500, inclusive: false },
        serviceCharge: { enabled: false, rateBasisPoints: 0 },
        invoicePrefix: "EMBER",
        receiptFooter: "Thank you for dining with EmberServe.",
        razorpayPublicKey: env.RAZORPAY_KEY_ID,
        tableCount: 12,
        orderingModes: ["DINE_IN", "PICKUP", "COUNTER"],
        deliveryEnabled: false,
        primaryColor: "#F59E0B",
        secondaryColor: "#1C1917"
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!restaurant) throw new Error("Unable to create restaurant configuration");

  const passwordHash = await hashPassword(demoPassword);
  const accounts = await Promise.all([
    AccountModel.findOneAndUpdate(
      { restaurantId: restaurant._id, email: "cashier@ember.local" },
      { $set: { displayName: "Aarav Cashier", passwordHash, role: "CASHIER", permissions: CASHIER_SUPERVISOR_PERMISSIONS, active: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ),
    AccountModel.findOneAndUpdate(
      { restaurantId: restaurant._id, email: "waiter@ember.local" },
      { $set: { displayName: "Mira Waiter", passwordHash, role: "WAITER", permissions: [], active: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ),
    AccountModel.findOneAndUpdate(
      { restaurantId: restaurant._id, email: "kitchen@ember.local" },
      { $set: { displayName: "Kabir Kitchen", passwordHash, role: "KITCHEN", permissions: [], active: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ),
    AccountModel.findOneAndUpdate(
      { restaurantId: restaurant._id, email: "guest@ember.local" },
      { $set: { displayName: "Guest Customer", passwordHash, role: "CUSTOMER", permissions: [], active: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
  ]);
  const waiter = accounts[1];
  if (!waiter) throw new Error("Unable to create waiter account");

  const categorySpecs = [
    { name: "Small Plates", description: "Bright starters for the table.", sortOrder: 1 },
    { name: "From the Fire", description: "Charcoal-kissed main dishes.", sortOrder: 2 },
    { name: "Rice & Breads", description: "Comforting accompaniments.", sortOrder: 3 },
    { name: "Coolers", description: "Freshly mixed drinks.", sortOrder: 4 }
  ];
  const categories = await Promise.all(categorySpecs.map((spec) => CategoryModel.findOneAndUpdate(
    { restaurantId: restaurant._id, name: spec.name },
    { $set: { ...spec, visible: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )));
  const categoryByName = new Map(categories.filter(Boolean).map((category) => [category?.name ?? "", category]));
  const categoryId = (name: string) => {
    const category = categoryByName.get(name);
    if (!category) throw new Error(`Missing seed category: ${name}`);
    return category._id;
  };

  const menuSpecs = [
    {
      name: "Saffron Paneer Tikka", category: "Small Plates", description: "Charred paneer, kasundi glaze, mint ash.", basePricePaise: 42500,
      foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 14, featured: true,
      variants: [], modifierGroups: [{ id: "heat", name: "Heat level", minSelections: 0, maxSelections: 1, options: [{ id: "heat-mild", name: "Mild", priceDeltaPaise: 0, available: true }, { id: "heat-hot", name: "Extra hot", priceDeltaPaise: 0, available: true }] }]
    },
    {
      name: "Smoky Butter Chicken", category: "From the Fire", description: "Charcoal chicken in slow-simmered tomato makhani.", basePricePaise: 52500,
      foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 18, featured: true,
      variants: [{ id: "half", name: "Half", priceDeltaPaise: -12000, available: true }, { id: "full", name: "Full", priceDeltaPaise: 0, available: true }], modifierGroups: []
    },
    {
      name: "Ember Dal Makhani", category: "From the Fire", description: "Black lentils, roasted garlic and cultured butter.", basePricePaise: 34500,
      foodType: "VEGETARIAN", station: "HOT", preparationMinutes: 12, featured: false, variants: [], modifierGroups: []
    },
    {
      name: "Saffron Jeera Rice", category: "Rice & Breads", description: "Aromatic basmati with cumin and saffron.", basePricePaise: 18000,
      foodType: "VEGETARIAN", station: "HOT", preparationMinutes: 8, featured: false, variants: [], modifierGroups: []
    },
    {
      name: "Tandoor Naan", category: "Rice & Breads", description: "Hand-stretched naan from the clay oven.", basePricePaise: 6500,
      foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 5, featured: false,
      variants: [], modifierGroups: [{ id: "naan-style", name: "Finish", minSelections: 0, maxSelections: 1, options: [{ id: "naan-plain", name: "Plain", priceDeltaPaise: 0, available: true }, { id: "naan-garlic", name: "Garlic butter", priceDeltaPaise: 2500, available: true }] }]
    },
    {
      name: "Kokum Sparkler", category: "Coolers", description: "Kokum, lime, black salt and soda.", basePricePaise: 17500,
      foodType: "VEGAN", station: "BAR", preparationMinutes: 4, featured: true, variants: [], modifierGroups: []
    }
  ] as const;
  await Promise.all(menuSpecs.map((spec) => MenuItemModel.findOneAndUpdate(
    { restaurantId: restaurant._id, name: spec.name },
    { $set: { ...spec, categoryId: categoryId(spec.category), available: true, allergens: [], spiceLevel: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )));

  await Promise.all(Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    return DiningTableModel.findOneAndUpdate(
      { restaurantId: restaurant._id, number },
      {
        $set: { label: `Table ${number}`, capacity: number <= 4 ? 4 : 6, zone: number <= 6 ? "Courtyard" : "Dining Room", orderingEnabled: true, assignedWaiterId: waiter._id },
        $setOnInsert: { qrToken: opaqueToken(), status: "AVAILABLE" }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }));

  logger.info({ restaurantId: restaurant._id.toString() }, "Seed complete");
  logger.info({ demoPassword: env.NODE_ENV === "development" ? demoPassword : "configured via SEED_DEMO_PASSWORD" }, "Demo credentials: cashier@ember.local, waiter@ember.local, kitchen@ember.local, guest@ember.local");
}

seed()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
