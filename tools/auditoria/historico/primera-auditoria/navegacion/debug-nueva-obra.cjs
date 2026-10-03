const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const TITULO = "ZZAGENT obra fantasma de cliente 3";

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) console.log("[nav]", f.url());
    });
    page.on("requestfinished", async (r) => {
      if (r.method() === "POST") {
        console.log("[POST]", r.url(), "->", (await r.response())?.status());
      }
    });
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.type(), m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
    page.on("requestfailed", (r) => console.log("[requestfailed]", r.url(), r.failure()?.errorText));

    await k.ingresar(page, "cliente3");
    await k.ir(page, "/dashboard/nueva-obra");
    await page.fill('main form input[name="title"]', TITULO);
    console.log("Voy a clickear 'Publicar obra'...");
    await page.click('main form button:has-text("Publicar obra")');
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(700);
      const btnTxt = await page.locator('main form button[type=submit]').innerText().catch(() => "(sin boton)");
      console.log(i, "url:", page.url(), "| boton:", btnTxt);
    }
    const alertTxt = await page.locator('[role=alert]').innerText().catch(() => "(no hay alert)");
    console.log("alert final:", alertTxt);
  } finally {
    await browser.close();
  }
})();
