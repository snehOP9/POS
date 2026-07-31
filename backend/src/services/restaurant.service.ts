import { Types } from "mongoose";

import { notFound } from "../lib/errors.js";
import { RestaurantConfigModel, type RestaurantConfig } from "../models/RestaurantConfig.js";

export async function getRestaurant(restaurantId: string): Promise<RestaurantConfig & { _id: Types.ObjectId }> {
  const restaurant = await RestaurantConfigModel.findById(restaurantId);
  if (!restaurant) throw notFound("RESTAURANT_NOT_CONFIGURED", "Restaurant configuration was not found");
  return restaurant;
}

export async function getSingleRestaurant(): Promise<RestaurantConfig & { _id: Types.ObjectId }> {
  const restaurant = await RestaurantConfigModel.findOne().sort({ createdAt: 1 });
  if (!restaurant) throw notFound("RESTAURANT_NOT_CONFIGURED", "Restaurant configuration was not found; run the seed script");
  return restaurant;
}

export function publicRestaurant(restaurant: RestaurantConfig & { _id: Types.ObjectId }) {
  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    tagline: restaurant.tagline,
    description: restaurant.description,
    phone: restaurant.phone,
    address: restaurant.address,
    currency: restaurant.currency,
    timezone: restaurant.timezone,
    tax: restaurant.tax,
    serviceCharge: restaurant.serviceCharge,
    orderingModes: restaurant.orderingModes,
    deliveryEnabled: restaurant.deliveryEnabled,
    primaryColor: restaurant.primaryColor,
    secondaryColor: restaurant.secondaryColor,
    razorpayPublicKey: restaurant.razorpayPublicKey
  };
}
