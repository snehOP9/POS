import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
const requireProductionApi = process.env.VERCEL_ENV === "production";
const configuredApiUrl = process.env.VITE_API_URL?.trim();
if (requireProductionApi && !/^https:\/\//.test(configuredApiUrl ?? "")) {
  throw new Error("VITE_API_URL must be an HTTPS backend origin for a Vercel production build.");
}

export default defineConfig({
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
