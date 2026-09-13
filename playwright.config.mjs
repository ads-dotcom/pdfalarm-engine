import { defineConfig } from "@playwright/test";
const external = process.env.BASE_URL;
export default defineConfig({
  testDir: "./browser",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  outputDir: "output/browser",
  reporter: "list",
  use: {
    baseURL: external ?? "http://127.0.0.1:8787",
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROME
      ? {
          executablePath:
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        }
      : {},
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: external
    ? undefined
    : {
        command: "npm run dev -- --ip 127.0.0.1 --port 8787",
        url: "http://127.0.0.1:8787/health",
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});
