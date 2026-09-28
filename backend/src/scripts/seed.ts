import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { CASHIER_SUPERVISOR_PERMISSIONS } from "../domain/access.js";
import { opaqueToken } from "../lib/ids.js";
import { AccountModel } from "../models/Account.js";
import { CategoryModel } from "../models/Category.js";
import { expandedCatalogue } from "./seed-catalogue.js";
import { DiningTableModel } from "../models/DiningTable.js";
import { MenuItemModel } from "../models/MenuItem.js";
import { RestaurantConfigModel } from "../models/RestaurantConfig.js";
import { hashPassword } from "../services/auth.service.js";

async function seed(): Promise<void> {
  if (env.NODE_ENV === "production" && !env.ALLOW_PRODUCTION_SEED) {
    throw new Error("Refusing to seed production. Set ALLOW_PRODUCTION_SEED=true only for an intentional, controlled demo seed.");
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

  const existingAccounts = await AccountModel.find({ restaurantId: restaurant._id });
  const createdDemoAccounts = existingAccounts.length === 0;
  let waiter = existingAccounts.find((account) => account.role === "WAITER" && account.active);

  if (createdDemoAccounts) {
    const demoPassword = env.SEED_DEMO_PASSWORD ?? (env.NODE_ENV === "development" ? "demo-password" : undefined);
    if (!demoPassword) {
      throw new Error("SEED_DEMO_PASSWORD is required only when creating fresh demo accounts outside development");
    }
    const passwordHash = await hashPassword(demoPassword);
    const accounts = await Promise.all([
      AccountModel.create({ restaurantId: restaurant._id, email: "cashier@ember.local", displayName: "Aarav Cashier", passwordHash, role: "CASHIER", permissions: CASHIER_SUPERVISOR_PERMISSIONS, active: true }),
      AccountModel.create({ restaurantId: restaurant._id, email: "waiter@ember.local", displayName: "Mira Waiter", passwordHash, role: "WAITER", permissions: [], active: true }),
      AccountModel.create({ restaurantId: restaurant._id, email: "kitchen@ember.local", displayName: "Kabir Kitchen", passwordHash, role: "KITCHEN", permissions: [], active: true }),
      AccountModel.create({ restaurantId: restaurant._id, email: "guest@ember.local", displayName: "Guest Customer", passwordHash, role: "CUSTOMER", permissions: [], active: true })
    ]);
    waiter = accounts.find((account) => account.role === "WAITER");
    logger.info({ restaurantId: restaurant._id.toString() }, "Created fresh demo staff accounts");
  } else {
    logger.info({ restaurantId: restaurant._id.toString(), accountCount: existingAccounts.length }, "Preserved existing staff accounts and credentials");
  }

  if (!waiter) throw new Error("Unable to find an active waiter account; refusing to modify existing staff");

  const pexels = (id: string) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1200`;
  const categorySpecs = [
    { name: "Small Plates", description: "Bright starters for the table.", imageUrl: pexels("21078315"), sortOrder: 1 },
    { name: "From the Fire", description: "Charcoal-kissed dishes from the tandoor.", imageUrl: pexels("33430556"), sortOrder: 2 },
    { name: "Mains", description: "Comforting curries and signature bowls.", imageUrl: pexels("36009039"), sortOrder: 3 },
    { name: "Rice & Breads", description: "Aromatic rice and fresh flatbreads.", imageUrl: pexels("20446413"), sortOrder: 4 },
    { name: "Coolers", description: "Freshly mixed, zero-proof drinks.", imageUrl: pexels("17200460"), sortOrder: 5 },
    { name: "Sweet Finish", description: "A small, memorable ending.", imageUrl: pexels("7449105"), sortOrder: 6 },
    { name: "Soups & Chaats", description: "Comforting bowls and bright, tangy chaat.", imageUrl: pexels("21078315"), sortOrder: 7 },
    { name: "Coastal Kitchen", description: "Coconut, curry leaf and market-fresh coastal cooking.", imageUrl: pexels("14731625"), sortOrder: 8 },
    { name: "Regional Classics", description: "Celebrated recipes from across India.", imageUrl: pexels("28675074"), sortOrder: 9 },
    { name: "Street Favourites", description: "Big-flavour bites inspired by the street.", imageUrl: pexels("21078315"), sortOrder: 10 },
    { name: "Bowls & Light Meals", description: "Balanced, satisfying meals for any time of day.", imageUrl: pexels("28674705"), sortOrder: 11 },
    { name: "Breakfast & Brunch", description: "Slow mornings, familiar comfort and fresh starts.", imageUrl: pexels("20446413"), sortOrder: 12 }
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

  const coreMenuSpecs = [
    { name: "Saffron Paneer Tikka", category: "Small Plates", description: "Charred paneer, kasundi glaze, mint ash.", imageUrl: pexels("33430556"), basePricePaise: 42500, offer: { percentage: 10, label: "Lunch special" }, foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 14, featured: true, variants: [], modifierGroups: [{ id: "heat", name: "Heat level", minSelections: 0, maxSelections: 1, options: [{ id: "heat-mild", name: "Mild", priceDeltaPaise: 0, available: true }, { id: "heat-hot", name: "Extra hot", priceDeltaPaise: 0, available: true }] }] },
    { name: "Dahi ke Kebab", category: "Small Plates", description: "Silky hung curd kebabs with coriander and tamarind.", imageUrl: pexels("21078315"), basePricePaise: 29500, foodType: "VEGETARIAN", station: "COLD", preparationMinutes: 9, featured: false, variants: [], modifierGroups: [] },
    { name: "Amritsari Fish Bites", category: "Small Plates", description: "Crisp coastal fish, ajwain, lime and pickled onion.", imageUrl: "https://images.unsplash.com/photo-1756741987051-a6a38f28838b?auto=format&fit=crop&w=1200&q=82", basePricePaise: 44500, foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 13, featured: true, variants: [], modifierGroups: [] },
    { name: "Charred Broccoli Chaat", category: "Small Plates", description: "Fire-roasted broccoli, sev, yogurt and tamarind.", imageUrl: pexels("21078315"), basePricePaise: 28500, foodType: "VEGAN", station: "TANDOOR", preparationMinutes: 11, featured: false, variants: [], modifierGroups: [] },
    { name: "Smoky Butter Chicken", category: "From the Fire", description: "Charcoal chicken in slow-simmered tomato makhani.", imageUrl: "https://images.unsplash.com/photo-1768179669433-bd9d52949c20?auto=format&fit=crop&w=1200&q=82", basePricePaise: 52500, foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 18, featured: true, variants: [{ id: "half", name: "Half", priceDeltaPaise: -12000, available: true }, { id: "full", name: "Full", priceDeltaPaise: 0, available: true }], modifierGroups: [] },
    { name: "Tandoori Mushroom", category: "From the Fire", description: "King oyster mushrooms, burnt garlic and mint chutney.", imageUrl: pexels("36009039"), basePricePaise: 34500, foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 12, featured: true, variants: [], modifierGroups: [] },
    { name: "Kasundi Chicken Skewers", category: "From the Fire", description: "Mustard-marinated chicken, peppers and coriander smoke.", imageUrl: "https://images.unsplash.com/photo-1768179669433-bd9d52949c20?auto=format&fit=crop&w=1200&q=82", basePricePaise: 45500, foodType: "NON_VEGETARIAN", station: "TANDOOR", preparationMinutes: 16, featured: false, variants: [], modifierGroups: [] },
    { name: "Ember Dal Makhani", category: "Mains", description: "Black lentils, roasted garlic and cultured butter.", imageUrl: pexels("28675074"), basePricePaise: 34500, foodType: "VEGETARIAN", station: "HOT", preparationMinutes: 12, featured: false, variants: [], modifierGroups: [] },
    { name: "Palak Paneer", category: "Mains", description: "Soft paneer in a vibrant spinach and fenugreek gravy.", imageUrl: pexels("36009039"), basePricePaise: 38500, foodType: "VEGETARIAN", station: "HOT", preparationMinutes: 15, featured: false, variants: [], modifierGroups: [] },
    { name: "Malabar Prawn Curry", category: "Mains", description: "Coconut, kokum and curry leaf prawn curry.", imageUrl: "https://images.unsplash.com/photo-1756741987051-a6a38f28838b?auto=format&fit=crop&w=1200&q=82", basePricePaise: 56500, foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 17, featured: true, variants: [], modifierGroups: [] },
    { name: "Hyderabadi Chicken Biryani", category: "Mains", description: "Fragrant basmati, tender chicken, mint and fried onion.", imageUrl: pexels("30748997"), basePricePaise: 49500, offer: { percentage: 12, label: "Biryani hour" }, foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 20, featured: true, variants: [], modifierGroups: [] },
    { name: "Jackfruit Dum Biryani", category: "Mains", description: "Young jackfruit, saffron rice and slow-cooked whole spices.", imageUrl: pexels("32825912"), basePricePaise: 42500, foodType: "VEGAN", station: "HOT", preparationMinutes: 19, featured: false, variants: [], modifierGroups: [] },
    { name: "Pepper Lamb Rice", category: "Mains", description: "Slow-cooked lamb, pepper broth and crispy onions.", imageUrl: pexels("14731625"), basePricePaise: 59500, foodType: "NON_VEGETARIAN", station: "HOT", preparationMinutes: 22, featured: false, variants: [], modifierGroups: [] },
    { name: "Saffron Jeera Rice", category: "Rice & Breads", description: "Aromatic basmati with cumin and saffron.", imageUrl: pexels("28674705"), basePricePaise: 18000, foodType: "VEGETARIAN", station: "HOT", preparationMinutes: 8, featured: false, variants: [], modifierGroups: [] },
    { name: "Tandoor Naan", category: "Rice & Breads", description: "Hand-stretched naan from the clay oven.", imageUrl: pexels("20446413"), basePricePaise: 6500, foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 5, featured: false, variants: [], modifierGroups: [{ id: "naan-style", name: "Finish", minSelections: 0, maxSelections: 1, options: [{ id: "naan-plain", name: "Plain", priceDeltaPaise: 0, available: true }, { id: "naan-garlic", name: "Garlic butter", priceDeltaPaise: 2500, available: true }] }] },
    { name: "Laccha Paratha", category: "Rice & Breads", description: "Layered whole-wheat paratha with a crisp finish.", imageUrl: pexels("20446423"), basePricePaise: 9500, foodType: "VEGETARIAN", station: "TANDOOR", preparationMinutes: 8, featured: false, variants: [], modifierGroups: [] },
    { name: "Coconut Lemon Rice", category: "Rice & Breads", description: "Steamed rice, curry leaf, coconut and tempered mustard.", imageUrl: pexels("28674705"), basePricePaise: 19500, foodType: "VEGAN", station: "HOT", preparationMinutes: 9, featured: false, variants: [], modifierGroups: [] },
    { name: "Kokum Sparkler", category: "Coolers", description: "Kokum, lime, black salt and soda.", imageUrl: pexels("14930476"), basePricePaise: 17500, foodType: "VEGAN", station: "BAR", preparationMinutes: 4, featured: true, variants: [], modifierGroups: [] },
    { name: "Rose Pistachio Lassi", category: "Coolers", description: "House-set yogurt, rose petal syrup and pistachio dust.", imageUrl: pexels("17200460"), basePricePaise: 19500, foodType: "VEGETARIAN", station: "BAR", preparationMinutes: 4, featured: false, variants: [], modifierGroups: [] },
    { name: "Mango Saffron Lassi", category: "Coolers", description: "Mango pulp, yogurt and a saffron finish.", imageUrl: pexels("14930476"), basePricePaise: 20500, foodType: "VEGETARIAN", station: "BAR", preparationMinutes: 4, featured: true, variants: [], modifierGroups: [] },
    { name: "Masala Chaas", category: "Coolers", description: "Spiced buttermilk, mint, cumin and black salt.", imageUrl: pexels("17200460"), basePricePaise: 12500, foodType: "VEGETARIAN", station: "BAR", preparationMinutes: 3, featured: false, variants: [], modifierGroups: [] },
    { name: "Coconut Milk Kheer", category: "Sweet Finish", description: "Toasted coconut, jaggery and seasonal fruit.", imageUrl: pexels("15014919"), basePricePaise: 24500, foodType: "VEGAN", station: "COLD", preparationMinutes: 5, featured: false, variants: [], modifierGroups: [] },
    { name: "Dark Chocolate Kulfi", category: "Sweet Finish", description: "Single-origin chocolate and salted cashew praline.", imageUrl: pexels("7449105"), basePricePaise: 26500, foodType: "VEGETARIAN", station: "COLD", preparationMinutes: 4, featured: true, variants: [], modifierGroups: [] },
    { name: "Gulab Jamun", category: "Sweet Finish", description: "Warm cardamom syrup, rose petal and pistachio.", imageUrl: pexels("11887844"), basePricePaise: 18500, foodType: "VEGETARIAN", station: "COLD", preparationMinutes: 4, featured: false, variants: [], modifierGroups: [] }
  ] as const;
  const menuSpecs = [...coreMenuSpecs, ...expandedCatalogue(pexels)];
  await Promise.all(menuSpecs.map((spec) => MenuItemModel.findOneAndUpdate(
    { restaurantId: restaurant._id, name: spec.name },
    { $set: { ...spec, categoryId: categoryId(spec.category), available: true, archived: false, allergens: [], spiceLevel: 1 } },
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

  logger.info({ restaurantId: restaurant._id.toString(), createdDemoAccounts }, "Seed complete");
  if (createdDemoAccounts) {
    logger.info({ demoPassword: env.NODE_ENV === "development" ? "demo-password" : "configured via SEED_DEMO_PASSWORD" }, "Created demo credentials: cashier@ember.local, waiter@ember.local, kitchen@ember.local, guest@ember.local");
  }
}

seed()
  .catch((error: unknown) => {
    logger.error({ err: error }, "Seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
