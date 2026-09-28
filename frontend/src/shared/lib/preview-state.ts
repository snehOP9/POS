import type { DiningTable, KitchenTicket, Order } from "@/shared/types/domain";
import { initialOrders, initialTables, initialTickets } from "@/shared/data/demo";

const storageKey = "emberserve.preview-restaurant:v1";
const channelName = "emberserve.preview-restaurant:v1";

export type PreviewRestaurantState = {
  revision: number;
  origin: string;
  tables: DiningTable[];
  orders: Order[];
  tickets: KitchenTicket[];
};

export const createPreviewOrigin = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `preview-${Math.random().toString(36).slice(2)}`;

export const previewSeed = (origin: string): PreviewRestaurantState => ({
  revision: Date.now(),
  origin,
  tables: initialTables,
  orders: initialOrders,
  tickets: initialTickets,
});

export const readPreviewState = (): PreviewRestaurantState | undefined => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return undefined;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return undefined;
    const state = value as Partial<PreviewRestaurantState>;
    if (typeof state.revision !== "number" || typeof state.origin !== "string") return undefined;
    if (!Array.isArray(state.tables) || !Array.isArray(state.orders) || !Array.isArray(state.tickets)) return undefined;
    return state as PreviewRestaurantState;
  } catch {
    return undefined;
  }
};

export const writePreviewState = (state: PreviewRestaurantState): void => {
  localStorage.setItem(storageKey, JSON.stringify(state));
};

export const clearPreviewState = (): void => {
  localStorage.removeItem(storageKey);
};

export const isNewerPreviewState = (candidate: PreviewRestaurantState, current: PreviewRestaurantState | undefined): boolean => {
  if (!current) return true;
  if (candidate.revision !== current.revision) return candidate.revision > current.revision;
  return candidate.origin > current.origin;
};

export const createPreviewChannel = (): BroadcastChannel | undefined =>
  typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(channelName);
