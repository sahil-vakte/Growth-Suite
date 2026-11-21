import { defineConfig, devices } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
if (existsSync(".env")) loadEnvFile(".env");
const baseURL = process.env.E2E_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm start -- --hostname localhost --port ${new URL(baseURL).port || "3000"}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI || process.env.E2E_REUSE_SERVER === "true",
    timeout: 120_000,
    env: { INTEGRATIONS_MODE: "mock", APP_URL: baseURL },
  },
});
