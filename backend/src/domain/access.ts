export const ROLES = ["CUSTOMER", "WAITER", "KITCHEN", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "canApplyDiscount",
  "canCancelOrder",
  "canRefundPayment",
  "canEditMenuAvailability",
  "canOpenShift",
  "canCloseShift",
  "canViewReports",
  "canEditRestaurantSettings",
  "canManageStaff",
  "canOverridePrice"
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const CASHIER_SUPERVISOR_PERMISSIONS: Permission[] = [...PERMISSIONS];
