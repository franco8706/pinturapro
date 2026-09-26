/**
 * Vigila que ninguna Server Action se rompa con un cuerpo que no esperaba.
 *
 * Una Server Action se escribe como una función normal —`eliminarMiCuenta(texto)`— y eso hace
 * olvidar lo que en realidad es: un endpoint HTTP. Cualquiera con una sesión puede llamarla
 * con el cuerpo que quiera, y TypeScript no está del lado del servidor para impedirlo: el
 * tipo dice `string` y lo que llega puede ser `null`, un número o un objeto.
 *
 * Medido: mandarle `[null]` a la acción de dar de baja la cuenta devolvía **500** con
 * `Cannot read properties of null (reading 'trim')`. En desarrollo la respuesta traía además
 * el mensaje del error y la ruta interna del archivo; en producción Next los reemplaza por un
 * identificador, así que la fuga es sólo de desarrollo, pero el 500 es de los dos lados.
 *
 * La prueba recorre el sitio como una persona, se queda con el identificador de cada acción
 * que se dispara, y después le tira cuerpos imposibles a cada una. Ninguna puede contestar
 * 500 ni devolver el texto crudo de un error. Crece sola: cada acción nueva que alguien
 * ejercite acá queda vigilada sin tocar este archivo.
 *
 * Los cuerpos son inofensivos a propósito: ni un uuid válido ni la palabra de confirmación,
 * así que no borran ni aceptan nada. Se rechazan por inválidos, que es justo lo que se mide.
 */
const CUERPOS = [
  ["null", "[null]"],
  ["un objeto", '[{"a":1}]'],
  ["sin argumentos", "[]"],
  ["un número", "[123]"],
  ["un texto larguísimo", JSON.stringify(["x".repeat(50000)])],
  ["un arreglo", '[["a","b"]]'],
  ["true", "[true]"],
];

/** Señales de que salió el error crudo del servidor en vez de un mensaje para la persona. */
const CRUDO = /TypeError|ReferenceError|webpack-internal|\/actions\.ts|at async |Cannot read properties/;

module.exports = {
  nombre: "acciones · ninguna se rompe con un cuerpo que no esperaba",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({});
    // Cada acción se ve una sola vez, con la pantalla desde donde se disparó.
    const acciones = new Map();
    page.on("request", (r) => {
      const id = r.headers()["next-action"];
      if (id && !acciones.has(id)) acciones.set(id, new URL(r.url()).pathname);
    });

    /** Aprieta un botón por su texto, sin romper si no está. */
    const apretar = async (texto) =>
      page.evaluate((tx) => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          new RegExp(tx, "i").test(x.textContent || ""),
        );
        if (b) b.click();
        return !!b;
      }, texto);

    /**
     * Envía el formulario que contiene tal campo.
     *
     * Buscar el botón por su texto es frágil —cambia una palabra del copy y la prueba deja de
     * medir— y buscarlo por `button[type=submit]` es peor: agarra el botón "Salir" del menú,
     * que también es un submit, y cierra la sesión (está en REGLAS.md). El formulario se
     * identifica por un campo suyo, que es lo que menos cambia.
     */
    const enviarFormularioCon = async (selector) =>
      page.evaluate((sel) => {
        const campo = document.querySelector(sel);
        const form = campo && campo.closest("form");
        if (!form) return false;
        // `noValidate` a propósito: casi todos estos formularios tienen campos obligatorios, y
        // con la validación del navegador puesta el envío se frena antes de salir — la acción
        // no se dispara y no hay nada que medir. Apagándola, el envío sale vacío y lo rechaza
        // el servidor, que es lo que queremos: la acción se presenta y no se crea nada.
        form.noValidate = true;
        form.requestSubmit();
        return true;
      }, selector);

    try {
      // ── Paso 1: usar el sitio, para que las acciones se presenten solas ──
      //
      // Todos los envíos van con datos INVÁLIDOS a propósito: la acción se dispara —que es lo
      // único que hace falta para quedarse con su identificador— y se rechaza sola, así que
      // esta prueba no crea ni un pedido, ni una cotización, ni una consulta.
      const intentar = async (fn) => { try { await fn(); } catch {} };

      // Formularios públicos, sin sesión.
      await intentar(async () => {
        await k.ir(page, "/contacto");
        await enviarFormularioCon("textarea");
        await page.waitForTimeout(900);
      });

      await k.ingresar(page, "cliente4");

      await intentar(async () => {
        await k.ir(page, "/mi-cuenta");
        await page.fill("input[type=text]", "no quiero");
        await apretar("eliminar mi cuenta");
        await page.waitForTimeout(1500);
      });

      await intentar(async () => {
        await k.ir(page, "/publicar");
        await enviarFormularioCon("form input, form select, form textarea");
        await page.waitForTimeout(1200);
      });

      await k.salir(page);
      await k.ingresar(page, "pintor2");

      await intentar(async () => {
        await k.ir(page, "/dashboard/nueva-obra");
        await enviarFormularioCon("input[name=title]");
        await page.waitForTimeout(1200);
      });

      await intentar(async () => {
        await k.ir(page, "/dashboard/perfil");
        await page.fill("input[name=full_name]", "");
        await enviarFormularioCon("input[name=full_name]");
        await page.waitForTimeout(1200);
      });

      await intentar(async () => {
        await k.ir(page, "/trabajos");
        await apretar("cotizar");
        await page.waitForTimeout(800);
        await enviarFormularioCon("textarea");
        await page.waitForTimeout(1200);
      });

      // Un piso, para que la prueba no se degrade en silencio: si un cambio de interfaz rompe
      // el recorrido y se disparan dos acciones en vez de siete, esto avisa en vez de seguir
      // dando verde midiendo casi nada.
      t.nota(`acciones encontradas: ${acciones.size} -> ${[...acciones.values()].join(", ")}`);
      t.cierto(
        acciones.size >= 4,
        `el recorrido sólo disparó ${acciones.size} acciones y deberían ser al menos 4: ` +
          "cambió alguna pantalla y esta prueba dejó de medir lo que dice medir",
      );

      // ── Paso 2: tirarles cuerpos imposibles ──
      const rotas = [];
      for (const [id, ruta] of acciones) {
        for (const [nombre, cuerpo] of CUERPOS) {
          const r = await page.request.post(k.BASE + ruta, {
            headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8" },
            data: cuerpo,
          });
          const texto = (await r.text()).replace(/\s+/g, " ");
          if (r.status() >= 500) rotas.push(`${ruta} con ${nombre} -> ${r.status()}`);
          else if (CRUDO.test(texto))
            rotas.push(`${ruta} con ${nombre} -> error crudo: ${texto.slice(0, 120)}`);
        }
      }

      t.nota(`acciones probadas: ${acciones.size} · cuerpos por acción: ${CUERPOS.length}`);
      t.cierto(
        rotas.length === 0,
        `hay acciones que se rompen con un cuerpo inesperado -> ${rotas.join(" · ")}`,
      );

      // La cuenta de prueba tiene que seguir en pie: ningún cuerpo puede haber borrado nada.
      await k.salir(page);
      await k.ingresar(page, "cliente4");
      const r = await page.request.get(k.BASE + "/api/mis-datos");
      t.igual(r.status(), 200, "la cuenta de prueba no sobrevivió a la ronda");
    } finally {
      await browser.close();
    }
  },
};
