import { env } from "../config/env.js";
import type { Reservation } from "../models/Reservation.js";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

const reservationTime = (value: Date, timezone: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(value);

const send = async (to: string, subject: string, html: string, text: string) => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, html, text }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`provider returned ${response.status}`);
    return true;
  } catch (error) {
    console.error("reservation email delivery failed", { reason: error instanceof Error ? error.message : "unknown" });
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

type ReservationEmailContext = { reservation: Reservation; restaurantName: string; timezone: string; status?: "CONFIRMED" | "DECLINED" | "CANCELLED" };

export const notifyReservationByEmail = async ({ reservation, restaurantName, timezone, status }: ReservationEmailContext) => {
  const when = reservationTime(reservation.reservationAt, timezone);
  const guestName = escapeHtml(reservation.guestName);
  const reference = escapeHtml(reservation.displayId);
  const statusCopy = status === "CONFIRMED" ? "has been confirmed" : status === "DECLINED" ? "could not be confirmed" : status === "CANCELLED" ? "has been cancelled" : "has been received";
  const guest = reservation.guestEmail
    ? send(reservation.guestEmail, `${restaurantName}: reservation ${statusCopy}`, `<main><h1>Reservation ${statusCopy}</h1><p>Hello ${guestName},</p><p>Your request for <strong>${reservation.partySize}</strong> ${reservation.partySize === 1 ? "guest" : "guests"} on <strong>${escapeHtml(when)}</strong> ${statusCopy}.</p><p>Reference: <strong>${reference}</strong></p><p>${status ? "If you need help, please use the restaurant's published contact channel." : "The restaurant will review availability and contact you. This is not a confirmed booking yet."}</p></main>`, `Hello ${reservation.guestName}, your reservation request ${reservation.displayId} for ${reservation.partySize} guests on ${when} ${statusCopy}.`)
    : Promise.resolve(false);
  const team = !status && env.RESERVATION_NOTIFICATION_EMAIL
    ? send(env.RESERVATION_NOTIFICATION_EMAIL, `${restaurantName}: new reservation ${reservation.displayId}`, `<main><h1>New reservation request</h1><p><strong>${guestName}</strong> requested a table for ${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"} on ${escapeHtml(when)}.</p><p>Reference: <strong>${reference}</strong></p></main>`, `${reservation.guestName} requested ${reservation.partySize} guests on ${when}. Reference: ${reservation.displayId}.`)
    : Promise.resolve(false);
  await Promise.allSettled([guest, team]);
};
