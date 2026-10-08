import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, apiIsConfigured, apiRoot, getAccessToken } from "@/shared/lib/api";

export type LiveConnectionState = "preview" | "guest" | "unconfigured" | "connecting" | "live" | "reconnecting" | "reauthenticating" | "offline";

const invalidatingEvents = [
  "order:created",
  "order:updated",
  "ticket:updated",
  "ticket:created",
  "item:ready",
  "table:updated",
  "payment:created",
  "payment:updated",
  "notification:created",
  "menu:updated",
] as const;

export type LiveUpdateEvent = (typeof invalidatingEvents)[number] | "connection:restored";

/**
 * Batches realtime updates without throwing away which resource changed.  A
 * table update, for example, should not force every screen to reload its menu.
 */
export const useLiveUpdates = (onInvalidation?: (events: ReadonlySet<LiveUpdateEvent>) => void, enabled = true): LiveConnectionState => {
  const [state, setState] = useState<LiveConnectionState>(() => !enabled ? "preview" : !apiIsConfigured
    ? "unconfigured"
    : navigator.onLine ? "connecting" : "offline");
  const invalidationHandler = useRef(onInvalidation);

  useEffect(() => {
    invalidationHandler.current = onInvalidation;
  }, [onInvalidation]);

  useEffect(() => {
    if (!enabled) {
      setState("preview");
      return;
    }
    if (!apiIsConfigured) {
      setState("unconfigured");
      return;
    }

    let disposed = false;
    let refreshInFlight = false;
    let invalidationTimer: number | undefined;
    const pendingEvents = new Set<LiveUpdateEvent>();
    const scheduleInvalidation = (event: LiveUpdateEvent) => {
      pendingEvents.add(event);
      if (invalidationTimer) window.clearTimeout(invalidationTimer);
      invalidationTimer = window.setTimeout(() => {
        const events = new Set(pendingEvents);
        pendingEvents.clear();
        invalidationHandler.current?.(events);
      }, 120);
    };
    const socketUrl = apiRoot.replace(/\/api\/v1$/, "");
    const socket = io(socketUrl, {
      autoConnect: true,
      auth: getAccessToken() ? { token: getAccessToken() } : undefined,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      timeout: 5_000,
    });

    const refreshSocketToken = () => {
      if (refreshInFlight || disposed) return;
      refreshInFlight = true;
      setState("reauthenticating");
      void api.auth.refresh().then(({ accessToken }) => {
        if (disposed) return;
        socket.auth = { token: accessToken };
        socket.connect();
      }).catch(() => {
        if (!disposed) setState("reconnecting");
      }).finally(() => {
        refreshInFlight = false;
      });
    };
    const onConnect = () => {
      setState("live");
      scheduleInvalidation("connection:restored");
    };
    const onDisconnect = () => setState(navigator.onLine ? "reconnecting" : "offline");
    const onConnectError = (error: Error) => {
      const message = error.message.toLowerCase();
      if (message.includes("token") || message.includes("auth") || message.includes("jwt")) refreshSocketToken();
      else setState(navigator.onLine ? "reconnecting" : "offline");
    };
    const onReconnectAttempt = () => setState(navigator.onLine ? "reconnecting" : "offline");
    const onReconnect = () => {
      setState("live");
      scheduleInvalidation("connection:restored");
    };
    const onOnline = () => {
      setState("connecting");
      socket.connect();
    };
    const onOffline = () => {
      setState("offline");
      socket.disconnect();
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect", onReconnect);
    invalidatingEvents.forEach((event) => socket.on(event, () => scheduleInvalidation(event)));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      disposed = true;
      if (invalidationTimer) window.clearTimeout(invalidationTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect", onReconnect);
      invalidatingEvents.forEach((event) => socket.off(event));
      socket.disconnect();
    };
  }, [enabled]);

  return state;
};
