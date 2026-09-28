import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const frontendRoot = fileURLToPath(new URL(".", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${npm} run dev -- --host 127.0.0.1`,
    cwd: frontendRoot,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
