import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { notFound, serviceUnavailable } from "../lib/errors.js";
import { AccountModel } from "../models/Account.js";
import { OrderModel } from "../models/Order.js";
import { hashPassword } from "./auth.service.js";
import { createOrder, type ActorContext, type CreateOrderInput } from "./order.service.js";
import { getSingleRestaurant } from "./restaurant.service.js";

const guestCheckoutEmail = "guest-checkout@system.emberserve.invalid";

const trackingTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function guestCheckoutActor(): Promise<ActorContext> {
  const restaurant = await getSingleRestaurant();
  let account = await AccountModel.findOne({ restaurantId: restaurant._id, email: guestCheckoutEmail }).select("+tokenVersion");

  if (!account) {
    try {
      account = await AccountModel.create({
        restaurantId: restaurant._id,
        email: guestCheckoutEmail,
        displayName: "Guest checkout",
        passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
        role: "CUSTOMER",
        permissions: [],
        active: true
      });
    } catch (error: unknown) {
      const duplicateKeyError = error as { code?: unknown };
      if (duplicateKeyError.code !== 11000) throw error;
      account = await AccountModel.findOne({ restaurantId: restaurant._id, email: guestCheckoutEmail }).select("+tokenVersion");
    }
  }

  if (!account?.active) {
    throw serviceUnavailable("GUEST_ORDERING_UNAVAILABLE", "Guest ordering is temporarily unavailable. Please contact the restaurant.");
  }

  return {
    accountId: account._id.toString(),
    restaurantId: restaurant._id.toString(),
    role: "CUSTOMER",
    permissions: [],
    tokenVersion: account.tokenVersion,
    guestCheckout: true
  };
}

export async function createGuestOrder(input: CreateOrderInput) {
  const trackingToken = randomBytes(32).toString("base64url");
  const order = await createOrder(await guestCheckoutActor(), { ...input, guestTrackingTokenHash: trackingTokenHash(trackingToken) });
  return { order, trackingToken };
}

export async function findGuestOrder(orderId: string, trackingToken: string) {
  const order = await OrderModel.findById(orderId).select("+guestTrackingTokenHash");
  const suppliedHash = trackingTokenHash(trackingToken);
  const expectedHash = order?.guestTrackingTokenHash;
  if (!order || !expectedHash) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  if (!timingSafeEqual(Buffer.from(expectedHash), Buffer.from(suppliedHash))) {
    throw notFound("ORDER_NOT_FOUND", "Order was not found");
  }
  return order;
}
