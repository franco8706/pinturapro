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
    const valores = await page.evaluate(() => {
      const inputs = document.querySelectorAll("form input");
      return [...inputs].map((i) => ({ type: i.type, value: i.value }));
    });
    console.log("valores tras fill:", JSON.stringify(valores));

    const requests = [];
    page.on("request", (r) => {
      if (r.url().includes("supabase")) requests.push(r.url());
    });
    page.on("console", (m) => console.log("[consola]", m.type(), m.text().slice(0, 200)));
    page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

    // Envía el submit del <form> directamente (por si el botón no dispara el evento nativo).
    await page.evaluate(() => {
      const form = document.querySelector("form");
      console.log("[eval] disparando requestSubmit sobre el form");
      form.requestSubmit ? form.requestSubmit() : form.submit();
    });
    await page.waitForTimeout(2500);

    const valores2 = await page.evaluate(() => {
      const inputs = document.querySelectorAll("form input");
      return [...inputs].map((i) => ({ type: i.type, value: i.value }));
    });
    console.log("valores tras submit:", JSON.stringify(valores2));
    console.log("requests:", JSON.stringify(requests));
  } finally {
    await browser.close();
  }
})();
