import { CalendarDays, Check, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError, api } from "@/shared/lib/api";
import type { Reservation, ToastMessage } from "@/shared/types/domain";

const dateTime = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const ReservationManagementPanel = ({ demoMode, notify }: { demoMode: boolean; notify: (message: string, tone?: ToastMessage["tone"]) => void }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string>();
  const [error, setError] = useState<string>();

  const load = () => {
    if (demoMode) { setReservations([]); setError(undefined); return; }
    setLoading(true); setError(undefined);
    void api.reservations.list().then((payload) => setReservations(Array.isArray(payload) ? payload as Reservation[] : []))
      .catch((reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Reservations could not be loaded."))
      .finally(() => setLoading(false));
  };
  useEffect(load, [demoMode]);

  const changeStatus = (reservation: Reservation, status: Reservation["status"]) => {
    setUpdatingId(reservation.id);
    void api.reservations.updateStatus(reservation.id, status).then(() => {
      setReservations((current) => current.map((entry) => entry.id === reservation.id ? { ...entry, status } : entry));
      notify(`${reservation.displayId} marked ${status.toLowerCase()}.`);
    }).catch((reason: unknown) => notify(reason instanceof ApiError ? reason.message : "Reservation status could not be updated.", "danger"))
      .finally(() => setUpdatingId(undefined));
  };

  return <section className="reservation-management-panel" aria-live="polite"><header><div><span className="eyebrow">Guest service</span><h2>Reservation requests</h2><p>Requests remain pending until a restaurant colleague confirms or declines them.</p></div><button type="button" className="outline-button" onClick={load} disabled={loading}><RefreshCw size={16} /> {loading ? "Refreshing…" : "Refresh"}</button></header>{demoMode ? <p className="report-message">Preview keeps reservation requests isolated. Sign in to the live restaurant workspace to manage them.</p> : error ? <p className="report-message report-message--error">{error}</p> : reservations.length ? <div className="reservation-management-list">{reservations.map((reservation) => <article key={reservation.id}><div><span className={`reservation-status reservation-status--${reservation.status.toLowerCase()}`}>{reservation.status.toLowerCase()}</span><strong>{reservation.displayId} · {reservation.guestName}</strong><small>{dateTime(reservation.reservationAt)} · {reservation.partySize} {reservation.partySize === 1 ? "guest" : "guests"}</small>{reservation.occasion && <small>Occasion: {reservation.occasion}</small>}{reservation.notes && <p>{reservation.notes}</p>}{(reservation.guestPhone || reservation.guestEmail) && <small>{reservation.guestPhone ?? reservation.guestEmail}</small>}</div>{reservation.status === "REQUESTED" && <div><button type="button" className="button button--saffron" disabled={updatingId === reservation.id} onClick={() => changeStatus(reservation, "CONFIRMED")}><Check size={15} /> Confirm</button><button type="button" className="quiet-button quiet-button--danger" disabled={updatingId === reservation.id} onClick={() => changeStatus(reservation, "DECLINED")}><X size={15} /> Decline</button></div>}</article>)}</div> : <div className="empty-state"><CalendarDays size={29} /><strong>No reservation requests yet.</strong><span>New guest requests will arrive here for confirmation.</span></div>}</section>;
};
