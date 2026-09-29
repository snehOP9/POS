import { ArrowRight, ShoppingBag, Trash2, X } from "lucide-react";
import { formatMoney } from "@/shared/lib/format";
import { QuantityControl } from "@/shared/components/quantity-control";
import { useDialogFocus } from "@/shared/hooks/useDialogFocus";
import { usePos } from "@/shared/store/pos-store";
import { cartLineLabels, cartLineTotal } from "@/shared/lib/cart";

interface CartDrawerProps {
  checkoutLabel?: string;
  onCheckout?: () => void;
  pickupDetails?: {
    name: string;
    phone: string;
    onNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
  };
}

export const CartDrawer = ({ checkoutLabel = "Send order", onCheckout, pickupDetails }: CartDrawerProps) => {
  const {
    cart, cartOpen, setCartOpen, updateLineQuantity, clearCart,
    cartSubtotal, cartTax, cartService, cartTotal, cartMode, pricing, isPending,
  } = usePos();
  const itemCount = cart.reduce((count, line) => count + line.quantity, 0);
  const drawerRef = useDialogFocus(cartOpen, () => setCartOpen(false));
  const pickupNameInvalid = cartMode === "PICKUP" && (!pickupDetails || pickupDetails.name.trim().length < 2);
  const pickupPhoneDigits = pickupDetails?.phone.replace(/\D/g, "") ?? "";
  const pickupPhoneInvalid = cartMode === "PICKUP" && (!pickupDetails || pickupPhoneDigits.length < 7 || pickupPhoneDigits.length > 15);
  const pickupIncomplete = pickupNameInvalid || pickupPhoneInvalid;
  const submitting = isPending("order:create:customer");
  const pickupHelp = pickupNameInvalid ? "Enter a name with at least 2 characters." : pickupPhoneInvalid ? "Enter a phone number with 7 to 15 digits." : "We use these details only to identify a pickup order.";

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
              <div className={"cart-line__swatch swatch--" + line.item.color}>{line.item.glyph}</div>
              <div className="cart-line__body"><strong>{line.item.name}</strong><span>{cartLineLabels(line).join(" / ") || "Kitchen standard"}</span><b>{formatMoney(cartLineTotal(line))}</b></div>
              <QuantityControl quantity={line.quantity} onChange={(adjustment) => updateLineQuantity(line.id, adjustment)} compact />
            </article>
          )) : <div className="empty-state"><ShoppingBag size={30} /><strong>Your tray is ready for a favourite.</strong><span>Tap Add on any dish to begin.</span></div>}
        </div>
        {cart.length > 0 && <div className="cart-drawer__footer">
          <button type="button" className="quiet-button" onClick={clearCart} disabled={submitting}><Trash2 size={16} /> Clear tray</button>
          {cartMode === "PICKUP" && pickupDetails && <fieldset className="cart-checkout-details">
            <legend>Pickup contact</legend>
            <p id="pickup-contact-help" className={pickupIncomplete ? "form-help form-help--error" : "form-help"} aria-live="polite">{pickupHelp}</p>
            <label>Name
              <input value={pickupDetails.name} onChange={(event) => pickupDetails.onNameChange(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required aria-invalid={pickupNameInvalid} aria-describedby="pickup-contact-help" placeholder="Your name" />
            </label>
            <label>Phone
              <input value={pickupDetails.phone} onChange={(event) => pickupDetails.onPhoneChange(event.target.value.replace(/[^0-9+ -]/g, ""))} autoComplete="tel" inputMode="tel" minLength={7} maxLength={30} required aria-invalid={pickupPhoneInvalid} aria-describedby="pickup-contact-help" placeholder="Mobile number" />
            </label>
          </fieldset>}
          <dl className="order-totals">
            <div><dt>Items</dt><dd>{formatMoney(cartSubtotal)}</dd></div>
            {pricing.tax.enabled && <div><dt>{pricing.tax.inclusive ? "Tax included" : "Taxes"}</dt><dd>{formatMoney(cartTax)}</dd></div>}
            {cartService > 0 && <div><dt>Service</dt><dd>{formatMoney(cartService)}</dd></div>}
            <div className="order-totals__total"><dt>Total</dt><dd>{formatMoney(cartTotal)}</dd></div>
          </dl>
          <button type="button" className="button button--saffron button--full" onClick={onCheckout} disabled={pickupIncomplete || submitting}><span>{submitting ? "Sending order." : pickupIncomplete ? "Add valid pickup contact" : checkoutLabel}</span><ArrowRight size={18} /></button>
        </div>}
      </aside>
    </div>
  );
};
