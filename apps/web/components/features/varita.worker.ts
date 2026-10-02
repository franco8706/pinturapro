/**
 * La varita mágica, fuera del hilo que dibuja la pantalla.
 *
 * Por qué existe: el primer clic sobre la foto congelaba la pantalla unos 600 ms en un celular
 * de gama media (medido en cuatro rondas: 400, 400-724, 571-599, 577-623 ms). El 75 % de ese
 * tiempo son dos cálculos puros —rellenar la región y cerrar sus huecos— que no tocan nada de
 * la pantalla: `packages/color` se separó de la interfaz justamente para poder correr en
 * cualquier lado. Acá corre en un Web Worker; el hilo principal sólo mezcla y pinta.
 *
 * La foto preparada (cinco planos del tamaño de la imagen) vive SÓLO acá: el componente no
 * guarda copia, salvo que el worker falle y tenga que calcular él (ver `photo-simulator.tsx`).
 *
 * Medición: `node tools/auditoria/simulador/congelamiento.cjs`.
 */
import { prepareWandImage, magicWand, type WandImage, type WandOptions } from "@pinturapro/color";

export type PedidoVarita =
  | { tipo: "foto"; datos: ArrayBuffer; ancho: number; alto: number }
  | { tipo: "soltar" }
  | { tipo: "varita"; id: number; x: number; y: number; opciones: WandOptions };

export type RespuestaVarita = { id: number; region: Uint8Array | null };

// El proyecto compila con los tipos del DOM, no con los de un worker: se declara lo mínimo.
const hilo = self as unknown as {
  onmessage: ((e: MessageEvent<PedidoVarita>) => void) | null;
  postMessage(mensaje: RespuestaVarita, transferir?: Transferable[]): void;
};

let foto: WandImage | null = null;

hilo.onmessage = (e) => {
  const pedido = e.data;
  if (pedido.tipo === "foto") {
    // `prepareWandImage` sólo lee `width`, `height` y `data`: no hace falta un ImageData real.
    foto = prepareWandImage({
      width: pedido.ancho,
      height: pedido.alto,
      data: new Uint8ClampedArray(pedido.datos),
    } as ImageData);
    return;
  }
  if (pedido.tipo === "soltar") {
    foto = null;
    return;
  }
  if (!foto) {
    hilo.postMessage({ id: pedido.id, region: null });
    return;
  }
  const region = magicWand(foto, pedido.x, pedido.y, pedido.opciones);
  // La región se transfiere, no se copia: son tantos bytes como píxeles tiene la foto.
  hilo.postMessage({ id: pedido.id, region }, [region.buffer]);
};
