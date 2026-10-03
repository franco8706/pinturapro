const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones } = require("./_ayuda.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    for (const emailMalo of ["a@", "sin-arroba"]) {
      await k.ir(page, "/ingresar");
      await page.waitForSelector("form input", { timeout: 10000 });
      await sacarRestricciones(page);
      k.limpiarEventos(eventos);
      await page.locator("form input").nth(0).fill(emailMalo);
      await page.locator("form input").nth(1).fill("Demo1234!");
      const requests = [];
      page.on("request", (r) => {
        if (r.url().includes("supabase.co")) requests.push(r.url().slice(0, 160));
      });
      const boton = page.locator("button[type=submit]");
      await boton.click();
      await page.waitForTimeout(3000);
      const disabled = await boton.isDisabled();
      const texto = await boton.innerText();
      const errorEl = page.locator("[role=alert]").first();
      const error = (await errorEl.count()) ? await errorEl.innerText() : null;
      console.log("\n=== email malformado:", emailMalo, "===");
      console.log(
        JSON.stringify(
          {
            requestsASupabase: requests,
            botonDisabled: disabled,
            botonTexto: texto,
            mensajeError: error,
            erroresConsola: eventos.consola,
            erroresJs: eventos.jsErrors,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await browser.close();
  }
})();
