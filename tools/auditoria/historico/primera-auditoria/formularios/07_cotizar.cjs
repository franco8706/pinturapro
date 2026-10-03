const k = require("/workspaces/codespaces-blank/.auditoria/kit/navegador.cjs");
const { sacarRestricciones, contarPosts, textoLargo, XSS, SQLI } = require("./_ayuda.cjs");

const R = [];
function log(caso, detalle) {
  R.push({ caso, ...detalle });
  console.log("\n=== " + caso + " ===");
  console.log(JSON.stringify(detalle, null, 2));
}

async function publicarJobChico(page, titulo) {
  await k.ir(page, "/publicar");
  const inputs1 = page.locator("main input");
  await inputs1.nth(0).fill(titulo);
  await page.getByRole("button", { name: "interior", exact: true }).click();
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);
  const inputs2 = page.locator("main input");
  await inputs2.nth(0).fill("30");
  await inputs2.nth(1).fill("ZZAGENT zona cotizar");
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Publicar trabajo/ }).click();
  await page.waitForTimeout(1500);
}

async function abrirFormularioCotizar(page, tituloJob) {
  await k.ir(page, "/trabajos");
  const card = page.locator("article", { hasText: tituloJob });
  await card.getByRole("button", { name: "Cotizar este trabajo" }).click();
  await page.waitForTimeout(300);
  return card;
}

async function intentarCotizar(page, card, { amount, note }) {
  await sacarRestricciones(page);
  const amountInput = card.locator('input[name="amount"]');
  const noteInput = card.locator('textarea[name="note"]');
  await amountInput.fill(String(amount));
  if (note !== undefined) await noteInput.fill(note);
  await sacarRestricciones(page);
  const respuestasErr = [];
  await card.getByRole("button", { name: "Enviar cotización" }).click();
  await page.waitForTimeout(1200);
  const error = await card.locator('[role="alert"]').innerText().catch(() => null);
  const exito = await card.locator("text=Cotización enviada").count();
  return { error, exito: exito > 0 };
}

(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: false });
  try {
    // Crear 2 jobs chicos como cliente
    await k.ingresar(page, "cliente");
    const tituloA = `ZZAGENT cotizar montos ${Date.now()}`;
    const tituloB = `ZZAGENT cotizar triple ${Date.now()}`;
    await publicarJobChico(page, tituloA);
    await publicarJobChico(page, tituloB);
    log("Setup", { esperado: "2 pedidos ZZAGENT creados por 'cliente' para las pruebas", tituloA, tituloB });

    // --- Pintor: batería de montos hostiles contra Job A ---
    await k.ingresar(page, "pintor");
    let cardA = await abrirFormularioCotizar(page, tituloA);

    const secuencia = [
      { amount: "   ", note: "   ", desc: "espacios en monto y nota" },
      { amount: "-5000", note: "ZZAGENT nota negativa", desc: "monto negativo" },
      { amount: "0", note: "ZZAGENT nota cero", desc: "monto cero" },
      { amount: "abc", note: "ZZAGENT nota letras", desc: "monto con letras" },
      { amount: "99999999999", note: "ZZAGENT nota enorme", desc: "monto con 11 nueves (excede 1000M)" },
    ];
    for (const caso of secuencia) {
      const r = await intentarCotizar(page, cardA, caso);
      log(`Cotizar: ${caso.desc} (amount="${caso.amount}")`, {
        esperado: "Rechazado con 'Ingresá un monto válido.' sin crear la cotización",
        resultado: r,
      });
      // Si por error se creó la cotización, dejamos de insistir en este job.
      if (r.exito) break;
    }

    // Ahora el envío válido con formato AR + nota de 10.000 caracteres con XSS/SQLi embebido
    const notaHostil = `ZZAGENT ${XSS} ${SQLI} ` + textoLargo(10000);
    const rValido = await intentarCotizar(page, cardA, { amount: "320.000,50", note: notaHostil });
    log('Cotizar: monto "320.000,50" (formato AR) + nota con XSS/SQLi de ~10.000 caracteres', {
      esperado: "Debería aceptarse como $320.000 (se descartan los centavos), y la nota debería guardarse sin ejecutar script (pero OJO: `note` no tiene tope de longitud en el server, a diferencia de `comment` en reseñas)",
      resultado: rValido,
    });

    // --- Verificar cómo se ve la nota gigante en el panel del cliente ---
    await k.ingresar(page, "cliente");
    await k.ir(page, "/cotizaciones");
    k.limpiarEventos(eventos);
    const auditCotizaciones = await k.auditar(page, eventos);
    log("Impacto visual: nota de ~10.000 caracteres en /cotizaciones (panel del cliente)", {
      esperado: "La nota no debería romper el layout de la página",
      scrollHorizontal: auditCotizaciones.scrollHorizontal,
      elementosFueraDePantalla: auditCotizaciones.elementosFueraDePantalla,
      erroresJs: auditCotizaciones.erroresJs,
    });

    // --- Pintor2: clic triple en Job B ---
    await k.ingresar(page, "pintor2");
    const cardB = await abrirFormularioCotizar(page, tituloB);
    await sacarRestricciones(page);
    await cardB.locator('input[name="amount"]').fill("55000");
    await cardB.locator('textarea[name="note"]').fill("ZZAGENT nota triple click");
    const postsTriple = contarPosts(page);
    const boton = cardB.getByRole("button", { name: "Enviar cotización" });
    await Promise.all([boton.click(), boton.click(), boton.click()]);
    await page.waitForTimeout(2500);
    const bodyB = await cardB.innerText();
    log("H. Clic triple en 'Enviar cotización' (Job B, pintor2)", {
      esperado: "Debería crearse UNA sola cotización (el unique constraint uniq_jobs_quote_viva debería frenar duplicados si el cliente los intenta igual)",
      postsDisparados: postsTriple.length,
      posts: postsTriple,
      textoTarjetaFinal: bodyB.slice(0, 300),
    });
  } finally {
    await browser.close();
  }
  console.log("\n\n########## RESUMEN cotizar ##########");
  console.log(JSON.stringify(R, null, 2));
})();
