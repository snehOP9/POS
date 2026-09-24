import type { CartLine, CartModifierSelection, MenuItem, MenuModifierOption, MenuVariant, RestaurantPricingConfig } from "@/shared/types/domain";

export interface CartSelection {
  variant?: MenuVariant;
  modifiers?: CartModifierSelection[];
}

export interface CartPricing {
  subtotal: number;
  tax: number;
  service: number;
  total: number;
}

export const fallbackRestaurantPricing: RestaurantPricingConfig = {
  currency: "INR",
  tax: { enabled: true, rateBasisPoints: 500, inclusive: false },
  serviceCharge: { enabled: false, rateBasisPoints: 0 },
};

export const unitPriceForSelection = (item: MenuItem, selection: CartSelection = {}): number =>
  item.price + (selection.variant?.priceDelta ?? 0) + (selection.modifiers ?? []).reduce((total, modifier) => total + modifier.priceDelta, 0);

export const cartLineUnitPrice = (line: CartLine): number => unitPriceForSelection(line.item, line);
export const cartLineTotal = (line: CartLine): number => cartLineUnitPrice(line) * line.quantity;
export const cartLineLabels = (line: Pick<CartLine, "variant" | "modifiers">): string[] => [
  ...(line.variant ? [line.variant.name] : []),
  ...(line.modifiers?.map((modifier) => modifier.name) ?? []),
];
export const cartSelectionKey = (item: MenuItem, selection: CartSelection = {}): string => [item.id, selection.variant?.id ?? "standard", ...(selection.modifiers ?? []).map((modifier) => modifier.id).sort()].join("|");
export const selectionForOption = (group: { id: string; name: string }, option: MenuModifierOption): CartModifierSelection => ({ ...option, groupId: group.id, groupName: group.name });

export const calculateCartPricing = (subtotal: number, pricing: RestaurantPricingConfig): CartPricing => {
  const subtotalPaise = Math.round(subtotal * 100);
  const taxPaise = pricing.tax.enabled
    ? pricing.tax.inclusive
      ? Math.round((subtotalPaise * pricing.tax.rateBasisPoints) / (10_000 + pricing.tax.rateBasisPoints))
      : Math.round((subtotalPaise * pricing.tax.rateBasisPoints) / 10_000)
    : 0;
  const servicePaise = pricing.serviceCharge.enabled
    ? Math.round((subtotalPaise * pricing.serviceCharge.rateBasisPoints) / 10_000)
    : 0;
  return {
    subtotal,
    tax: taxPaise / 100,
    service: servicePaise / 100,
    total: (subtotalPaise + (pricing.tax.inclusive ? 0 : taxPaise) + servicePaise) / 100,
  };
};
