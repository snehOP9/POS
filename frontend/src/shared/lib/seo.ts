export type PublicRoute = "/menu" | "/privacy" | "/terms";

type PageMetadata = {
  title: string;
  description: string;
  indexable: boolean;
};

const pages: Record<PublicRoute, PageMetadata> = {
  "/menu": {
    title: "Restaurant menu | EmberServe POS",
    description: "Browse current menu availability and begin a pickup or table order.",
    indexable: true,
  },
  "/privacy": {
    title: "Privacy notice | EmberServe POS",
    description: "How EmberServe POS handles ordering, session, and browser-storage information.",
    indexable: true,
  },
  "/terms": {
    title: "Terms of use | EmberServe POS",
    description: "Terms for using the EmberServe POS customer and staff application.",
    indexable: true,
  },
};

const internalPages: Record<string, PageMetadata> = {
  "/cashier": { title: "Cashier workspace | EmberServe POS", description: "Protected cashier workspace.", indexable: false },
  "/waiter": { title: "Waiter workspace | EmberServe POS", description: "Protected waiter workspace.", indexable: false },
  "/kitchen": { title: "Kitchen display | EmberServe POS", description: "Protected kitchen display.", indexable: false },
  "/staff/login": { title: "Staff sign in | EmberServe POS", description: "Protected staff sign-in.", indexable: false },
  "/customer/verify": { title: "Confirm mobile | EmberServe POS", description: "Confirm a guest mobile number by SMS before placing an order.", indexable: false },
  "/login": { title: "Sign in | EmberServe POS", description: "Sign-in route.", indexable: false },
};

const upsertMeta = (attribute: "name" | "property", key: string, content: string) => {
  const selector = 'meta[' + attribute + '="' + key + '"]';
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  const meta = existing ?? document.createElement("meta");
  meta.setAttribute(attribute, key);
  meta.content = content;
  if (!existing) document.head.append(meta);
};

const upsertCanonical = (href: string) => {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  const link = existing ?? document.createElement("link");
  link.rel = "canonical";
  link.href = href;
  if (!existing) document.head.append(link);
};

const upsertSchema = (pathname: string, indexable: boolean, canonical: string) => {
  const id = "emberserve-page-schema";
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (!indexable || pathname !== "/menu") {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "EmberServe POS menu",
    url: canonical,
    description: pages["/menu"].description,
  });
  if (!existing) document.head.append(script);
};

export const updateDocumentMetadata = (pathname: string) => {
  const page = pages[pathname as PublicRoute] ?? internalPages[pathname];
  const metadata = page ?? {
    title: "Page not found | EmberServe POS",
    description: "The requested EmberServe POS page could not be found.",
    indexable: false,
  };
  const canonical = new URL(pathname, window.location.origin).toString();
  const socialImage = new URL("/social-card.svg", window.location.origin).toString();

  document.title = metadata.title;
  upsertMeta("name", "description", metadata.description);
  upsertMeta("name", "robots", metadata.indexable ? "index, follow" : "noindex, nofollow, noarchive");
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", metadata.title);
  upsertMeta("property", "og:description", metadata.description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", socialImage);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", metadata.title);
  upsertMeta("name", "twitter:description", metadata.description);
  upsertMeta("name", "twitter:image", socialImage);
  upsertCanonical(canonical);
  upsertSchema(pathname, metadata.indexable, canonical);
};
