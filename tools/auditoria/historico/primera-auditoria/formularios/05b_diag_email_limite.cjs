const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones } = require("./_ayuda.cjs");

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/registro");
    const inputs1 = page.locator("main input");
    await inputs1.nth(0).fill("ZZAGENT Email Limite Diag");
    await inputs1.nth(1).fill("3");
    await page.getByRole("button", { name: "Continuar →" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "CABA" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Continuar →" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Residencial" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Continuar →" }).click();
    await page.waitForTimeout(300);
    const inputs4 = page.locator("main input");
    await inputs4.nth(0).fill("zzagent-formularios-limite@x.c");
    await inputs4.nth(1).fill("1155550002");

    const boton = page.getByRole("button", { name: /Enviar postulación/ });
    console.log("boton disabled antes de click?", await boton.isDisabled());
    const requests = [];
    page.on("request", (r) => {
      if (r.method() === "POST") requests.push(r.url());
    });
    await boton.click();
    await page.waitForTimeout(4000);
    console.log("requests POST:", JSON.stringify(requests));
    console.log("erroresJs:", JSON.stringify(eventos.jsErrors));
    console.log("erroresConsola:", JSON.stringify(eventos.consola));
    const mainText = await page.locator("main").innerText();
    console.log("--- main text (completo) ---");
    console.log(mainText);
  } finally {
    await browser.close();
  }
})();
