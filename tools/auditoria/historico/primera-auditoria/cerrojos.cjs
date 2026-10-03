/** Los formularios con cerrojo nuevo: ¿siguen enviando bien y no quedan trabados? */
const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const marca = "ZZAGENT cerrojo " + Date.now().toString().slice(-5);
(async () => {
  const r = { marca };
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    await k.ingresar(page, "pintor2");

    // 1) nueva obra: tres clics seguidos
    await k.ir(page, "/dashboard/nueva-obra");
    await page.fill('input[name=title]', marca + " obra");
    await page.fill('input[name=location]', "ZZAGENT zona");
    await page.evaluate(() => {
      const f = document.querySelector('input[name=title]').closest('form');
      const b = f.querySelector('button[type=submit]');
      b.click(); b.click(); b.click();
    });
    await page.waitForTimeout(6000);
    r.obra = { urlFinal: page.url() };

    // 2) perfil: guardar sin cambiar nada, tres clics, y que la página siga usable
    await k.ir(page, "/dashboard/perfil");
    const bioAntes = await page.inputValue("textarea[name=bio]").catch(() => null);
    await page.evaluate(() => {
      const f = document.querySelector('textarea[name=bio]').closest('form');
      const b = f.querySelector('button[type=submit]');
      b.click(); b.click(); b.click();
    });
    await page.waitForTimeout(6000);
    r.perfil = { bioAntes: bioAntes?.slice(0, 40), urlFinal: page.url() };
    await k.ir(page, "/dashboard/perfil");
    r.perfil.bioDespues = (await page.inputValue("textarea[name=bio]").catch(() => null))?.slice(0, 40);
    r.perfil.largoDespues = (await page.inputValue("textarea[name=bio]").catch(() => ""))?.length;
    r.js = eventos.jsErrors.slice(0, 4);
  } catch (e) { r.error = String(e).slice(0, 300); }
  finally { await browser.close(); }
  console.log(JSON.stringify(r, null, 2));
})();
