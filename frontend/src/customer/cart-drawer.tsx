import { ArrowLeft, ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatMoney } from "@/shared/lib/format";
import { QuantityControl } from "@/shared/components/quantity-control";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { usePos } from "@/shared/store/pos-store";
import { cartLineLabels, cartLineTotal } from "@/shared/lib/cart";

interface CartDrawerProps {
  checkoutLabel?: string;
  orderMode?: "DINE_IN" | "PICKUP";
  onCheckout?: (pickup?: { name: string; phone?: string }) => Promise<boolean> | void;
}

export const CartDrawer = ({ checkoutLabel = "Send order", orderMode = "DINE_IN", onCheckout }: CartDrawerProps) => {
  const {
    cart, cartOpen, setCartOpen, updateLineQuantity, clearCart,
    cartSubtotal, cartTax, cartService, cartTotal, pricing, isPending,
  } = usePos();
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  // Keep the focus-trap close handler stable: recreating it on every keypress
  // was resetting focus to the close button and accepted only one character.
  const closeCart = useCallback(() => setCartOpen(false), [setCartOpen]);
  const drawerRef = useDialogFocus(cartOpen, closeCart);
  const submitting = isPending("order:create:customer");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pickupName, setPickupName] = useState("");
  const [pickupPhone, setPickupPhone] = useState("");

  useEffect(() => {
    if (!cartOpen || !cart.length) setReviewOpen(false);
  }, [cart.length, cartOpen]);

  if (!cartOpen) return null;
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={closeCart}>
      <aside className="cart-drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label="Current cart" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()}>
        <div className="cart-drawer__header">
          <div><span className="eyebrow">Your selection</span><h2>{itemCount} {itemCount === 1 ? "item" : "items"} on the tray</h2></div>
          <button type="button" className="icon-button" onClick={closeCart} aria-label="Close cart"><X /></button>
        </div>
        <div className="cart-drawer__items">
          {cart.length ? cart.map((line) => (
            <article className="cart-line" key={line.id}>
              <div className={"cart-line__swatch swatch--" + line.item.color}>{line.item.glyph}</div>
              <div className="cart-line__body"><strong>{line.item.name}</strong><span>{cartLineLabels(line).join(" / ") || "Kitchen standard"}</span><b>{formatMoney(cartLineTotal(line))}</b></div>
              <QuantityControl quantity={line.quantity} onChange={(adjustment) => updateLineQuantity(line.id, adjustment)} compact />
            </article>
          )) : <div className="empty-state"><ShoppingBag size={30} /><strong>Your tray is ready for a favourite.</strong><span>Tap Add on any dish to begin.</span></div>}
        </div>
        {cart.length > 0 && <div className="cart-drawer__footer">
          <button type="button" className="quiet-button" onClick={clearCart} disabled={submitting}><Trash2 size={16} /> Clear tray</button>
          <dl className="order-totals">
            <div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div>
            {pricing.tax.enabled && <div><dt>{pricing.tax.inclusive ? "Tax included" : "Taxes"}</dt><dd>{formatMoney(cartTax)}</dd></div>}
            {cartService > 0 && <div><dt>Service</dt><dd>{formatMoney(cartService)}</dd></div>}
            <div className="order-totals__total"><dt>Total</dt><dd>{formatMoney(cartTotal)}</dd></div>
          </dl>
          {reviewOpen ? <div className="cart-review" aria-live="polite">
            <div><span className="eyebrow">Review before sending</span><strong>{orderMode === "PICKUP" ? "Pickup details" : "Table order"}</strong></div>
            {orderMode === "PICKUP" ? <><label>Pickup name<input required value={pickupName} onChange={(event) => setPickupName(event.currentTarget.value)} maxLength={100} placeholder="Your name" autoComplete="name" /></label><label>Phone <small>optional</small><input value={pickupPhone} onChange={(event) => setPickupPhone(event.currentTarget.value)} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="For an order question" /></label></> : <p>Your order is sent only to the table connected to this QR code.</p>}
            <p className="cart-review__note">Please check your items and total. Payment and pickup readiness are confirmed by the restaurant after submission.</p>
            <div className="cart-review__actions"><button type="button" className="quiet-button" onClick={() => setReviewOpen(false)} disabled={submitting}><ArrowLeft size={16} /> Edit tray</button><button type="button" className="button button--saffron" onClick={() => { void onCheckout?.(orderMode === "PICKUP" ? { name: pickupName.trim() || "Guest", phone: pickupPhone.trim() || undefined } : undefined); }} disabled={submitting || (orderMode === "PICKUP" && !pickupName.trim())}>{submitting ? "Sending order…" : "Confirm and send"} <ArrowRight size={17} /></button></div>
          </div> : <button type="button" className="button button--saffron button--full" onClick={() => setReviewOpen(true)} disabled={submitting}><span>{checkoutLabel}</span><ArrowRight size={18} /></button>}
        </div>}
      </aside>
    </div>
  );
};
