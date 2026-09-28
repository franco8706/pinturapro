/**
 * Las dimensiones de una imagen, leídas del encabezado del archivo, sin decodificarla.
 *
 * Por qué: el servidor aceptaba cualquier imagen de hasta 6 MB mirando sólo la firma de los
 * bytes. Pero el peso no dice nada del tamaño en píxeles: el agente `formularios-hostiles`
 * subió un PNG de color liso de 40.000 × 40.000 px (1.600 megapíxeles) que pesa 4,7 MB,
 * salteando el achicado que hace el navegador, y quedó publicado como portada de una obra.
 * Cada persona que abría /obras le pedía a su navegador decodificar ~6,4 GB de píxeles.
 *
 * El navegador de quien sube la foto la achica a ~1.600 px antes de mandarla, así que una
 * foto legítima llega con 2-3 megapíxeles. Todo lo que pasa de `MAXIMO_MEGAPIXELES` vino por
 * afuera de la pantalla, y se rechaza.
 *
 * Si el encabezado no se puede leer, devuelve null y quien llama rechaza: ante la duda, no.
 */
export const MAXIMO_MEGAPIXELES = 25;
export const MAXIMO_LADO = 10000;

export function dimensionesDeImagen(b: Uint8Array): { ancho: number; alto: number } | null {
  if (b.length < 30) return null;

  // PNG: el primer bloque (IHDR) trae ancho y alto en los bytes 16-23.
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const ancho = ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0;
    const alto = ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0;
    return { ancho, alto };
  }

  // JPEG: recorrer los segmentos hasta el que describe el cuadro (SOF0-SOF15).
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marca = b[i + 1];
      if (marca === 0xff) { i++; continue; } // relleno
      const esSOF = marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc;
      if (esSOF) return { alto: (b[i + 5] << 8) | b[i + 6], ancho: (b[i + 7] << 8) | b[i + 8] };
      if (marca === 0xd8 || marca === 0x01 || (marca >= 0xd0 && marca <= 0xd7)) { i += 2; continue; }
      const largo = (b[i + 2] << 8) | b[i + 3];
      if (largo < 2) return null;
      i += 2 + largo;
    }
    return null;
  }

  // WEBP: "RIFF" .... "WEBP" y después el bloque que dice cómo está codificada.
  const texto = (desde: number, n: number) => String.fromCharCode(...b.slice(desde, desde + n));
  if (texto(0, 4) === "RIFF" && texto(8, 4) === "WEBP") {
    const tipo = texto(12, 4);
    if (tipo === "VP8X") {
      return { ancho: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), alto: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    }
    if (tipo === "VP8L") {
      return {
        ancho: 1 + (((b[22] & 0x3f) << 8) | b[21]),
        alto: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
      };
    }
    if (tipo === "VP8 ") {
      return { ancho: ((b[27] << 8) | b[26]) & 0x3fff, alto: ((b[29] << 8) | b[28]) & 0x3fff };
    }
  }
  return null;
}

/** El motivo para rechazarla, o null si el tamaño es razonable. */
export function motivoImagenDesmedida(b: Uint8Array): string | null {
  const d = dimensionesDeImagen(b);
  if (!d || d.ancho <= 0 || d.alto <= 0) return "No pudimos leer el tamaño de la imagen. Probá con otra.";
  if (d.ancho > MAXIMO_LADO || d.alto > MAXIMO_LADO || (d.ancho * d.alto) / 1e6 > MAXIMO_MEGAPIXELES) {
    return `La imagen es demasiado grande (${d.ancho} × ${d.alto} px). Subila de nuevo desde la pantalla, que la achica sola.`;
  }
  return null;
}
