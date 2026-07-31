import type { OrderStatus } from "@/shared/types/domain";

const labels: Record<string, string> = {
  DRAFT: "Draft",
  PLACED: "Placed",
  CONFIRMED: "Confirmed",
  ACCEPTED_BY_KITCHEN: "Accepted",
  PREPARING: "Cooking",
  PARTIALLY_READY: "Part ready",
  READY: "Ready",
  SERVED: "Served",
  COMPLETED: "Completed",
  PENDING: "Queued",
  QUEUED: "Queued",
  PAID: "Paid",
  UNPAID: "Unpaid",
  new: "New",
  preparing: "Cooking",
  ready: "Ready",
  available: "Available",
  seated: "Dining",
  attention: "Attention",
  bill: "Bill requested",
};

const classFor = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes("ready") || normalized === "paid" || normalized === "completed") return "is-ready";
  if (normalized.includes("prepar") || normalized === "seated" || normalized === "confirmed") return "is-cooking";
  if (normalized.includes("attention") || normalized.includes("bill")) return "is-urgent";
  if (normalized === "served") return "is-served";
  return "is-new";
};

export const StatusPill = ({ status, label, subtle = false }: { status: string | OrderStatus; label?: string; subtle?: boolean }) => (
  <span className={`status-pill ${classFor(status)} ${subtle ? "status-pill--subtle" : ""}`}>
    <span className="status-pill__dot" aria-hidden="true" />
    {label ?? labels[status] ?? status.replaceAll("_", " ")}
  </span>
);
