import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/shared/types/domain";

const responsiveSrcSet = (imageUrl?: string) => {
  if (!imageUrl) return undefined;
  try {
    const source = new URL(imageUrl);
    if (!/(?:images\.unsplash\.com|images\.pexels\.com)$/i.test(source.hostname)) return undefined;
    return [480, 760, 1200].map((width) => {
      const candidate = new URL(source.toString());
      candidate.searchParams.set("w", String(width));
      candidate.searchParams.set("auto", "compress");
      return candidate.toString() + " " + width + "w";
    }).join(", ");
  } catch {
    return undefined;
  }
};

export const FoodVisual = ({ item, size = "card", decorative = false }: {
  item: Pick<MenuItem, "color" | "glyph" | "name" | "imageUrl">;
  size?: "card" | "feature" | "mini";
  decorative?: boolean;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string>();
  const imageUrl = imageFailed ? undefined : item.imageUrl;
  const imageLoaded = loadedImageUrl === item.imageUrl;
  const srcSet = useMemo(() => responsiveSrcSet(imageUrl), [imageUrl]);

  useEffect(() => {
    setImageFailed(false);
  }, [item.imageUrl]);

  return <div
    className={["food-visual", "food-visual--" + item.color, "food-visual--" + size, imageUrl ? "food-visual--photo" : "", imageUrl && !imageLoaded ? "food-visual--loading" : "", imageFailed ? "food-visual--fallback" : ""].filter(Boolean).join(" ")}
    role={!decorative && !imageUrl ? "img" : undefined}
    aria-label={!decorative && !imageUrl ? item.name + " dish illustration" : undefined}
    aria-hidden={decorative || undefined}
  >
    {imageUrl && <img
      src={imageUrl}
      srcSet={srcSet}
      sizes={size === "feature" ? "(max-width: 680px) 78vw, 360px" : "(max-width: 680px) 46vw, 260px"}
      alt={decorative ? "" : item.name}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoadedImageUrl(item.imageUrl)}
      onError={() => setImageFailed(true)}
    />}
    {imageUrl && !imageLoaded && <span className="food-visual__loading" aria-hidden="true" />}
    <span className="food-visual__plate" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--one" aria-hidden="true" />
    <span className="food-visual__garnish food-visual__garnish--two" aria-hidden="true" />
    <b aria-hidden="true">{item.glyph}</b>
  </div>;
};
