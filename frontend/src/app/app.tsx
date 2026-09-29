import { lazy, Suspense, useEffect, type PropsWithChildren } from "react";
import { ArrowRight, Flame, LockKeyhole } from "lucide-react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { NotificationCenter } from "@/shared/components/notification-center";
import { ServiceWorkerUpdateNotice } from "@/shared/components/service-worker-update";
import { ToastRail } from "@/shared/components/toast-rail";
import { updateDocumentMetadata } from "@/shared/lib/seo";
import { PosProvider, usePos } from "@/shared/store/pos-store";
import type { Role } from "@/shared/types/domain";

const MenuPage = lazy(async () => ({ default: (await import("@/customer/menu-page")).MenuPage }));
const CashierPage = lazy(async () => ({ default: (await import("@/cashier/cashier-page")).CashierPage }));
const WaiterPage = lazy(async () => ({ default: (await import("@/waiter/waiter-page")).WaiterPage }));
const KitchenPage = lazy(async () => ({ default: (await import("@/kitchen/kitchen-page")).KitchenPage }));
const LoginPage = lazy(async () => ({ default: (await import("@/auth/login-page")).LoginPage }));
const LegalPage = lazy(async () => ({ default: (await import("@/public/public-pages")).LegalPage }));

const TitleUpdater = () => {
  const location = useLocation();
  useEffect(() => {
    updateDocumentMetadata(location.pathname);
  }, [location.pathname]);
  return null;
};

const NotFound = () => <main className="not-found">
  <div className="not-found__flame"><Flame size={34} /></div>
  <span className="eyebrow">That order number is not on the board</span>
  <h1>We could not find that page.</h1>
  <p>Return to the menu, or use the protected staff sign-in if you meant to open a work area.</p>
  <div className="not-found__actions">
    <Link className="button button--saffron" to="/menu">Browse menu <ArrowRight size={17} /></Link>
    <Link className="outline-button" to="/staff/login"><LockKeyhole size={16} /> Staff sign in</Link>
  </div>
</main>;

const RouteLoader = () => <main className="route-loader" aria-live="polite"><span /><span /><span /><strong>Loading the next station...</strong></main>;

const RoleGuard = ({ role, children }: PropsWithChildren<{ role: Role }>) => {
  const { session, authLoading } = usePos();
  const location = useLocation();
  if (authLoading) return <RouteLoader />;
  if (!session || session.role !== role) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

export const App = () => <BrowserRouter>
  <PosProvider>
    <TitleUpdater />
    <Suspense fallback={<RouteLoader />}>
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/cashier" element={<RoleGuard role="CASHIER"><CashierPage /></RoleGuard>} />
        <Route path="/waiter" element={<RoleGuard role="WAITER"><WaiterPage /></RoleGuard>} />
        <Route path="/kitchen" element={<RoleGuard role="KITCHEN"><KitchenPage /></RoleGuard>} />
        <Route path="/customer/login" element={<LoginPage audience="customer" />} />
        <Route path="/staff/login" element={<LoginPage audience="staff" />} />
        <Route path="/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    <ServiceWorkerUpdateNotice />
    <NotificationCenter />
    <ToastRail />
  </PosProvider>
</BrowserRouter>;
