import { lazy, Suspense, useEffect, type PropsWithChildren } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ToastRail } from "@/shared/components/toast-rail";
import { PosProvider, usePos } from "@/shared/store/pos-store";
import type { Role } from "@/shared/types/domain";

const MenuPage = lazy(async () => ({ default: (await import("@/customer/menu-page")).MenuPage }));
const CashierPage = lazy(async () => ({ default: (await import("@/cashier/cashier-page")).CashierPage }));
const WaiterPage = lazy(async () => ({ default: (await import("@/waiter/waiter-page")).WaiterPage }));
const KitchenPage = lazy(async () => ({ default: (await import("@/kitchen/kitchen-page")).KitchenPage }));
const LoginPage = lazy(async () => ({ default: (await import("@/auth/login-page")).LoginPage }));

const pageNames: Record<string, string> = {
  "/menu": "Guest menu",
  "/cashier": "Cashier",
  "/waiter": "Waiter service",
  "/kitchen": "Kitchen display",
  "/login": "Sign in",
};

const TitleUpdater = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = `${pageNames[location.pathname] ?? "EmberServe"} · EmberServe POS`;
  }, [location.pathname]);
  return null;
};

const NotFound = () => <main className="not-found"><div className="not-found__flame"><Flame size={34} /></div><span className="eyebrow">That order number isn’t on the board</span><h1>We couldn’t find that page.</h1><p>Take a shortcut back to the EmberServe menu.</p><Link className="button button--saffron" to="/menu">Browse menu <ArrowRight size={17} /></Link></main>;

const RouteLoader = () => <main className="route-loader" aria-live="polite"><span /><span /><span /><strong>Lighting the next station…</strong></main>;

const RoleGuard = ({ role, children }: PropsWithChildren<{ role: Role }>) => {
  const { session, authLoading } = usePos();
  const location = useLocation();
  if (authLoading) return <RouteLoader />;
  if (!session || session.role !== role) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

export const App = () => <BrowserRouter><PosProvider><TitleUpdater /><Suspense fallback={<RouteLoader />}><Routes><Route path="/" element={<Navigate to="/menu" replace />} /><Route path="/menu" element={<MenuPage />} /><Route path="/cashier" element={<RoleGuard role="CASHIER"><CashierPage /></RoleGuard>} /><Route path="/waiter" element={<RoleGuard role="WAITER"><WaiterPage /></RoleGuard>} /><Route path="/kitchen" element={<RoleGuard role="KITCHEN"><KitchenPage /></RoleGuard>} /><Route path="/login" element={<LoginPage />} /><Route path="*" element={<NotFound />} /></Routes></Suspense><ToastRail /></PosProvider></BrowserRouter>;
