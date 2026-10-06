import { randomUUID } from "node:crypto";

import { Router } from "express";
import rateLimit from "express-rate-limit";

import { asyncHandler } from "../lib/asyncHandler.js";
import { badRequest, notFound, serviceUnavailable } from "../lib/errors.js";
import { validatedParam, validatedQuery } from "../lib/requestInput.js";
import { sendSuccess } from "../lib/response.js";
import { authContext, requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { ReservationModel, type Reservation } from "../models/Reservation.js";
import { recordAudit } from "../services/audit.service.js";
import { createNotification } from "../services/notification.service.js";
import { notifyReservationByEmail } from "../services/reservation-email.service.js";
import { getSingleRestaurant } from "../services/restaurant.service.js";
import { createReservationRequestSchema, reservationListRequestSchema, reservationStatusRequestSchema } from "./schemas.js";

const serializeReservation = (reservation: Reservation & { _id: { toString(): string } }) => ({
  id: reservation._id.toString(),
  displayId: reservation.displayId,
  status: reservation.status,
  guestName: reservation.guestName,
  guestEmail: reservation.guestEmail,
  guestPhone: reservation.guestPhone,
  partySize: reservation.partySize,
  reservationAt: reservation.reservationAt.toISOString(),
  occasion: reservation.occasion,
  notes: reservation.notes,
  createdAt: reservation.createdAt?.toISOString()
});

export const reservationsRouter = Router();

const reservationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ success: false, error: { code: "RESERVATION_RATE_LIMITED", message: "Too many reservation requests. Please wait a few minutes and try again." } })
});

const reservationFitsPublishedHours = (reservationAt: Date, openingHours: NonNullable<Awaited<ReturnType<typeof getSingleRestaurant>>["publicProfile"]>["openingHours"], timezone: string) => {
  if (!openingHours.length) return true;
  const parts = new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).formatToParts(reservationAt);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = value("weekday");
  const time = `${value("hour")}:${value("minute")}`;
  const hours = openingHours.find((entry) => entry.day === day);
  if (!hours || hours.closed || !hours.opens || !hours.closes) return false;
  return hours.closes >= hours.opens ? time >= hours.opens && time <= hours.closes : time >= hours.opens || time <= hours.closes;
};

reservationsRouter.post("/", reservationLimiter, validateRequest(createReservationRequestSchema), asyncHandler(async (request, response) => {
  const restaurant = await getSingleRestaurant();
  if (restaurant.publicProfile?.reservationEnabled === false) {
    throw serviceUnavailable("RESERVATIONS_UNAVAILABLE", "Reservations are not being accepted online right now. Please contact the restaurant.");
  }
  const body = request.body as {
    guestName: string; guestEmail?: string; guestPhone?: string; partySize: number; reservationAt: Date; occasion?: string; notes?: string;
  };
  if (!reservationFitsPublishedHours(body.reservationAt, restaurant.publicProfile?.openingHours ?? [], restaurant.timezone)) {
    throw badRequest("RESERVATION_OUTSIDE_PUBLISHED_HOURS", "Choose a time within the restaurant's published opening hours.");
  }
  const reservation = await ReservationModel.create({
    restaurantId: restaurant._id,
    displayId: `RSV-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    status: "REQUESTED",
    ...body,
    consentAt: new Date()
  });
  await recordAudit({
    restaurantId: restaurant._id.toString(),
    action: "reservation.requested",
    entityType: "Reservation",
    entityId: reservation._id.toString(),
    metadata: { partySize: reservation.partySize, reservationAt: reservation.reservationAt.toISOString() },
    requestId: request.requestId
  });
  await createNotification({
    restaurantId: restaurant._id.toString(),
    role: "CASHIER",
    type: "RESERVATION_REQUESTED",
    title: "New reservation request",
    message: `${reservation.guestName} requested ${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"} for ${reservation.reservationAt.toISOString()}.`,
    entityType: "Reservation",
    entityId: reservation._id.toString()
  });
  await notifyReservationByEmail({ reservation, restaurantName: restaurant.name, timezone: restaurant.timezone });
  sendSuccess(response, serializeReservation(reservation), 201);
}));

reservationsRouter.get("/", requireAuth, requireRole("CASHIER"), requirePermission("canViewReports"), validateRequest(reservationListRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const query = validatedQuery<{ page: number; limit: number; status?: Reservation["status"] }>(request);
  const filter = { restaurantId: actor.restaurantId, ...(query.status ? { status: query.status } : {}) };
  const [reservations, total] = await Promise.all([
    ReservationModel.find(filter).sort({ reservationAt: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    ReservationModel.countDocuments(filter)
  ]);
  sendSuccess(response, reservations.map(serializeReservation), 200, { page: query.page, limit: query.limit, total });
}));

reservationsRouter.patch("/:id/status", requireAuth, requireRole("CASHIER"), requirePermission("canEditRestaurantSettings"), validateRequest(reservationStatusRequestSchema), asyncHandler(async (request, response) => {
  const actor = authContext(request);
  const requestedStatus = (request.body as { status: Reservation["status"] }).status;
  const reservation = await ReservationModel.findOneAndUpdate(
    { _id: validatedParam(request, "id"), restaurantId: actor.restaurantId },
    { $set: { status: requestedStatus } },
    { new: true, runValidators: true }
  );
  if (!reservation) throw notFound("RESERVATION_NOT_FOUND", "Reservation was not found");
  await recordAudit({
    restaurantId: actor.restaurantId,
    actorId: actor.accountId,
    actorRole: actor.role,
    action: "reservation.status.updated",
    entityType: "Reservation",
    entityId: reservation._id.toString(),
    metadata: { status: reservation.status },
    requestId: request.requestId
  });
  if (requestedStatus === "CONFIRMED" || requestedStatus === "DECLINED" || requestedStatus === "CANCELLED") {
    const restaurant = await getSingleRestaurant();
    await notifyReservationByEmail({ reservation, restaurantName: restaurant.name, timezone: restaurant.timezone, status: requestedStatus });
  }
  sendSuccess(response, serializeReservation(reservation));
}));
