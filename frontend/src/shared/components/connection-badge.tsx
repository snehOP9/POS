import { CloudOff, Radio } from "lucide-react";
import { useOnline } from "@/shared/hooks/useClock";
import { apiIsConfigured } from "@/shared/lib/api";

export const ConnectionBadge = ({ live = false, dark = false }: { live?: boolean; dark?: boolean }) => {
  const online = useOnline();
  const connected = online && live;
  return (
    <span className={`connection-badge ${dark ? "connection-badge--dark" : ""} ${connected ? "connection-badge--live" : ""}`}>
      {online ? <Radio size={14} aria-hidden="true" /> : <CloudOff size={14} aria-hidden="true" />}
      {connected ? "Live sync" : !online ? "Offline" : apiIsConfigured ? "Sync reconnecting" : "API not configured"}
    </span>
  );
};
