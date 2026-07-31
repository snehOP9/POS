import { Flame } from "lucide-react";
import { Link } from "react-router-dom";

export const Brand = ({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) => (
  <Link className={`brand ${inverse ? "brand--inverse" : ""} ${compact ? "brand--compact" : ""}`} to="/menu" aria-label="EmberServe home">
    <span className="brand__flame" aria-hidden="true"><Flame strokeWidth={2.2} /></span>
    {!compact && <span className="brand__words"><strong>Ember</strong><span>Serve POS</span></span>}
  </Link>
);
