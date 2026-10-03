/**
 * Rellenar un polígono sobre una máscara — la herramienta "Contorno" del simulador.
 *
 * Existe porque la varita elige por color y por bordes, y hay superficies donde eso no alcanza
 * (medido el 3/10/2026 sobre 18 fotos reales): una fachada de ladrillo, piedra o madera tiene
 * más variación de color dentro de la pared que entre la pared y lo de al lado (ninguna de las
 * cinco fachadas llegaba al 80 % ni con ocho toques), y en un cuarto blanco la esquina entre la
 * pared y el techo es una sombra apenas más oscura (tres de trece interiores pintaban el techo
 * entero). Marcar las esquinas de la zona es exacto en los dos casos, y es lo que se hace en
 * la vida real con la cinta de enmascarar.
 */

/**
 * Pone `valor` en cada píxel de `mascara` (ancho × alto) cuyo CENTRO cae dentro del polígono
 * `puntos` (coordenadas en píxeles, en orden, sin repetir el primero al final). Regla par-impar:
 * un polígono que se cruza a sí mismo deja huecos donde se superpone, como en cualquier editor.
 */
export function rellenarPoligono(
  mascara: Uint8Array,
  ancho: number,
  alto: number,
  puntos: readonly (readonly [number, number])[],
  valor: 0 | 1,
): void {
  if (puntos.length < 3) return;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const [, y] of puntos) {
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const y0 = Math.max(0, Math.floor(yMin));
  const y1 = Math.min(alto - 1, Math.ceil(yMax));
  const cruces: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    cruces.length = 0;
    for (let i = 0, j = puntos.length - 1; i < puntos.length; j = i++) {
      const [xi, yi] = puntos[i];
      const [xj, yj] = puntos[j];
      if (yi > yc !== yj > yc) cruces.push(xi + ((yc - yi) * (xj - xi)) / (yj - yi));
    }
    cruces.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cruces.length; k += 2) {
      // Adentro si cruces[k] ≤ x + 0,5 < cruces[k+1].
      const xa = Math.max(0, Math.ceil(cruces[k] - 0.5));
      const xb = Math.min(ancho - 1, Math.ceil(cruces[k + 1] - 0.5) - 1);
      for (let x = xa; x <= xb; x++) mascara[y * ancho + x] = valor;
    }
  }
}
