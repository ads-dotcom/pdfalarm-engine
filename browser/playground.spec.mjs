import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
async function ready(page) {
  await expect(page.getByRole("status")).toHaveText(
    "Your PDF is ready. Preview it or download the file.",
    { timeout: 45000 },
  );
  await expect(page.locator("#pdf-canvas")).toBeVisible();
}
test("examples preview and download real PDFs without sending document data", async ({
  page,
  context,
}, info) => {
  const errors = [],
    posts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  await page.goto("/");
  await ready(page);
  for (const name of ["Label", "Certificate", "Invoice"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await ready(page);
  }
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download").click();
  const download = await downloadPromise;
  const path = info.outputPath("download.pdf");
  await download.saveAs(path);
  expect((await fs.readFile(path)).subarray(0, 5).toString()).toBe("%PDF-");
  expect(posts).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("playground.png"),
    fullPage: true,
  });
});
test("switching examples disables the previous download while loading", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/examples/label.*.json", async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Label", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Loading the example…");
  await expect(page.locator("#download")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.locator("#download")).not.toHaveAttribute("href");
  release();
  await ready(page);
  await expect(page.locator("#download")).toHaveAttribute(
    "download",
    "pdfalarm-label.pdf",
  );
});
test("invalid JSON and invalid templates show actionable errors", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.locator("#data-input").fill("{bad");
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(page.locator("#error")).toContainText("not valid JSON");
  await expect(page.locator("#download")).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.getByRole("button", { name: "Reset example" }).click();
  await ready(page);
  await page
    .locator("summary")
    .filter({ hasText: "Edit the template" })
    .click();
  const template = JSON.parse(
    await page.locator("#template-input").inputValue(),
  );
  template.pages[0].elements[0].type = "UNKNOWN";
  await page.locator("#template-input").fill(JSON.stringify(template));
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await expect(page.locator("#error")).toContainText("INVALID_TEMPLATE");
});
test("long tables paginate and page navigation works", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const data = JSON.parse(await page.locator("#data-input").inputValue());
  data.items = Array.from({ length: 90 }, (_, i) => ({
    description: `Line ${i} · Şişli, İstanbul`,
    quantity: i,
    amount: 20,
  }));
  await page.locator("#data-input").fill(JSON.stringify(data));
  await page.getByRole("button", { name: "Generate PDF", exact: true }).click();
  await ready(page);
  const text = await page.locator("#page-number").innerText();
  const total = Number(text.split("/")[1]);
  expect(total).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("#page-number")).toHaveText(`2 / ${total}`);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(page.locator("#page-number")).toHaveText(`1 / ${total}`);
});
test("public docs, health, samples and missing pages respond correctly", async ({
  request,
}) => {
  const health = await request.get("/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).status).toBe("ok");
  for (const url of [
    "/docs.html",
    "/privacy.html",
    "/licenses.html",
    "/examples/invoice.template.json",
  ])
    expect((await request.get(url)).status()).toBe(200);
  for (const name of ["invoice", "label", "certificate", "overlay", "base"]) {
    const r = await request.get(`/samples/${name}.pdf`);
    expect(r.status()).toBe(200);
    expect((await r.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  expect((await request.get("/a-page-that-does-not-exist")).status()).toBe(404);
});

test("visible pages pass automated accessibility checks", async ({ page }) => {
  for (const path of ["/", "/docs.html", "/privacy.html"]) {
    await page.goto(path);
    if (path === "/") await ready(page);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  }
});
