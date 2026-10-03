const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/cotizar");
    await page.waitForTimeout(500);
    await page.click('text=Interior'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("70 m²")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);
    await page.click('button:has-text("Living")'); await page.waitForTimeout(250);
    await page.click('button:has-text("Continuar")'); await page.waitForTimeout(500);

    const detalle = await page.evaluate(() => {
      return [...document.querySelectorAll('input')].map((inp, i) => {
        const rect = inp.getBoundingClientRect();
        const label = inp.closest('label') || inp.parentElement.querySelector('label');
        const parentHidden = inp.closest('[class*="-9999px"]') !== null;
        return {
          i, type: inp.type, required: inp.required,
          visible: rect.width > 0 && rect.height > 0,
          rect: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x) },
          parentHidden,
          labelText: label ? label.innerText.trim() : null,
          ariaLabel: inp.getAttribute('aria-label'),
          autocomplete: inp.getAttribute('autocomplete'),
          tabIndex: inp.tabIndex,
        };
      });
    });
    console.log(JSON.stringify(detalle, null, 2));
  } finally {
    await browser.close();
  }
})();
