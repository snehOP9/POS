import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, RotateCcw, X } from "lucide-react";
import { ApiError, api } from "@/shared/lib/api";
import { useLiveUpdates } from "@/shared/hooks/useLiveUpdates";
import { usePos } from "@/shared/store/pos-store";

type OperationalNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
};

const asNotifications = (payload: unknown): OperationalNotification[] => Array.isArray(payload)
  ? payload.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const notification = value as Record<string, unknown>;
    if (typeof notification.id !== "string" || typeof notification.title !== "string" || typeof notification.message !== "string" || typeof notification.createdAt !== "string") return [];
    return [{
      id: notification.id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      ...(typeof notification.readAt === "string" ? { readAt: notification.readAt } : {}),
    }];
  })
  : [];

export const NotificationCenter = () => {
  const { session, demoMode, notify, resetPreview } = usePos();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OperationalNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!session || demoMode || session.role === "CUSTOMER") return;
    setLoading(true);
    void api.notifications.list().then((payload) => {
      setItems(asNotifications(payload));
    }).catch((error: unknown) => {
      if (open) notify(error instanceof ApiError ? error.message : "Notifications could not be refreshed.", "danger");
    }).finally(() => setLoading(false));
  }, [demoMode, notify, open, session]);

  useEffect(() => {
    load();
  }, [load]);
  useLiveUpdates(load, Boolean(session && !demoMode && session.role !== "CUSTOMER"));

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const readNotification = (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.readAt) return;
    setItems((current) => current.map((candidate) => candidate.id === id ? { ...candidate, readAt: new Date().toISOString() } : candidate));
    void api.notifications.markRead(id).catch((error: unknown) => {
      setItems((current) => current.map((candidate) => candidate.id === id ? item : candidate));
      notify(error instanceof ApiError ? error.message : "Notification could not be marked read.", "danger");
    });
  };

  if (!session) return null;
  if (demoMode) return <button type="button" className="preview-reset-control" onClick={resetPreview}><RotateCcw size={16} /> Reset Preview</button>;
  return <aside className="notification-center" aria-label="Operational notifications">
    <button type="button" className="notification-center__trigger" onClick={() => { setOpen((value) => !value); if (!open) load(); }} aria-expanded={open} aria-controls="operational-notifications">
      <Bell size={18} aria-hidden="true" /><span className="sr-only">Open notifications</span>{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
    </button>
    {open && <section className="notification-center__panel" id="operational-notifications" aria-live="polite">
      <header><div><span className="eyebrow">Operations</span><h2>Notifications</h2></div><button type="button" className="icon-button" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={17} /></button></header>
      <div className="notification-center__list">
        {loading && !items.length && <p>Refreshing notifications…</p>}
        {!loading && !items.length && <p>You’re all caught up.</p>}
        {items.map((item) => <button type="button" key={item.id} className={item.readAt ? "notification-item" : "notification-item notification-item--unread"} onClick={() => readNotification(item.id)}>
          <span><strong>{item.title}</strong><small>{item.message}</small><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></span>{item.readAt ? <CheckCheck size={16} aria-label="Read" /> : <i aria-label="Unread" />}
        </button>)}
      </div>
    </section>}
  </aside>;
};
