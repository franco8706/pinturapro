const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones } = require("./_ayuda.cjs");

(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/ingresar");
    await page.waitForSelector("form input", { timeout: 10000 });
    await sacarRestricciones(page);
    await page.locator("form input").nth(0).fill("a@");
    await page.locator("form input").nth(1).fill("Demo1234!");
    const requests = [];
    page.on("request", (r) => {
      if (r.url().includes("supabase")) requests.push(r.url());
    });
    await page.click("button[type=submit]");
    await page.waitForTimeout(2500);
    const alerts = await page.evaluate(() =>
      [...document.querySelectorAll('[role="alert"]')].map((e) => ({ html: e.outerHTML, texto: e.textContent })),
    );
    const bodyText = await page.locator("body").innerText();
    console.log("requests:", JSON.stringify(requests));
    console.log("alerts:", JSON.stringify(alerts, null, 2));
    console.log("--- body text (primeros 800) ---");
    console.log(bodyText.slice(0, 800));
  } finally {
    await browser.close();
  }
})();
