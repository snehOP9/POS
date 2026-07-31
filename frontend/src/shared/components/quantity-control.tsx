import { Minus, Plus } from "lucide-react";

export const QuantityControl = ({ quantity, onChange, compact = false }: { quantity: number; onChange: (adjustment: number) => void; compact?: boolean }) => (
  <div className={`quantity-control ${compact ? "quantity-control--compact" : ""}`} aria-label={`Quantity: ${quantity}`}>
    <button type="button" onClick={() => onChange(-1)} aria-label="Remove one"><Minus size={compact ? 13 : 16} /></button>
    <output>{quantity}</output>
    <button type="button" onClick={() => onChange(1)} aria-label="Add one"><Plus size={compact ? 13 : 16} /></button>
  </div>
);
