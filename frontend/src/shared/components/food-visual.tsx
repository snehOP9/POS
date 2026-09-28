import type { MenuItem } from "@/shared/types/domain";

export const FoodVisual = ({ item, size = "card" }: { item: Pick<MenuItem, "color" | "glyph" | "name" | "imageUrl">; size?: "card" | "feature" | "mini" }) => (
  <div className={`food-visual food-visual--${item.color} food-visual--${size} ${item.imageUrl ? "food-visual--photo" : ""}`} role="img" aria-label={item.imageUrl ? `Photo of ${item.name}` : `Illustration of ${item.name}`}>
    {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" decoding="async" /> : null}
    <span className="food-visual__plate" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--one" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--two" aria-hidden="true" />
    <b>{item.glyph}</b>
  </div>
);
