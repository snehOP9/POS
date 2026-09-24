import type { Role } from "@/shared/types/domain";

type JsonRecord = Record<string, unknown>;

const configuredUrl = import.meta.env.VITE_API_URL?.trim() || "http://localhost:4000";
export const apiRoot = configuredUrl.replace(/\/$/, "").endsWith("/api/v1")
  ? configuredUrl.replace(/\/$/, "")
  : `${configuredUrl.replace(/\/$/, "")}/api/v1`;

const sessionKey = "emberserve.session";

export const getAccessToken = () => sessionStorage.getItem(sessionKey) ?? undefined;
export const setAccessToken = (token?: string) => {
  if (token) sessionStorage.setItem(sessionKey, token);
  else sessionStorage.removeItem(sessionKey);
};

type ApiRequestOptions = RequestInit & { token?: string; retriedAfterRefresh?: boolean };

const extractData = <T>(payload: unknown): T => {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthResponse {
  accessToken: string;
  user: { name: string; role: Role };
}

export interface CurrentUserResponse {
  user: { name: string; role: Role };
}

let refreshInFlight: Promise<AuthResponse> | undefined;

const refreshAccessToken = (): Promise<AuthResponse> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = fetch(`${apiRoot}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }).then(async (response) => {
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const envelope = body as { message?: string; error?: { code?: string; message?: string }; code?: string };
      throw new ApiError(
        envelope.error?.message ?? envelope.message ?? "Your session could not be renewed.",
        envelope.error?.code ?? envelope.code,
        response.status,
      );
    }
    const payload = extractData<AuthResponse>(body);
    setAccessToken(payload.accessToken);
    return payload;
  }).finally(() => {
    refreshInFlight = undefined;
  });

  return refreshInFlight;
};

const logout = async (): Promise<unknown> => {
  const request = (token?: string) => apiRequest<unknown>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
    token,
  });
  try {
    return await request();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const refreshed = await refreshAccessToken();
    return request(refreshed.accessToken);
  }
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { token, headers, retriedAfterRefresh, ...requestOptions } = options;
  const response = await fetch(`${apiRoot}${path}`, {
    ...requestOptions,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ?? getAccessToken() ? { Authorization: `Bearer ${token ?? getAccessToken()}` } : {}),
      ...headers,
    },
  });

  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !retriedAfterRefresh && !path.startsWith("/auth/")) {
      try {
        const refreshed = await refreshAccessToken();
        return apiRequest<T>(path, { ...options, token: refreshed.accessToken, retriedAfterRefresh: true });
      } catch {
        setAccessToken();
      }
    }
    const envelope = body as { message?: string; error?: { code?: string; message?: string }; code?: string };
    throw new ApiError(
      envelope.error?.message ?? envelope.message ?? "Something went wrong. Please try again.",
      envelope.error?.code ?? envelope.code,
      response.status,
    );
  }
  return extractData<T>(body);
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type LoginResponse = AuthResponse;

export const api = {
  auth: {
    login: (payload: LoginPayload) =>
      apiRequest<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    refresh: refreshAccessToken,
    me: () => apiRequest<CurrentUserResponse>("/auth/me"),
    logout,
  },
  menu: {
    getPublic: (filters?: { search?: string; category?: string; vegetarian?: boolean; available?: boolean }) => {
      const query = new URLSearchParams();
      if (filters?.search) query.set("search", filters.search);
      if (filters?.category && filters.category !== "All") query.set("category", filters.category);
      if (filters?.vegetarian) query.set("vegetarian", "true");
      if (filters?.available) query.set("available", "true");
      return apiRequest<unknown>(`/menu${query.size ? `?${query.toString()}` : ""}`);
    },
  },
  orders: {
    list: () => apiRequest<unknown>("/orders?page=1&limit=100"),
    create: (payload: JsonRecord) =>
      apiRequest<unknown>("/orders", { method: "POST", body: JSON.stringify(payload) }),
    updateStatus: (orderId: string, status: string) =>
      apiRequest<unknown>(`/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    updateItem: (orderId: string, lineId: string, status: string) =>
      apiRequest<unknown>(`/orders/${orderId}/items/${lineId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  kitchen: {
    listTickets: () => apiRequest<unknown>("/kitchen/tickets"),
    updateTicket: (ticketId: string, status: string) =>
      apiRequest<unknown>(`/kitchen/tickets/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    updateItem: (ticketId: string, lineId: string, status: string) =>
      apiRequest<unknown>(`/kitchen/tickets/${ticketId}/items/${lineId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  },
  waiter: {
    listTables: () => apiRequest<unknown>("/waiter/tables"),
    createOrder: (tableId: string, payload: JsonRecord) =>
      apiRequest<unknown>(`/waiter/tables/${tableId}/orders`, { method: "POST", body: JSON.stringify(payload) }),
    requestBill: (orderId: string) =>
      apiRequest<unknown>(`/waiter/orders/${orderId}/bill-request`, { method: "POST" }),
  },
  tables: {
    list: () => apiRequest<unknown>("/tables"),
  },
  cashier: {
    listOrders: () => apiRequest<unknown>("/cashier/orders?page=1&limit=100"),
    createOrder: (payload: JsonRecord) =>
      apiRequest<unknown>("/cashier/orders", { method: "POST", body: JSON.stringify(payload) }),
  },
  payments: {
    cash: (payload: JsonRecord) =>
      apiRequest<unknown>("/payments/cash", { method: "POST", body: JSON.stringify(payload) }),
  },
};
