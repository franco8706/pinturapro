const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
(async () => {
  const { browser, page } = await k.abrir({ movil: false });
  try {
    await k.ir(page, "/");
    // Scroll down gradually like a real user, pausing to let observers fire
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 300) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 150));
      }
    });
    await page.waitForTimeout(500);
    // Check opacity state of the paleta/obras cards now
    const estado = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2,h3")].find(h => h.innerText.includes("Probá el color"));
      const section = heading.closest("section") || heading.parentElement.parentElement.parentElement;
      const cards = section.querySelectorAll(".opacity-0, [class*='opacity-0']");
      return { cardsStillHidden: cards.length, sectionClassSample: section.className };
    });
    console.log(JSON.stringify(estado, null, 2));
    await page.screenshot({ path: "/workspaces/codespaces-blank/.auditoria/kit/visitante/home_desktop_scrolled.png", fullPage: true });
  } finally {
    await browser.close();
  }
})();
