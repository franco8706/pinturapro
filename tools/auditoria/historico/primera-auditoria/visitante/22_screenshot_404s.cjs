const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/obras/no-existe-esta-obra");
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/404_obra.png", fullPage: true });
    const html1 = await page.evaluate(() => document.body.innerHTML.slice(0, 500));
    console.log("HTML obra 404:", html1);

    await k.ir(page, "/pintor/00000000-0000-0000-0000-000000000000");
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/404_pintor.png", fullPage: true });

    await k.ir(page, "/pagina-que-no-existe");
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/404_generico.png", fullPage: true });
  } finally {
    await browser.close();
  }
})();
