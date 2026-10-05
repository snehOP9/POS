import { Flame } from "lucide-react";
import { Link } from "react-router-dom";

export const Brand = ({ inverse = false, compact = false, name = "EmberServe", descriptor = "POS", to = "/" }: { inverse?: boolean; compact?: boolean; name?: string; descriptor?: string; to?: string }) => (
  <Link className={`brand ${inverse ? "brand--inverse" : ""} ${compact ? "brand--compact" : ""}`} to={to} aria-label={`${name} home`}>
    <span className="brand__flame" aria-hidden="true"><Flame strokeWidth={2.2} /></span>
    {!compact && <span className="brand__words"><strong>{name}</strong><span>{descriptor}</span></span>}
  </Link>
);
