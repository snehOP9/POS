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
  const profile = restaurant.publicProfile ?? { galleryImageUrls: [], openingHours: [], reservationEnabled: true, publicContactEnabled: false };
  const publishContact = profile.publicContactEnabled === true;
  return {
    id: restaurant._id.toString(),
    name: restaurant.name,
    tagline: restaurant.tagline,
    description: restaurant.description,
    phone: publishContact ? restaurant.phone : undefined,
    supportEmail: publishContact ? restaurant.supportEmail : undefined,
    address: publishContact ? restaurant.address : undefined,
    currency: restaurant.currency,
    timezone: restaurant.timezone,
    tax: restaurant.tax,
    serviceCharge: restaurant.serviceCharge,
    orderingModes: restaurant.orderingModes,
    deliveryEnabled: restaurant.deliveryEnabled,
    primaryColor: restaurant.primaryColor,
    secondaryColor: restaurant.secondaryColor,
    razorpayPublicKey: restaurant.razorpayPublicKey,
    publicProfile: {
      cuisine: profile.cuisine,
      story: profile.story,
      chefName: profile.chefName,
      chefRole: profile.chefRole,
      heroImageUrl: profile.heroImageUrl,
      galleryImageUrls: profile.galleryImageUrls ?? [],
      bookingUrl: profile.bookingUrl,
      reservationEnabled: profile.reservationEnabled !== false,
      publicContactEnabled: publishContact,
      openingHours: profile.openingHours ?? [],
      parkingNote: profile.parkingNote,
      accessibilityNote: profile.accessibilityNote,
      instagramUrl: profile.instagramUrl
    }
  };
}

export function ownerRestaurant(restaurant: RestaurantConfig & { _id: Types.ObjectId }) {
  const publicData = publicRestaurant(restaurant);
  return {
    ...publicData,
    phone: restaurant.phone,
    supportEmail: restaurant.supportEmail,
    address: restaurant.address,
    publicProfile: {
      ...publicData.publicProfile,
      publicContactEnabled: restaurant.publicProfile?.publicContactEnabled === true
    }
  };
}
