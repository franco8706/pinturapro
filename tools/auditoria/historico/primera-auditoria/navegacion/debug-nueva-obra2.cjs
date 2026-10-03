const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const TITULO = "ZZAGENT obra fantasma de cliente 5";

(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "cliente3");
    await k.ir(page, "/dashboard/nueva-obra");
    const form = page.locator('form:has(input[name="title"])');
    await form.locator('input[name="title"]').fill(TITULO);
    await form.locator('button:has-text("Publicar obra")').click();
    await page.waitForTimeout(3000);
    const btnTxt = await form.locator('button[type=submit]').innerText().catch((e) => "ERR:" + e.message.slice(0,150));
    console.log("Texto del botón tras submit:", btnTxt);
    const alertTxt = await form.locator('[role=alert]').innerText().catch(() => "(sin alert)");
    console.log("Alert dentro del form:", alertTxt);
    console.log("URL final:", page.url());
  } finally {
    await browser.close();
  }
})();
