import { ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { formatMoney } from "@/shared/lib/format";
import { QuantityControl } from "@/shared/components/quantity-control";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { usePos } from "@/shared/store/pos-store";

interface CartDrawerProps {
  checkoutLabel?: string;
  onCheckout?: () => void;
}

export const CartDrawer = ({ checkoutLabel = "Send order", onCheckout }: CartDrawerProps) => {
  const {
    cart, cartOpen, setCartOpen, updateLineQuantity, clearCart,
    cartSubtotal, cartTax, cartService, cartTotal,
  } = usePos();
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  const drawerRef = useDialogFocus(cartOpen, () => setCartOpen(false));

  if (!cartOpen) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={() => setCartOpen(false)}>
      <aside className="cart-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Current cart" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <div className="cart-drawer__header">
          <div><span className="eyebrow">Your selection</span><h2>{itemCount} {itemCount === 1 ? "item" : "items"} on the tray</h2></div>
          <button type="button" className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close cart"><X /></button>
        </div>
        <div className="cart-drawer__items">
          {cart.length ? cart.map((line) => (
            <article className="cart-line" key={line.id}>
              <div className={`cart-line__swatch swatch--${line.item.color}`}>{line.item.glyph}</div>
              <div className="cart-line__body"><strong>{line.item.name}</strong><span>{line.modifiers?.join(" · ") || "Kitchen standard"}</span><b>{formatMoney(line.item.price * line.quantity)}</b></div>
              <QuantityControl quantity={line.quantity} onChange={(adjustment) => updateLineQuantity(line.id, adjustment)} compact />
            </article>
          )) : <div className="empty-state"><ShoppingBag size={30} /><strong>Your tray is ready for a favourite.</strong><span>Tap Add on any dish to begin.</span></div>}
        </div>
        {cart.length > 0 && <div className="cart-drawer__footer">
          <button type="button" className="quiet-button" onClick={clearCart}><Trash2 size={16} /> Clear tray</button>
          <dl className="order-totals"><div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div><div><dt>Taxes</dt><dd>{formatMoney(cartTax)}</dd></div>{cartService > 0 && <div><dt>Service</dt><dd>{formatMoney(cartService)}</dd></div>}<div className="order-totals__total"><dt>Total</dt><dd>{formatMoney(cartTotal)}</dd></div></dl>
          <button type="button" className="button button--saffron button--full" onClick={onCheckout}><span>{checkoutLabel}</span><ArrowRight size={18} /></button>
        </div>}
      </aside>
    </div>
  );
};
