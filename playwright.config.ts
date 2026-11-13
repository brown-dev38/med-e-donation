import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: { baseURL: "http://localhost:3120", channel: "chrome", trace: "off" },
  webServer: {
    command: "npm run dev -- --port 3120",
    url: "http://localhost:3120/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
