import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/app";
import "@/shared/styles.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const notifyUpdate = (registration: ServiceWorkerRegistration) => {
    if (navigator.serviceWorker.controller) {
      window.dispatchEvent(new CustomEvent<ServiceWorkerRegistration>("emberserve:sw-update", { detail: registration }));
    }
  };
  const watchInstalling = (registration: ServiceWorkerRegistration, worker: ServiceWorker) => {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") notifyUpdate(registration);
    });
  };

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (registration.waiting) notifyUpdate(registration);
      if (registration.installing) watchInstalling(registration, registration.installing);
      registration.addEventListener("updatefound", () => {
        if (registration.installing) watchInstalling(registration, registration.installing);
      });
    }).catch(() => undefined);
  });
}
