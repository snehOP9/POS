import { CloudOff, Radio } from "lucide-react";
import { useOnline } from "@/shared/hooks/useClock";
import type { LiveConnectionState } from "@/shared/hooks/useLiveUpdates";

type ConnectionValue = boolean | LiveConnectionState;

const labelFor = (state: LiveConnectionState) => ({
  unconfigured: "API not configured",
  preview: "Preview sync",
  guest: "Order updates",
  connecting: "Connecting sync",
  live: "Live sync",
  reconnecting: "Sync reconnecting",
  reauthenticating: "Restoring session",
  offline: "Offline",
})[state];

const shortLabelFor = (state: LiveConnectionState) => ({
  unconfigured: "Offline",
  preview: "Preview",
  guest: "Updates",
  connecting: "Syncing",
  live: "Live",
  reconnecting: "Reconnecting",
  reauthenticating: "Restoring",
  offline: "Offline",
})[state];

export const ConnectionBadge = ({ live = false, dark = false }: { live?: ConnectionValue; dark?: boolean }) => {
  const browserOnline = useOnline();
  const state: LiveConnectionState = typeof live === "boolean" ? (live ? "live" : browserOnline ? "reconnecting" : "offline") : live;
  const connected = browserOnline && (state === "live" || state === "preview" || state === "guest");
  const visibleState = browserOnline ? state : "offline";
  return (
    <span className={`connection-badge ${dark ? "connection-badge--dark" : ""} ${connected ? "connection-badge--live" : ""}`} aria-live="polite">
      {visibleState === "offline" ? <CloudOff size={14} aria-hidden="true" /> : <Radio size={14} aria-hidden="true" />}
      <span className="connection-badge__label connection-badge__label--full">{labelFor(visibleState)}</span>
      <span className="connection-badge__label connection-badge__label--short">{shortLabelFor(visibleState)}</span>
    </span>
  );
};
