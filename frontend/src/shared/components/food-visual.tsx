import type { MenuItem } from "@/shared/types/domain";

export const FoodVisual = ({ item, size = "card" }: { item: Pick<MenuItem, "color" | "glyph" | "name">; size?: "card" | "feature" | "mini" }) => (
  <div className={`food-visual food-visual--${item.color} food-visual--${size}`} role="img" aria-label={`Illustration of ${item.name}`}>
    <span className="food-visual__plate" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--one" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--two" aria-hidden="true" />
    <b>{item.glyph}</b>
  </div>
);
