import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { apiIsConfigured, apiRoot, getAccessToken } from "@/shared/lib/api";

export const useLiveUpdates = (onOrderEvent?: () => void) => {
  const [connected, setConnected] = useState(false);
  const eventHandler = useRef(onOrderEvent);

  useEffect(() => {
    eventHandler.current = onOrderEvent;
  }, [onOrderEvent]);

  useEffect(() => {
    if (!apiIsConfigured) {
      setConnected(false);
      return;
    }
    const socketUrl = apiRoot.replace(/\/api\/v1$/, "");
    const socket = io(socketUrl, {
      autoConnect: true,
      auth: getAccessToken() ? { token: getAccessToken() } : undefined,
      reconnectionAttempts: 3,
      timeout: 2_500,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onUpdate = () => eventHandler.current?.();
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("order:created", onUpdate);
    socket.on("order:updated", onUpdate);
    socket.on("ticket:updated", onUpdate);
    socket.on("ticket:created", onUpdate);
    socket.on("item:ready", onUpdate);
    socket.on("table:updated", onUpdate);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("order:created", onUpdate);
      socket.off("order:updated", onUpdate);
      socket.off("ticket:updated", onUpdate);
      socket.off("ticket:created", onUpdate);
      socket.off("item:ready", onUpdate);
      socket.off("table:updated", onUpdate);
      socket.disconnect();
    };
  }, []);

  return connected;
};
