/**
 * Vigila que la foto reemplazada se vaya del almacenamiento.
 *
 * `deleteObra` limpiaba la foto al borrar la obra, pero **cambiarla** dejaba la anterior viva
 * y pública para siempre. Desde el sitio desaparecía; la dirección seguía abriendo. Con diez
 * ediciones de la misma obra quedaban nueve fotos colgadas —interiores de casas, muchas veces
 * de clientes— en direcciones que cualquiera que las tenga puede abrir. Lo mismo con la foto
 * de perfil, que es la cara de la persona.
 *
 * Para la Ley 25.326 eso es un dato personal que la persona cree borrado y no lo está.
 *
 * La prueba sube dos fotos seguidas a una obra y comprueba que la primera deje de responder.
 * Al final devuelve la obra a su portada original, lo que de paso borra la segunda: si esta
 * prueba queda a medias, revisá el bucket `projects` a mano.
 */
const zlib = require("zlib");

/**
 * ¿Sigue existiendo el archivo?
 *
 * OJO con preguntárselo a la dirección pelada: Supabase sirve los buckets públicos detrás de
 * una caché, y un archivo YA BORRADO le contesta 200 hasta una hora más. Medido: subir,
 * pedir, borrar, volver a pedir → 200; con un parámetro cualquiera al final → 400. El
 * parámetro cambia la dirección, la caché no la tiene y la pregunta llega al origen.
 *
 * Sin esto la prueba fallaba mostrando un problema que no existía.
 */
async function sigueEnElAlmacenamiento(page, url) {
  const r = await page.request.get(`${url}${url.includes("?") ? "&" : "?"}sincache=${Date.now()}`);
  return r.status() === 200;
}

/** Un PNG de color sólido, sin dependencias: el formulario lo pasa por un canvas. */
function pngSolido(lado, [r, g, b]) {
  const crudo = Buffer.alloc((lado * 4 + 1) * lado);
  for (let y = 0; y < lado; y++) {
    const fila = y * (lado * 4 + 1);
    crudo[fila] = 0;
    for (let x = 0; x < lado; x++) {
      const p = fila + 1 + x * 4;
      crudo[p] = r; crudo[p + 1] = g; crudo[p + 2] = b; crudo[p + 3] = 255;
    }
  }
  const trozo = (tipo, datos) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(datos.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(cuerpo) : crc32(cuerpo));
    return Buffer.concat([largo, cuerpo, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", zlib.deflateSync(crudo)),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

/** CRC-32 por si corre en un Node sin `zlib.crc32` (llegó en la 20.15). */
function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

module.exports = {
  nombre: "fotos · la portada reemplazada se va del almacenamiento",

  async correr(t, { k }) {
    const { browser, page } = await k.abrir({});
    let original = null;
    let urlEditar = null;

    /** Sube una foto a la obra y devuelve la dirección que quedó guardada. */
    async function reemplazar(color) {
      await k.ir(page, urlEditar);
      await page.setInputFiles("input[type=file]", {
        name: "ZZAGENT-portada.png",
        mimeType: "image/png",
        buffer: pngSolido(64, color),
      });
      // El formulario achica la imagen en un canvas antes de mandarla, y recién entonces
      // guarda el archivo que va a enviar. Esperar a que se vaya el cartel "Procesando…" no
      // sirve: todavía no apareció, así que la condición da verdadera al instante y el envío
      // sale sin la foto. Lo que marca el final es la miniatura.
      await page.waitForSelector("label img", { timeout: 15000 });
      await Promise.all([
        page.waitForURL((u) => /\/dashboard\/?$/.test(u.pathname), { timeout: 30000 }),
        page.evaluate(() => {
          const f = document.querySelector("input[name=cover_url]").closest("form");
          f.requestSubmit();
        }),
      ]);
      await k.ir(page, urlEditar);
      return page.inputValue("input[name=cover_url]");
    }

    try {
      await k.ingresar(page, "pintor2");
      await k.ir(page, "/dashboard");

      urlEditar = await page.evaluate(() => {
        const a = document.querySelector('a[href*="/dashboard/editar/"]');
        return a ? new URL(a.href).pathname : null;
      });
      t.cierto(!!urlEditar, "el panel no muestra ninguna obra para editar");
      if (!urlEditar) return;

      await k.ir(page, urlEditar);
      original = await page.inputValue("input[name=cover_url]");
      t.cierto(!!original, "la obra de prueba no tenía portada");

      const a = await reemplazar([200, 60, 60]);
      t.contiene(a, "/storage/v1/object/public/projects/", "la foto subida no quedó guardada");
      t.cierto(await sigueEnElAlmacenamiento(page, a), "la foto recién subida no se puede abrir");

      const b = await reemplazar([60, 60, 200]);
      t.cierto(b !== a, "la segunda foto quedó guardada en la misma dirección que la primera");
      t.cierto(await sigueEnElAlmacenamiento(page, b), "la segunda foto no se puede abrir");
      t.cierto(
        !(await sigueEnElAlmacenamiento(page, a)),
        "la foto reemplazada sigue guardada: queda pública para siempre aunque el sitio ya no la muestre",
      );

      // Dejar la obra como estaba. De paso prueba que volver a una URL pegada también limpia.
      await k.ir(page, urlEditar);
      await Promise.all([
        page.waitForURL((u) => /\/dashboard\/?$/.test(u.pathname), { timeout: 30000 }),
        page.evaluate((url) => {
          const i = document.querySelector("input[name=cover_url]");
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(i, url);
          i.dispatchEvent(new Event("input", { bubbles: true }));
          i.closest("form").requestSubmit();
        }, original),
      ]);
      await k.ir(page, urlEditar);
      t.igual(await page.inputValue("input[name=cover_url]"), original, "no se pudo restaurar la portada original");
      t.cierto(
        !(await sigueEnElAlmacenamiento(page, b)),
        "cambiar la portada por una URL pegada deja la foto subida colgada en el almacenamiento",
      );
    } finally {
      await browser.close();
    }
  },
};
