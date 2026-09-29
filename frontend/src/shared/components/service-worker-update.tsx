import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

export const ServiceWorkerUpdateNotice = () => {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onUpdate = (event: Event) => {
      setRegistration((event as CustomEvent<ServiceWorkerRegistration>).detail);
      setDismissed(false);
    };
    window.addEventListener("emberserve:sw-update", onUpdate);
    return () => window.removeEventListener("emberserve:sw-update", onUpdate);
  }, []);

  if (!registration || dismissed) return null;

  const reloadWhenReady = () => {
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, { once: true });
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  };

  return <aside className="sw-update-notice" role="status" aria-live="polite">
    <div><strong>Update ready</strong><span>Finish any order or payment step first, then reload when convenient.</span></div>
    <button type="button" className="quiet-button" onClick={reloadWhenReady}><RefreshCw size={16} /> Reload safely</button>
    <button type="button" className="icon-button" onClick={() => setDismissed(true)} aria-label="Dismiss update notice"><X size={17} /></button>
  </aside>;
};
