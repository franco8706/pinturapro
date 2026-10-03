"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  prepareWandImage,
  magicWand,
  fotoPerceptual,
  pinturaDesdeHex,
  ancla,
  curva,
  componer,
  rellenarPoligono,
  type WandImage,
  type WandOptions,
  type FotoPerceptual,
  type Curva,
  type Rect,
} from "@pinturapro/color";
import type { PedidoVarita, RespuestaVarita } from "./varita.worker";

type Status = "empty" | "ready" | "segmenting" | "error";

interface PhotoSimulatorProps {
  color: string | null;
  /**
   * Intensidad del color (0,4 a 1), si la maneja la página.
   *
   * El control vivía acá adentro, ANTES de la grilla de colores en el orden del teclado, y se
   * usa DESPUÉS de elegir uno: volver costaba de 7 a 14 Shift+Tab (medido por `accesibilidad`
   * y `simulador-color`). La página lo dibuja ahora junto al color elegido y le pasa el valor.
   * Sin esta prop, el componente sigue trayendo su propio control.
   */
  strength?: number;
}

const MAX_DIM = 1024;
/**
 * Tope de megapíxeles de la foto que se acepta.
 *
 * No es un capricho: iOS Safari corta en 16.777.216 px por canvas y ~384 MB de memoria total
 * de canvas. Una foto de 50 MP ocupa 200 MB sólo al decodificarse, y cuando el sistema mata
 * la pestaña por memoria `img.onerror` no se dispara — la persona ve desaparecer todo sin
 * ningún mensaje. Mejor rechazarla con una explicación.
 */
const MAX_MEGAPIXELES = 24;

/**
 * Simulador de color sobre foto.
 *
 * Flujo: subir foto → tocar la pared → la varita mágica marca la superficie (en un Web Worker,
 * sin red: `varita.worker.ts`) → la pintura se aplica con el motor de `@pinturapro/color`
 * (`componer`): el tono y la saturación del color elegido, con la luz, la sombra y el grano de
 * la foto. El pincel suma o borra a mano; "🤖 IA" usa la segmentación remota de `/api/segment`
 * (manda la foto a un servicio externo) y es opcional.
 *
 * Toda la cuenta de color vive en el paquete y se prueba sin navegador:
 * `node packages/color/pruebas.ts`. Acá queda la interfaz y el estado.
 */
export function PhotoSimulator({ color, strength: strengthDeAfuera }: PhotoSimulatorProps) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseImageData = useRef<ImageData | null>(null);
  const compositeRef = useRef<ImageData | null>(null);
  /** La foto en OKLab (luminosidad y croma por píxel): de ahí sale la luz que se le pone a la
   *  pintura. Se calcula una vez por foto. */
  const fotoRef = useRef<FotoPerceptual | null>(null);
  /**
   * La tabla de la pintura para la selección actual (ver `curva` en @pinturapro/color).
   *
   * Depende del color y de la selección (el ancla sale de la pared elegida), no de la
   * Intensidad: mover la Intensidad no la recalcula. `version` es la de la selección: cambia
   * cada vez que cambia el alfa, salvo en medio de una pincelada (ver `pintarEn`).
   */
  const curvaRef = useRef<{ color: string; version: number; curva: Curva } | null>(null);
  const versionAlfaRef = useRef(0);
  const maskRef = useRef<Uint8Array | null>(null); // máscara binaria
  const alphaRef = useRef<Float32Array | null>(null); // máscara con bordes difuminados (0..1)
  const imageUrlRef = useRef<string>(""); // dataURL de la foto (para enviar al server)
  const dims = useRef({ w: 0, h: 0 });
  const segmentingRef = useRef(false); // guard anti clics múltiples
  // Banco de regiones de SAM, cacheado tras UNA sola llamada al servidor. Cada clic elige
  // de acá (instantáneo, sin red). `small` = máscara binaria a baja resolución para el
  // hit-test/área; `url` = data URL para redibujar la ganadora a resolución plena.
  const maskBankRef = useRef<{ small: Uint8Array; sw: number; sh: number; area: number; url: string }[]>([]);
  const segmentedRef = useRef(false); // ¿ya segmentamos esta foto?
  const pendingAnalyzeRef = useRef(false); // disparar análisis tras montar la imagen

  // ── Varita mágica (selección local, sin servidor) ──
  // La varita corre en un Web Worker (ver varita.worker.ts): el primer clic congelaba la
  // pantalla unos 600 ms. `wandRef` queda sólo como respaldo, para cuando no hay worker.
  const wandRef = useRef<WandImage | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pedidosRef = useRef(
    new Map<number, { x: number; y: number; opciones: WandOptions; resolver: (r: Uint8Array | null) => void }>(),
  );
  const secuenciaRef = useRef(0);
  /**
   * Cambia cada vez que la selección deja de ser la que era por algo que hizo la persona (otro
   * clic, una pincelada, limpiar, otra foto). El resultado de la varita llega un instante
   * después de pedirlo: si en el medio cambió la generación, ya no corresponde aplicarlo.
   */
  const generacionRef = useRef(0);
  /**
   * La selección tal como estaba antes de la última acción, para "Deshacer".
   *
   * No había forma de volver un paso atrás: sólo "Limpiar selección", que borra todo. Un clic
   * de más —la varita agarró el techo— obligaba a empezar de nuevo. Un solo nivel alcanza.
   */
  const deshacerRef = useRef<Uint8Array | null>(null);
  const [puedeDeshacer, setPuedeDeshacer] = useState(false);
  /** Los clics se atienden de a uno, en orden: el segundo suma sobre lo que dejó el primero. */
  const colaClicsRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Arrastrando la sensibilidad: un pedido en vuelo y, como mucho, el último valor esperando. */
  const arrastreRef = useRef<{ enVuelo: boolean; pendiente: number | null }>({ enVuelo: false, pendiente: null });
  const lastClickRef = useRef<{ x: number; y: number } | null>(null); // para re-aplicar al mover el slider
  const maskBeforeClickRef = useRef<Uint8Array | null>(null); // selección previa al último clic

  const [status, setStatus] = useState<Status>("empty");
  const [errorMsg, setErrorMsg] = useState("");
  const [brush, setBrush] = useState<"off" | "add" | "erase">("off");
  /**
   * "Contorno": se tocan las esquinas de una zona y se pinta (o se saca) ese polígono. Para lo
   * que la varita no puede separar por color: una fachada de ladrillo o piedra, o la esquina
   * entre una pared blanca y un techo blanco (ver `rellenarPoligono` en @pinturapro/color).
   */
  const [contorno, setContorno] = useState<"off" | "sumar" | "quitar">("off");
  /** Las esquinas marcadas hasta ahora, en fracciones 0..1 de la foto. */
  const [vertices, setVertices] = useState<{ x: number; y: number }[]>([]);
  const [brushSize, setBrushSize] = useState(36);
  // Intensidad del color (0..1). Arranca en 1: con 0,9 el 10 % restante lo ponía la pared
  // vieja, y Blanco Puro sobre una pared roja salía rosado (ver `simulador-color-fiel`).
  const [strengthPropia, setStrength] = useState(1);
  const strength = strengthDeAfuera ?? strengthPropia;
  /**
   * El color y la Intensidad elegidos AHORA, para `repaint`.
   *
   * `repaint` se llamaba con lo que valían en la render del clic: la varita contesta un
   * instante después (desde el Web Worker), y si en ese instante la persona elegía otro color,
   * la pared se pintaba con el VIEJO y la muestra marcada decía otro. Con varios toques en cola
   * la ventana llegaba a 2 segundos (medido por `simulador-uso-real`, 3/10/2026). Leyendo de
   * acá, cualquier repintado —el de la varita, el del pincel, el de la IA— usa lo último.
   */
  const colorRef = useRef(color);
  const strengthRef = useRef(strength);
  useEffect(() => {
    colorRef.current = color;
    strengthRef.current = strength;
  }, [color, strength]);
  const [hasSelection, setHasSelection] = useState(false);
  const [zoom, setZoom] = useState(1);
  /** Ancho / alto de la foto: para que entre entera en el recuadro (ver el lienzo). */
  const [aspecto, setAspecto] = useState(4 / 3);
  const [tolerance, setTolerance] = useState(26); // sensibilidad de la varita (0..100)
  // Modo de selección. `wand` (default) resuelve en ~40 ms sin red; `ai` usa el backend
  // remoto de segmentación, más lento pero a veces mejor en superficies muy texturadas.
  const [useAI, setUseAI] = useState(false);
  /**
   * La mira del teclado. Null hasta que alguien usa las flechas: con mouse no se dibuja nada,
   * para no meterle un elemento de más a quien no lo necesita.
   *
   * El lienzo es un canvas y todo se hacía con clics: quien no puede usar un mouse —o
   * directamente navega con teclado— no tenía forma de pintar una pared, ni un aviso que se lo
   * dijera. Con flechas se mueve la mira y con Enter se aplica ahí, que es exactamente lo que
   * hace un clic.
   */
  const [mira, setMira] = useState<{ x: number; y: number } | null>(null);
  /** Lo que se le lee en voz alta a quien no ve el lienzo: sin esto, Enter no devuelve nada. */
  const [aviso, setAviso] = useState("");
  /**
   * Para no hablar en cada flecha.
   *
   * La primera versión anunciaba la posición en cada tecla: cinco flechas eran cinco
   * oraciones completas, y cruzar la imagen con el paso fino son unos cien flechazos, cada
   * uno con su "Mira en 55% de izquierda a derecha, 40% de arriba abajo". Una zona que habla
   * de más es tan inservible como una muda — tapa el anuncio que sí importa, que es el
   * resultado de aplicar.
   *
   * Ahora la mira se mueve al instante (eso es visual y no necesita esperar) y la posición se
   * dice UNA vez, cuando la persona deja de moverse.
   */
  const avisoPendiente = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawing = useRef(false);
  /** Canvas reutilizable para redibujar máscaras (ver la nota en pickAt). */
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Permite cancelar el análisis en curso: sin esto, un 4G que se corta dejaba el spinner
   *  girando para siempre y todos los botones deshabilitados. */
  const abortRef = useRef<AbortController | null>(null);

  // ---- Cargar imagen ----
  const onFile = useCallback(async (file: File) => {
    setErrorMsg("");
    let bitmap: ImageBitmap;
    try {
      // `createImageBitmap` con `resizeWidth/Height` decodifica YA ESCALADO: nunca materializa
      // el bitmap completo. Con `new Image()` una foto de cámara de 50 MP —lo normal en un
      // Redmi Note o un Galaxy A— ocupa 200 MB al decodificarse, por encima del techo de
      // canvas de iOS Safari: la pestaña se recargaba sola y `img.onerror` NO dispara en ese
      // caso, así que el usuario veía desaparecer todo sin un solo mensaje.
      const probe = await createImageBitmap(file);
      const mp = (probe.width * probe.height) / 1_000_000;
      if (mp > MAX_MEGAPIXELES) {
        probe.close();
        setErrorMsg(
          `La foto es demasiado grande (${mp.toFixed(0)} megapíxeles). Probá con una más chica o sacale una captura.`,
        );
        // "empty" y no "error": el selector de archivos sólo se dibuja en "empty". Con
        // "error" quedaba el editor abierto con el lienzo vacío y SIN forma de elegir otra
        // foto — la única salida era recargar la página. Medido, reproducible 2 de 2.
        setStatus("empty");
        return;
      }
      const escala = Math.min(1, MAX_DIM / Math.max(probe.width, probe.height));
      const w0 = Math.max(1, Math.round(probe.width * escala));
      const h0 = Math.max(1, Math.round(probe.height * escala));
      bitmap = escala < 1 ? await createImageBitmap(probe, { resizeWidth: w0, resizeHeight: h0 }) : probe;
      if (bitmap !== probe) probe.close();
    } catch {
      setErrorMsg("No pudimos leer esa imagen. Probá con un JPG o PNG.");
      setStatus("empty"); // mismo motivo: tiene que poder elegir otra foto (ver arriba)
      return;
    }

    {
      const img = bitmap;
      const w = img.width;
      const h = img.height;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0, w, h);

      const base = octx.getImageData(0, 0, w, h);
      baseImageData.current = base;
      compositeRef.current = octx.createImageData(w, h);
      maskRef.current = new Uint8Array(w * h);
      alphaRef.current = new Float32Array(w * h);
      imageUrlRef.current = off.toDataURL("image/jpeg", 0.85); // para enviar al backend
      dims.current = { w, h };
      setAspecto(w / h);

      // La foto en OKLab, una sola vez: la luz de cada píxel para la pintura.
      fotoRef.current = fotoPerceptual(base.data, w * h);
      curvaRef.current = null;
      versionAlfaRef.current++;

      // Preproceso de la varita: YCbCr + gradiente + percentiles (~25 ms). Se hace acá, una
      // sola vez, para que después cada clic sea instantáneo.
      generacionRef.current++;
      deshacerRef.current = null;
      setPuedeDeshacer(false);
      wandRef.current = null;
      if (workerRef.current) {
        // Se manda una COPIA de los píxeles (la original se sigue usando acá para pintar) y se
        // transfiere, no se clona: el worker prepara ahí la foto y este hilo no la guarda.
        const copia = base.data.slice().buffer;
        const pedido: PedidoVarita = { tipo: "foto", datos: copia, ancho: w, alto: h };
        workerRef.current.postMessage(pedido, [copia]);
      } else {
        wandRef.current = prepareWandImage(base);
      }
      lastClickRef.current = null;
      maskBeforeClickRef.current = null;
      setVertices([]);

      // foto nueva → invalidar segmentación remota previa (queda como opción, no como default)
      maskBankRef.current = [];
      segmentedRef.current = false;
      pendingAnalyzeRef.current = false;

      setHasSelection(false);
      setErrorMsg("");
      bitmap.close(); // el bitmap ya se copió al canvas; sin esto queda vivo en paralelo
      setStatus("ready");
    }
  }, []);

  // ---- Lo que se deriva de la máscara: el borde difuminado ----
  // Sin difuminar (`feather` false) el alfa es la máscara tal cual: así queda en medio de una
  // pincelada, que se difumina una vez al soltar.
  const recomputeMaskDerived = useCallback((feather: boolean) => {
    const mask = maskRef.current;
    const alpha = alphaRef.current;
    const { w, h } = dims.current;
    if (!mask || !alpha) return;
    // Radio 1, no 2: el difuminado es hacia adentro, así que los píxeles del borde muestran una
    // mezcla de pintura y pared VIEJA. Con radio 2 eran dos píxeles de aro con el color anterior
    // (ΔE 14-33 en el primero y 7-17 en el segundo contra la pintura): sobre una pared verde
    // oscura pintada de claro, un contorno oscuro alrededor de cada mueble y cada cuadro —el 9 %
    // de lo pintado en r08—. Con radio 1 el segundo píxel ya es pintura (medido por
    // `simulador-fidelidad`, 3/10/2026), y el borde sigue sin escalones.
    if (feather && mask.some((v) => v === 1)) featherMask(mask, alpha, w, h, 1);
    else for (let i = 0; i < mask.length; i++) alpha[i] = mask[i] ? 1 : 0;
    versionAlfaRef.current++;
  }, []);

  // ---- Recompositar ----
  /**
   * Dibuja la foto con la pintura encima. Con `rect`, sólo ese rectángulo: lo usa el pincel,
   * que repintaba la foto ENTERA en cada movimiento del dedo (cientos de milisegundos por
   * movimiento en un celular de gama media: el trazo llegaba tarde) cuando lo único que
   * cambió es el círculo del pincel.
   */
  const repaint = useCallback(
    (rect?: Rect) => {
      const base = baseImageData.current;
      const canvas = viewRef.current;
      const composite = compositeRef.current;
      const foto = fotoRef.current;
      const alpha = alphaRef.current;
      if (!base || !canvas || !composite || !foto || !alpha) return;
      const { w } = dims.current;
      const color = colorRef.current;
      const strength = strengthRef.current;

      const pintura = color ? pinturaDesdeHex(color) : null;
      if (color && pintura) {
        let cache = curvaRef.current;
        // En medio de una pincelada (`rect`) se sigue con la tabla del principio del trazo: el
        // ancla de la pared se recalcula una vez, al soltar.
        if (!cache || cache.color !== color || (!rect && cache.version !== versionAlfaRef.current)) {
          cache = { color, version: versionAlfaRef.current, curva: curva(pintura, ancla(foto, alpha, pintura)) };
          curvaRef.current = cache;
        }
        componer(composite.data, base.data, foto, [{ alfa: alpha, curva: cache.curva }], strength, w, rect);
      } else {
        seleccionVisible(composite.data, base.data, alpha, w, rect);
      }
      const ctx = canvas.getContext("2d")!;
      if (rect) ctx.putImageData(composite, 0, 0, rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
      else ctx.putImageData(composite, 0, 0);
    },
    [],
  );

  // El worker de la varita nace con el componente y muere con él. Si el navegador no tiene
  // workers, o el archivo no carga, todo sigue andando en este hilo, como antes.
  useEffect(() => {
    if (typeof Worker === "undefined") return;
    let hilo: Worker;
    try {
      hilo = new Worker(new URL("./varita.worker.ts", import.meta.url));
    } catch {
      return;
    }
    const pedidos = pedidosRef.current;
    hilo.onmessage = (e: MessageEvent<RespuestaVarita>) => {
      const pedido = pedidos.get(e.data.id);
      pedidos.delete(e.data.id);
      pedido?.resolver(e.data.region);
    };
    // Si el worker se rompe, lo que estaba esperando se calcula acá y no se vuelve a usar.
    hilo.onerror = () => {
      workerRef.current = null;
      hilo.terminate();
      if (!wandRef.current && baseImageData.current) wandRef.current = prepareWandImage(baseImageData.current);
      for (const [id, p] of pedidos) {
        pedidos.delete(id);
        p.resolver(wandRef.current ? magicWand(wandRef.current, p.x, p.y, p.opciones) : null);
      }
    };
    workerRef.current = hilo;
    return () => {
      workerRef.current = null;
      hilo.terminate();
      for (const [id, p] of pedidos) {
        pedidos.delete(id);
        p.resolver(null);
      }
    };
  }, []);

  // dibujar al montar / cambiar color
  useEffect(() => {
    if (status === "empty" || status === "error") return;
    const canvas = viewRef.current;
    if (!canvas || !baseImageData.current) return;
    if (canvas.width !== dims.current.w || canvas.height !== dims.current.h) {
      canvas.width = dims.current.w;
      canvas.height = dims.current.h;
    }
    repaint();
    // `color` y `strength` están a propósito: `repaint` los lee de sus refs (que se actualizan en
    // el efecto de arriba, que corre antes que este), pero cambiarlos tiene que repintar.
  }, [color, strength, status, repaint]);

  // ---- Análisis SAM: UNA sola llamada al servidor por foto; cacheamos todas las regiones. ----
  const analyzeImage = useCallback(async (): Promise<boolean> => {
    if (segmentingRef.current) return false;
    const { w, h } = dims.current;
    if (!w || !h) return false;
    segmentingRef.current = true;
    setStatus("segmenting");
    setErrorMsg("");
    try {
      // Sin señal de cancelación, un 4G que se corta dejaba el spinner girando para siempre
      // y todos los botones deshabilitados, sin ninguna salida. El tope de 70s cubre el
      // arranque en frío del modelo y corta antes de que la plataforma mate la función.
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const corte = setTimeout(() => ctrl.abort(), 70_000);
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrlRef.current, point: { x: 0.5, y: 0.5 }, width: w, height: h }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(corte));
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        let msg = "No se pudo analizar la foto.";
        if (data?.error === "backend_not_configured") msg = "El servidor de IA todavía no está configurado. Por ahora marcá la pared con el 🖌 Pincel.";
        else if (data?.error === "unauthorized") msg = "Iniciá sesión para usar la detección automática. Mientras tanto podés marcar la pared con el 🖌 Pincel.";
        else if (data?.error === "rate_limited") msg = "Llegaste al límite de análisis por hora. Seguí con el 🖌 Pincel o probá más tarde.";
        else if (data?.error === "image_too_large") msg = "La foto es demasiado pesada. Probá con una imagen más chica.";
        else if (data?.message) msg = `Error del servidor: ${data.message}`;
        else if (data?.error) msg = `Error del servidor (${data.error}).`;
        setErrorMsg(msg);
        return false;
      }

      const masks: string[] = Array.isArray(data?.masks) ? data.masks : [];
      if (masks.length === 0) {
        setErrorMsg("El servidor no devolvió regiones. Probá con otra foto o usá el 🖌 Pincel.");
        return false;
      }

      // Decodificamos cada región UNA vez a baja resolución (para hit-test/área instantáneos).
      const sw = Math.max(1, Math.min(360, w));
      const sh = Math.max(1, Math.round((sw * h) / w));
      const sc = document.createElement("canvas");
      sc.width = sw;
      sc.height = sh;
      const sctx = sc.getContext("2d", { willReadFrequently: true })!;
      const bank: { small: Uint8Array; sw: number; sh: number; area: number; url: string }[] = [];
      for (const url of masks) {
        const img = await loadImage(url).catch(() => null);
        if (!img) continue;
        sctx.clearRect(0, 0, sw, sh);
        sctx.drawImage(img, 0, 0, sw, sh);
        const d = sctx.getImageData(0, 0, sw, sh).data;
        const small = new Uint8Array(sw * sh);
        let area = 0;
        for (let i = 0; i < sw * sh; i++) {
          if (isSet(d, i * 4)) {
            small[i] = 1;
            area++;
          }
        }
        bank.push({ small, sw, sh, area, url });
      }
      maskBankRef.current = bank;
      segmentedRef.current = bank.length > 0;
      return segmentedRef.current;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        // Lo canceló la persona, o venció el tope de 70s. No es un error que reportar.
        return false;
      }
      console.error(e);
      setErrorMsg("No se pudo contactar al servidor de segmentación. Usá el 🖌 Pincel.");
      return false;
    } finally {
      segmentingRef.current = false;
      abortRef.current = null;
      // `setStatus("ready")` incondicional rompía el editor: si la persona tocaba "Cambiar
      // foto" durante el análisis, `reset()` dejaba el estado en "empty" y este finally lo
      // pisaba con "ready" — quedaba el editor montado con la foto en null, un canvas gris
      // de 300×150 y sin forma de subir otra. Sólo se vuelve a "ready" si hay foto cargada.
      if (baseImageData.current) setStatus("ready");
    }
  }, []);

  // ---- Selección instantánea: del banco cacheado, suma la región del clic a la máscara. ----
  const pickAt = useCallback(
    async (nx: number, ny: number): Promise<boolean> => {
      const out = maskRef.current;
      const bank = maskBankRef.current;
      const { w, h } = dims.current;
      if (!out || bank.length === 0) return false;

      // Precisión QUIRÚRGICA: de las regiones cuyo vecindario del clic está prendido, tomamos la
      // MÁS AJUSTADA (menor área) para no invadir de más; vos sumás clics para crecerla. Ignoramos
      // motas diminutas (ruido); si solo hay motas, caemos a la mayor de ellas.
      const R = 2;
      const minArea = 0.003 * (bank[0]?.sw ?? 1) * (bank[0]?.sh ?? 1);
      let best: (typeof bank)[number] | null = null; // menor área válida
      let fallback: (typeof bank)[number] | null = null; // mayor área (por si todo es mota)
      for (const m of bank) {
        const px = Math.min(m.sw - 1, Math.max(0, Math.round(nx * m.sw)));
        const py = Math.min(m.sh - 1, Math.max(0, Math.round(ny * m.sh)));
        let hit = false;
        for (let dy = -R; dy <= R && !hit; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            const x = px + dx;
            const y = py + dy;
            if (x < 0 || y < 0 || x >= m.sw || y >= m.sh) continue;
            if (m.small[y * m.sw + x]) {
              hit = true;
              break;
            }
          }
        }
        if (!hit) continue;
        if (!fallback || m.area > fallback.area) fallback = m;
        if (m.area >= minArea && (!best || m.area < best.area)) best = m;
      }
      best = best ?? fallback;
      if (!best) return false;

      // Redibujamos la ganadora a resolución plena y la SUMAMOS a la selección (clics acumulativos).
      const img = await loadImage(best.url).catch(() => null);
      if (!img) return false;
      // Un solo canvas reusado, no uno por clic: cada uno pesa ~3 MB y el navegador no los
      // libera enseguida. Con setenta clics se llegaba al techo de memoria de canvas de iOS
      // ("Total canvas memory exceeds the limit") y la pestaña moría.
      const fc = scratchCanvasRef.current ?? (scratchCanvasRef.current = document.createElement("canvas"));
      if (fc.width !== w || fc.height !== h) {
        fc.width = w;
        fc.height = h;
      }
      const fctx = fc.getContext("2d", { willReadFrequently: true })!;
      fctx.clearRect(0, 0, w, h);
      fctx.drawImage(img, 0, 0, w, h);
      const fd = fctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) if (isSet(fd, i * 4)) out[i] = 1;
      recomputeMaskDerived(true);
      repaint();
      return true;
    },
    [recomputeMaskDerived, repaint],
  );

  // Dispara el análisis remoto (una vez) cuando la foto ya está montada. Sólo si alguien
  // lo pide explícitamente: el default es la varita local.
  useEffect(() => {
    if (status === "ready" && pendingAnalyzeRef.current && !segmentedRef.current) {
      pendingAnalyzeRef.current = false;
      void analyzeImage();
    }
  }, [status, analyzeImage]);

  // ---- Varita mágica: selección local instantánea ----
  // Parte de la selección que había ANTES del último clic y le suma la región nueva. Guardar
  // ese estado previo es lo que permite mover el slider de sensibilidad y ver el resultado
  // recalcularse en vivo, sin perder los clics anteriores ni acumular basura.
  /** La región que la varita agarra en un punto: en el worker si hay, acá si no. */
  const regionDe = useCallback((x: number, y: number, opciones: WandOptions): Promise<Uint8Array | null> => {
    const hilo = workerRef.current;
    if (hilo) {
      return new Promise((resolver) => {
        const id = ++secuenciaRef.current;
        pedidosRef.current.set(id, { x, y, opciones, resolver });
        const pedido: PedidoVarita = { tipo: "varita", id, x, y, opciones };
        hilo.postMessage(pedido);
      });
    }
    if (!wandRef.current && baseImageData.current) wandRef.current = prepareWandImage(baseImageData.current);
    return Promise.resolve(wandRef.current ? magicWand(wandRef.current, x, y, opciones) : null);
  }, []);

  /** Guarda cómo estaba la selección antes de un cambio, para "Deshacer" (un solo nivel). */
  const recordarParaDeshacer = useCallback((antes: Uint8Array | null) => {
    deshacerRef.current = antes ? new Uint8Array(antes) : null;
    setPuedeDeshacer(!!antes);
  }, []);

  /**
   * Aplica la varita en un punto. Devuelve "ok", "chica" (no había una superficie clara) o
   * "viejo" (mientras se calculaba, la persona hizo otra cosa: no se toca nada).
   *
   * Lo que acompaña a una selección nueva —que se pueda deshacer, que aparezca "Limpiar
   * selección", que se vaya el aviso de error— se hace ACÁ y no en quien la llama. Antes lo
   * hacía sólo el clic, y había otro camino que también selecciona: mover la Sensibilidad
   * después de un toque que no agarró nada. El aviso de ese toque pide justamente eso ("subí
   * la Sensibilidad"); la zona aparecía pintada, pero seguía el aviso de error, no estaba
   * "Limpiar selección", y "Deshacer" volvía a lo de ANTES del toque anterior: se llevaba
   * también la pared que ya estaba pintada (medido por `simulador-uso-real`, 3/10/2026).
   */
  const applyWand = useCallback(
    async (nx: number, ny: number, tol: number, opts?: { rapido?: boolean }): Promise<"ok" | "chica" | "viejo"> => {
      const out = maskRef.current;
      const { w, h } = dims.current;
      if (!out) return "viejo";
      const generacion = generacionRef.current;

      // `rapido` = se está arrastrando el slider: se saltea el cierre de huecos, que es el
      // 66% del costo. El resultado se ve casi igual y la mano no siente el tirón.
      const region = await regionDe(nx * w, ny * h, {
        tolerance: tol,
        ...(opts?.rapido ? { fillHoles: 0 } : {}),
      });
      if (generacion !== generacionRef.current || maskRef.current !== out) return "viejo";
      if (!region) return "chica";

      // Un clic sobre un objeto pequeño y muy contrastado (un cuadro, un enchufe, una junta)
      // queda encerrado entre bordes y devuelve una región mínima. Eso no le sirve a nadie:
      // mejor no ensuciar la selección y decirle al usuario dónde tocar.
      let area = 0;
      for (let i = 0; i < region.length; i++) area += region[i];
      if (area < region.length * 0.002) return "chica";

      const prev = maskBeforeClickRef.current;
      for (let i = 0; i < out.length; i++) out[i] = (prev?.[i] ?? 0) || region[i] ? 1 : 0;

      recomputeMaskDerived(true);
      repaint();
      // "Deshacer" vuelve a como estaba antes del toque, con la Sensibilidad que sea.
      recordarParaDeshacer(prev);
      setHasSelection(true);
      setErrorMsg("");
      return "ok";
    },
    [recomputeMaskDerived, repaint, regionDe, recordarParaDeshacer],
  );

  // ---- Clic en el canvas → selecciona la superficie tocada ----
  /**
   * Seleccionar la superficie que hay en un punto de la foto, en coordenadas de 0 a 1.
   *
   * Vive separado del manejador del mouse porque el teclado entra por acá con la posición de
   * la mira: un clic y un Enter tienen que hacer exactamente lo mismo, y la única forma de
   * garantizarlo es que sea el mismo código.
   */
  /** Vuelve la selección a como estaba antes del último clic, pincelada o "Limpiar". */
  const deshacer = () => {
    const antes = deshacerRef.current;
    const mask = maskRef.current;
    if (!antes || !mask || antes.length !== mask.length) return;
    mask.set(antes);
    deshacerRef.current = null;
    setPuedeDeshacer(false);
    // Ya no hay un "último clic" que recalcular con la sensibilidad, y lo que esté en vuelo
    // no corresponde a esta selección.
    lastClickRef.current = null;
    maskBeforeClickRef.current = null;
    generacionRef.current++;
    recomputeMaskDerived(true);
    repaint();
    setHasSelection(mask.some((v) => v === 1));
    setErrorMsg("");
    setAviso("Se deshizo el último cambio.");
  };

  const aplicarEn = (nx: number, ny: number): Promise<void> => {
    // En cola: la varita contesta un instante después, y un segundo clic que llegue antes
    // tiene que sumar sobre lo que dejó el primero, no pisarlo.
    const turno = colaClicsRef.current.then(() => aplicarEnAhora(nx, ny)).catch(() => {});
    colaClicsRef.current = turno;
    return turno;
  };

  const aplicarEnAhora = async (nx: number, ny: number) => {
    if (brush !== "off" || status !== "ready") return;
    const canvas = viewRef.current;
    if (!canvas) return;

    // Congelamos la selección actual como base: este clic SUMA sobre ella.
    generacionRef.current++;
    arrastreRef.current.pendiente = null;
    maskBeforeClickRef.current = maskRef.current ? new Uint8Array(maskRef.current) : null;
    setErrorMsg("");

    if (useAI) {
      // Modo remoto: la primera vez hay que analizar la foto entera (lento).
      lastClickRef.current = null; // la sensibilidad no aplica a las regiones del modelo
      if (!segmentedRef.current) {
        const ok = await analyzeImage();
        if (!ok) return;
      }
      if (await pickAt(nx, ny)) {
        recordarParaDeshacer(maskBeforeClickRef.current);
        setHasSelection(true);
        setAviso(color ? "Superficie pintada." : "Superficie seleccionada. Elegí un color de la lista para aplicarlo.");
      } else setErrorMsg("No detectamos una superficie ahí. Probá el modo Varita o el 🖌 Pincel.");
      return;
    }

    lastClickRef.current = { x: nx, y: ny };
    const resultado = await applyWand(nx, ny, tolerance);
    if (resultado === "ok") {
      setAviso(color ? "Superficie pintada." : "Superficie seleccionada. Elegí un color de la lista para aplicarlo.");
    } else if (resultado === "chica")
      setErrorMsg(
        "Ahí la varita no encontró una superficie pareja (puede ser un cuadro, un enchufe o una junta). Tocá una zona más lisa. Si la pared tiene mucha textura —ladrillo, piedra, madera—, marcala con ⬠ Contorno.",
      );
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    const canvas = viewRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (contorno !== "off") {
      marcarEsquina(nx, ny, rect);
      return;
    }
    void aplicarEn(nx, ny);
  };

  // ---- Contorno ----
  /**
   * Una esquina más. Tocar cerca de la primera (con tres o más marcadas) cierra la zona.
   * Cerca del borde de la foto la esquina se pega al borde: una fachada o un techo suelen
   * llegar hasta ahí, y acertarle al último píxel con el dedo es imposible.
   */
  const marcarEsquina = (nx: number, ny: number, rect?: DOMRect) => {
    if (status !== "ready") return;
    const anchoCss = rect?.width ?? 1000;
    const altoCss = rect?.height ?? 1000;
    const pegar = (v: number, largo: number) => (v * largo < 12 ? 0 : (1 - v) * largo < 12 ? 1 : Math.min(1, Math.max(0, v)));
    const p = { x: pegar(nx, anchoCss), y: pegar(ny, altoCss) };
    const primera = vertices[0];
    if (rect && primera && vertices.length >= 3 && Math.hypot((p.x - primera.x) * anchoCss, (p.y - primera.y) * altoCss) < 18) {
      cerrarContorno();
      return;
    }
    const siguientes = [...vertices, p];
    setVertices(siguientes);
    setErrorMsg("");
    setAviso(
      siguientes.length < 3
        ? `Esquina ${siguientes.length} marcada. Seguí con la próxima.`
        : `Esquina ${siguientes.length} marcada. Para terminar, tocá la primera esquina o «Cerrar contorno».`,
    );
  };

  const cerrarContorno = () => {
    const mask = maskRef.current;
    const { w, h } = dims.current;
    if (!mask) return;
    if (vertices.length < 3) {
      setErrorMsg("Marcá al menos tres esquinas de la zona.");
      return;
    }
    const antes = new Uint8Array(mask);
    rellenarPoligono(
      mask,
      w,
      h,
      vertices.map((v) => [v.x * w, v.y * h] as const),
      contorno === "quitar" ? 0 : 1,
    );
    lastClickRef.current = null;
    maskBeforeClickRef.current = null;
    generacionRef.current++;
    recomputeMaskDerived(true);
    repaint();
    recordarParaDeshacer(antes);
    setHasSelection(mask.some((v) => v === 1));
    setVertices([]);
    setErrorMsg("");
    setAviso(contorno === "quitar" ? "Zona quitada." : color ? "Zona pintada." : "Zona marcada. Elegí un color para pintarla.");
  };

  const alternarContorno = () => {
    setContorno((c) => (c === "off" ? "sumar" : "off"));
    setVertices([]);
    setBrush("off");
  };

  /**
   * Mover la sensibilidad recalcula el último clic en vivo.
   *
   * `fillHoles: 0` mientras se arrastra: cerrar huecos es el 66% del costo de la varita y su
   * precio es fijo, no depende del contenido. Con el cierre puesto, cada evento del slider
   * bloqueaba ~390 ms en un celular de gama media y la pantalla quedaba congelada casi dos
   * segundos durante un arrastre. Al soltar se recalcula una vez con la calidad completa.
   */
  const onToleranceChange = (value: number) => {
    setTolerance(value);
    recalcularArrastre(value);
  };

  /**
   * Un pedido a la vez mientras se arrastra. Cada movimiento del slider dispara un recálculo
   * y la respuesta ya no es inmediata: sin esto se apilan veinte pedidos y la imagen llega
   * con segundos de atraso. Se guarda sólo el último valor y se manda cuando vuelve el anterior.
   */
  const recalcularArrastre = (value: number) => {
    const last = lastClickRef.current;
    if (!last || status !== "ready") return;
    const a = arrastreRef.current;
    if (a.enVuelo) {
      a.pendiente = value;
      return;
    }
    a.enVuelo = true;
    void applyWand(last.x, last.y, value, { rapido: true }).finally(() => {
      a.enVuelo = false;
      if (a.pendiente !== null) {
        const siguiente = a.pendiente;
        a.pendiente = null;
        recalcularArrastre(siguiente);
      }
    });
  };

  /** Al soltar el slider: una pasada con la calidad completa. */
  const onToleranceCommit = () => {
    const last = lastClickRef.current;
    arrastreRef.current.pendiente = null; // que un valor en espera no pise la pasada final
    if (last && status === "ready") void applyWand(last.x, last.y, tolerance);
  };

  // ---- Pincel (ajuste manual) ----
  /** Pincelada en coordenadas de 0 a 1, para que el teclado pinte igual que el dedo. */
  const pintarEn = useCallback(
    (nx: number, ny: number) => {
      const canvas = viewRef.current;
      const mask = maskRef.current;
      if (!canvas || !mask || brush === "off") return;
      const rect = canvas.getBoundingClientRect();
      const { w, h } = dims.current;
      const x = Math.round(nx * w);
      const y = Math.round(ny * h);
      const radius = Math.round((brushSize / rect.width) * w);
      const val = brush === "add" ? 1 : 0;
      const alpha = alphaRef.current;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          mask[py * w + px] = val;
          // El alfa, sin difuminar, sólo donde pasó el pincel: el resto de la foto no cambió.
          if (alpha) alpha[py * w + px] = val;
        }
      }
      // Una pincelada es una edición manual: deja de haber un "último clic" que recalcular,
      // así mover la sensibilidad después no se lleva puesto lo que el usuario ajustó a mano.
      lastClickRef.current = null;
      maskBeforeClickRef.current = null;
      generacionRef.current++;

      // Sólo se repinta el círculo del pincel. Antes cada movimiento del dedo recalculaba y
      // repintaba la foto entera —dos pasadas por la máscara y la composición completa—, y en
      // un celular el trazo llegaba tarde. El difuminado y el ancla de la pared se recalculan
      // una vez, al soltar (`terminarTrazo`).
      repaint({
        x0: Math.max(0, x - radius),
        y0: Math.max(0, y - radius),
        x1: Math.min(w, x + radius + 1),
        y1: Math.min(h, y + radius + 1),
      });
      if (val === 1) setHasSelection(true);
    },
    [brush, brushSize, repaint],
  );

  const paintAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = viewRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      pintarEn((clientX - rect.left) / rect.width, (clientY - rect.top) / rect.height);
    },
    [pintarEn],
  );

  /**
   * El teclado sobre el lienzo. Las flechas mueven la mira, Enter (o barra espaciadora)
   * aplica ahí lo mismo que haría un clic: seleccionar con la varita, o pintar si el pincel
   * está encendido. Con Shift el paso es fino, para ajustar el punto exacto.
   *
   * `preventDefault` en las flechas y en la barra es a propósito: si no, la página entera
   * scrollea mientras se intenta mover la mira y no se ve lo que está pasando.
   */
  const onCanvasKeyDown = (e: React.KeyboardEvent) => {
    if (status !== "ready") return;
    const paso = e.shiftKey ? 0.01 : 0.05;
    const actual = mira ?? { x: 0.5, y: 0.5 };
    const topar = (v: number) => Math.min(1, Math.max(0, v));

    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      // Si había una posición esperando para anunciarse, se descarta: lo que importa ahora es
      // el resultado, y dos anuncios encimados no se entienden.
      if (avisoPendiente.current) clearTimeout(avisoPendiente.current);
      setMira(actual);
      setErrorMsg("");
      if (contorno !== "off") {
        marcarEsquina(actual.x, actual.y);
        return;
      }
      if (brush !== "off") {
        recordarParaDeshacer(maskRef.current);
        pintarEn(actual.x, actual.y);
        cerrarTrazo();
        setAviso(brush === "add" ? "Sumaste pintura en la mira." : "Borraste pintura en la mira.");
      } else {
        setAviso("Buscando la superficie…");
        void aplicarEn(actual.x, actual.y);
      }
      return;
    }

    const mover: Record<string, [number, number]> = {
      ArrowLeft: [-paso, 0],
      ArrowRight: [paso, 0],
      ArrowUp: [0, -paso],
      ArrowDown: [0, paso],
    };
    const d = mover[e.key];
    if (!d) return;
    e.preventDefault();
    const siguiente = { x: topar(actual.x + d[0]), y: topar(actual.y + d[1]) };
    setMira(siguiente);

    // Se anuncia cuando la persona frena, no en cada tecla. 500 ms: menos se vuelve a
    // encimar entre flechazos seguidos, y más se siente que el lienzo no contesta.
    if (avisoPendiente.current) clearTimeout(avisoPendiente.current);
    avisoPendiente.current = setTimeout(() => {
      setAviso(
        `Mira en ${Math.round(siguiente.x * 100)}% de izquierda a derecha, ` +
          `${Math.round(siguiente.y * 100)}% de arriba abajo. Enter para aplicar.`,
      );
    }, 500);
  };

  /**
   * Cierra el trazo actual. Se usa desde pointerup, pointercancel y pointerleave.
   *
   * El feathering y el repintado se hacen UNA vez al soltar, no en cada movimiento del dedo:
   * por eso hace falta un final de trazo confiable, y por eso los tres eventos terminan acá.
   */
  const cerrarTrazo = useCallback(() => {
    recomputeMaskDerived(true);
    repaint();
    // Con "⌫ Borrar" se puede vaciar la selección entera a pinceladas.
    setHasSelection(!!maskRef.current?.some((v) => v === 1));
  }, [recomputeMaskDerived, repaint]);

  const terminarTrazo = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    cerrarTrazo();
  }, [cerrarTrazo]);

  const clearSelection = () => {
    recordarParaDeshacer(maskRef.current);
    if (maskRef.current) maskRef.current.fill(0);
    lastClickRef.current = null;
    maskBeforeClickRef.current = null;
    generacionRef.current++;
    recomputeMaskDerived(true);
    repaint();
    setHasSelection(false);
  };

  const reset = () => {
    baseImageData.current = null;
    maskRef.current = null;
    compositeRef.current = null;
    fotoRef.current = null;
    curvaRef.current = null;
    alphaRef.current = null;
    imageUrlRef.current = "";
    maskBankRef.current = [];
    segmentedRef.current = false;
    pendingAnalyzeRef.current = false;
    wandRef.current = null;
    generacionRef.current++;
    deshacerRef.current = null;
    setPuedeDeshacer(false);
    workerRef.current?.postMessage({ tipo: "soltar" } satisfies PedidoVarita);
    lastClickRef.current = null;
    maskBeforeClickRef.current = null;
    setHasSelection(false);
    setZoom(1);
    setStatus("empty");
    setErrorMsg("");
    setBrush("off");
    setContorno("off");
    setVertices([]);
  };

  const segmenting = status === "segmenting";

  return (
    <div>
      {status === "empty" ? (
        <label className="flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed border-concrete/30 bg-mist cursor-pointer hover:border-ink transition-colors duration-300">
          <span className="font-display text-display-md text-concrete mb-2">＋</span>
          <span className="font-body text-body-md text-ink">Subí una foto de tu ambiente</span>
          <span className="font-body text-body-sm text-concrete mt-1">JPG o PNG · pared, frente o fachada</span>
          {/* El aviso de una foto rechazada se mostraba sólo dentro del editor, que en ese
              caso no se llega a abrir: la persona volvía acá sin saber por qué. */}
          {errorMsg && (
            <span className="font-body text-body-sm text-[#C41E3A] mt-4 max-w-sm text-center px-4">{errorMsg}</span>
          )}
          {/* `sr-only` y no `hidden`: display:none saca el input del orden de tabulación, así
              que NO había forma de subir una foto con el teclado. sr-only lo oculta a la vista
              pero lo deja alcanzable y enfocable. */}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Lienzo (con zoom) */}
          <div className="relative overflow-auto bg-mist border border-concrete/15" style={{ maxHeight: "70vh" }}>
            {/* El ancho es el que deja entrar la foto ENTERA en el recuadro (70 % del alto de la
                pantalla), por el zoom. Era siempre el 100 % del ancho: una foto vertical medía
                1.316 px de alto en un recuadro de 628 y había que desplazarse adentro para ver o
                tocar la parte de abajo (medido por `simulador-color`, 3/10/2026). */}
            <div
              className="relative mx-auto"
              // 2 px menos por el borde del recuadro: si no, aparece una barra de desplazamiento.
              style={{ width: `calc(min(100%, (70vh - 2px) * ${aspecto.toFixed(4)}) * ${zoom})` }}
            >
              <canvas
                ref={viewRef}
                onClick={onCanvasClick}
                // Un canvas no es enfocable ni tiene nombre: para el teclado y para un lector
                // de pantalla, acá no había nada. `tabIndex` lo pone en el recorrido, la
                // etiqueta dice qué es y la descripción explica cómo se maneja.
                tabIndex={0}
                role="application"
                aria-label="Foto de tu ambiente. Elegí acá la superficie a pintar."
                aria-describedby="simulador-ayuda-teclado"
                onKeyDown={onCanvasKeyDown}
                className={cn(
                  "block w-full h-auto select-none",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  // `touch-none` SÓLO con el pincel activo, que es cuando hace falta quedarse
                  // con el gesto para dibujar. Estaba puesto siempre, y como los handlers de
                  // abajo salen temprano si el pincel está apagado, en el celular el canvas
                  // se comía el gesto sin usarlo: no se podía scrollear la página arrastrando
                  // encima, ni desplazar la foto con el zoom puesto (que la dejaba más grande
                  // que la pantalla y sin forma de moverla).
                  brush !== "off" ? "touch-none" : "touch-auto",
                  segmenting ? "cursor-wait" : brush !== "off" || contorno !== "off" ? "cursor-crosshair" : "cursor-pointer",
                )}
                onPointerDown={(e) => {
                  if (brush === "off") return;
                  recordarParaDeshacer(maskRef.current);
                  drawing.current = true;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  paintAt(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => drawing.current && paintAt(e.clientX, e.clientY)}
                onPointerUp={terminarTrazo}
                // Sin estos dos, una llamada entrante o un gesto que el sistema se lleva dejan
                // `drawing` en true: se vuelve a la pestaña y el pincel sigue pintando solo.
                onPointerCancel={terminarTrazo}
                onPointerLeave={terminarTrazo}
              />

              {/* El contorno que se está marcando: líneas entre las esquinas (claras con borde
                  oscuro, para que se vean sobre cualquier foto) y un punto en cada esquina. La
                  primera es más grande: tocarla cierra la zona. */}
              {contorno !== "off" && vertices.length > 0 && (
                <>
                  <svg
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox="0 0 1 1"
                    preserveAspectRatio="none"
                  >
                    {vertices.length >= 3 && (
                      <polygon
                        points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                        fill={contorno === "quitar" ? "rgba(196,30,58,0.22)" : "rgba(20,120,230,0.22)"}
                        stroke="none"
                      />
                    )}
                    <polyline
                      points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={4}
                      vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      points={vertices.map((v) => `${v.x},${v.y}`).join(" ")}
                      fill="none"
                      stroke="#141414"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {vertices.map((v, i) => (
                    <div
                      key={i}
                      aria-hidden="true"
                      className={cn(
                        "absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-bone",
                        i === 0 && vertices.length >= 3 ? "w-5 h-5" : "w-3 h-3",
                      )}
                      style={{ left: `${v.x * 100}%`, top: `${v.y * 100}%` }}
                    />
                  ))}
                </>
              )}

              {/* La mira del teclado. Dos líneas cruzadas con contorno claro para que se vea
                  sobre cualquier foto, y `pointer-events-none` para que no le robe el clic al
                  lienzo que tiene abajo. */}
              {mira && (
                <div
                  aria-hidden="true"
                  className="absolute pointer-events-none"
                  style={{ left: `${mira.x * 100}%`, top: `${mira.y * 100}%` }}
                >
                  <div className="relative -translate-x-1/2 -translate-y-1/2">
                    <div className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-[3px] bg-bone shadow-[0_0_0_1px_rgba(20,20,20,0.9)]" />
                    <div className="absolute -translate-x-1/2 -translate-y-1/2 h-8 w-[3px] bg-bone shadow-[0_0_0_1px_rgba(20,20,20,0.9)]" />
                    <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-ink bg-bone/60" />
                  </div>
                </div>
              )}

              {/* Estado de carga: shimmer + spinner mientras el servidor procesa */}
              {segmenting && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" />
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-bone/40 to-transparent" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-bone">
                    <span className="w-9 h-9 rounded-full border-2 border-bone/40 border-t-bone animate-spin" />
                    <span className="font-mono text-mono-sm uppercase tracking-widest mt-3 bg-ink/60 px-3 py-1">
                      Analizando la foto (una sola vez)…
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center border border-concrete/30">
              <button
                onClick={() => {
                  setBrush((b) => (b === "add" ? "off" : "add"));
                  setContorno("off");
                  setVertices([]);
                }}
                // Sin esto, quien usa lector de pantalla no tenía forma de saber qué herramienta
                // estaba prendida: la única señal era el fondo oscuro del botón.
                aria-pressed={brush === "add"}
                disabled={segmenting}
                className={cn("px-3 py-2 font-body text-body-sm transition-colors disabled:opacity-40", brush === "add" ? "bg-ink text-bone" : "hover:bg-mist")}
              >
                🖌 Pincel
              </button>
              <button
                onClick={() => {
                  setBrush((b) => (b === "erase" ? "off" : "erase"));
                  setContorno("off");
                  setVertices([]);
                }}
                aria-pressed={brush === "erase"}
                disabled={segmenting}
                className={cn("px-3 py-2 font-body text-body-sm border-l border-concrete/30 transition-colors disabled:opacity-40", brush === "erase" ? "bg-ink text-bone" : "hover:bg-mist")}
              >
                ⌫ Borrar
              </button>
            </div>

            <div className="flex items-center border border-concrete/30">
              <button
                onClick={alternarContorno}
                disabled={segmenting}
                aria-pressed={contorno !== "off"}
                className={cn(
                  "px-3 py-2 font-body text-body-sm transition-colors disabled:opacity-40",
                  contorno !== "off" ? "bg-ink text-bone" : "hover:bg-mist",
                )}
                title="Marcá las esquinas de una zona: para ladrillo, piedra, o separar la pared del techo"
              >
                ⬠ Contorno
              </button>
            </div>

            {contorno !== "off" && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center border border-concrete/30">
                  <button
                    onClick={() => setContorno("sumar")}
                    aria-pressed={contorno === "sumar"}
                    className={cn("px-3 py-2 font-body text-body-sm transition-colors", contorno === "sumar" ? "bg-ink text-bone" : "hover:bg-mist")}
                  >
                    Pintar la zona
                  </button>
                  <button
                    onClick={() => setContorno("quitar")}
                    aria-pressed={contorno === "quitar"}
                    className={cn(
                      "px-3 py-2 font-body text-body-sm border-l border-concrete/30 transition-colors",
                      contorno === "quitar" ? "bg-ink text-bone" : "hover:bg-mist",
                    )}
                  >
                    Quitar la zona
                  </button>
                </div>
                <button
                  onClick={cerrarContorno}
                  aria-disabled={vertices.length < 3}
                  className={cn(
                    "px-3 py-2 font-body text-body-sm border border-ink transition-colors",
                    vertices.length < 3 ? "opacity-40" : "bg-ink text-bone",
                  )}
                >
                  Cerrar contorno
                </button>
                {vertices.length > 0 && (
                  <button
                    onClick={() => setVertices((v) => v.slice(0, -1))}
                    className="py-2 font-body text-body-sm text-concrete hover:text-ink transition-colors"
                  >
                    Borrar última esquina
                  </button>
                )}
              </div>
            )}

            {brush !== "off" && (
              <label className="flex items-center gap-2 font-mono text-mono-sm text-concrete">
                Tamaño
                <input type="range" min={10} max={120} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
              </label>
            )}

            {/* Modo de selección. La varita es el default: instantánea y sin depender del backend. */}
            <div className="flex items-center border border-concrete/30">
              <button
                onClick={() => setUseAI(false)}
                aria-pressed={!useAI}
                disabled={segmenting}
                className={cn(
                  "px-3 py-2 font-body text-body-sm transition-colors disabled:opacity-40",
                  !useAI ? "bg-ink text-bone" : "hover:bg-mist",
                )}
                title="Selección instantánea en tu navegador"
              >
                ✨ Varita
              </button>
              <button
                onClick={() => setUseAI(true)}
                aria-pressed={useAI}
                disabled={segmenting}
                className={cn(
                  "px-3 py-2 font-body text-body-sm border-l border-concrete/30 transition-colors disabled:opacity-40",
                  useAI ? "bg-ink text-bone" : "hover:bg-mist",
                )}
                title="Segmentación en el servidor: más lenta, útil en superficies muy texturadas"
              >
                🤖 IA
              </button>
            </div>

            {/* Sensibilidad de la varita: recalcula el último clic en vivo. */}
            {brush === "off" && !useAI && contorno === "off" && (
              <label
                className="flex items-center gap-2 font-mono text-mono-sm text-concrete"
                title="Cuánta superficie abarca cada clic. Bajala si se pasa a otras zonas; subila si quedó corto."
              >
                Sensibilidad
                <input
                  type="range"
                  min={5}
                  max={70}
                  value={tolerance}
                  onChange={(e) => onToleranceChange(Number(e.target.value))}
                  // Al soltar, una pasada con la calidad completa (ver onToleranceCommit).
                  onPointerUp={onToleranceCommit}
                  onKeyUp={onToleranceCommit}
                  onBlur={onToleranceCommit}
                />
                <span className="tabular-nums w-6">{tolerance}</span>
              </label>
            )}

            <div className="flex items-center border border-concrete/30">
              <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="px-3 py-2 font-body text-body-sm hover:bg-mist" aria-label="Alejar">
                −
              </button>
              <span className="px-2 font-mono text-mono-sm text-concrete tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} className="px-3 py-2 font-body text-body-sm border-l border-concrete/30 hover:bg-mist" aria-label="Acercar">
                +
              </button>
            </div>

            {hasSelection && strengthDeAfuera === undefined && (
              <label className="flex items-center gap-2 font-mono text-mono-sm text-concrete">
                Intensidad
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={Math.round(strength * 100)}
                  onChange={(e) => setStrength(Number(e.target.value) / 100)}
                />
              </label>
            )}

            {puedeDeshacer && (
              <button onClick={deshacer} disabled={segmenting} className="py-1 font-body text-body-sm text-concrete hover:text-ink transition-colors disabled:opacity-40">
                Deshacer
              </button>
            )}
            {hasSelection && (
              <button onClick={clearSelection} disabled={segmenting} className="py-1 font-body text-body-sm text-concrete hover:text-ink transition-colors disabled:opacity-40">
                Limpiar selección
              </button>
            )}

            <button onClick={reset} className="ml-auto font-body text-body-sm text-concrete hover:text-ink transition-colors">
              Cambiar foto
            </button>
          </div>

          {/* Lo que pasa en el lienzo no se ve si no ves el lienzo. Enter con la varita tarda
              unos milisegundos y no cambia ningún texto: sin esto, quien navega con lector de
              pantalla apretaba Enter y no recibía ninguna respuesta. */}
          <p className="sr-only" role="status" aria-live="polite">
            {errorMsg || aviso}
          </p>

          {/* Las instrucciones del teclado: visibles para todos, y referenciadas por el
              `aria-describedby` del lienzo para que se lean al enfocarlo. Van siempre, no sólo
              cuando alguien tabula: una ayuda que aparece recién cuando ya te perdiste no
              sirve. */}
          <p id="simulador-ayuda-teclado" className="font-body text-body-sm text-concrete">
            <strong className="text-ink">Con teclado:</strong> entrá al lienzo con Tab, movés la
            mira con las <strong className="text-ink">flechas</strong> (con Shift, paso fino) y
            aplicás con <strong className="text-ink">Enter</strong>. Hace lo mismo que tocar: elige
            la superficie, o pinta si tenés el pincel encendido.
          </p>

          {errorMsg ? (
            <p className="font-body text-body-sm text-[#C41E3A]">{errorMsg}</p>
          ) : status === "ready" && contorno !== "off" ? (
            <p className="font-body text-body-sm text-concrete">
              <strong className="text-ink">Tocá las esquinas de la zona</strong>, una por una. Para cerrarla, tocá la
              primera esquina o <strong className="text-ink">Cerrar contorno</strong>. Sirve para fachadas de ladrillo,
              piedra o madera, y con <strong className="text-ink">Quitar la zona</strong> para sacar el techo si la
              varita se pasó.
            </p>
          ) : status === "ready" && brush === "off" ? (
            <p className="font-body text-body-sm text-concrete">
              <strong className="text-ink">Tocá la pared</strong> que querés pintar. Si agarró de más o de menos, movés
              <strong className="text-ink"> Sensibilidad</strong> y se recalcula al instante. Podés
              <strong className="text-ink"> sumar toques</strong> para agregar otras paredes. Si se pasó al techo o a un
              mueble del mismo color, o la pared tiene mucha textura, marcala con
              <strong className="text-ink"> ⬠ Contorno</strong>.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Un píxel de máscara está "prendido" si es opaco y claro (soporta alfa o escala de grises).
function isSet(d: Uint8ClampedArray, p: number): boolean {
  return d[p + 3] > 128 && (d[p] + d[p + 1] + d[p + 2]) / 3 > 128;
}

// Carga una imagen (data URL) y resuelve cuando está lista. Las data URLs no "tainted"
// el canvas, así que después podemos leer sus píxeles con getImageData.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });
}

// ---------- feathering ----------
// Box blur separable (H + V) de la máscara binaria → alfa 0..1. Suaviza los bordes
// para que la pintura se funda contra aberturas/objetos sin efecto "serrucho".
function featherMask(mask: Uint8Array, alpha: Float32Array, w: number, h: number, radius: number) {
  const tmp = new Float32Array(w * h);
  const win = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const x = k < 0 ? 0 : k >= w ? w - 1 : k;
      sum += mask[row + x];
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      const xin = x + radius + 1;
      const xout = x - radius;
      sum += mask[row + (xin >= w ? w - 1 : xin)] - mask[row + (xout < 0 ? 0 : xout)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) {
      const y = k < 0 ? 0 : k >= h ? h - 1 : k;
      sum += tmp[y * w + x];
    }
    for (let y = 0; y < h; y++) {
      const i = y * w + x;
      // Difuminado SÓLO hacia adentro.
      //
      // El desenfoque de la máscara es simétrico: ablanda el borde hacia los dos lados, así
      // que la pintura se pasaba ~2 px sobre lo que no es pared. Medido sobre una moldura
      // clara de 22 px: el 16,8% de la moldura terminaba con color encima, y eso es
      // exactamente lo que se ve mal en una foto de un ambiente, donde las molduras, los
      // marcos de puerta y los zócalos son finitos.
      //
      // Anulando el alfa fuera de la máscara, la rampa suave queda del lado de la pared:
      // el borde sigue sin escalonarse, pero la pintura no invade al vecino. Es lo que hace
      // la cinta de enmascarar: el corte va justo en el filo.
      alpha[i] = mask[i] ? sum / win : 0;
      const yin = y + radius + 1;
      const yout = y - radius;
      sum += tmp[(yin >= h ? h - 1 : yin) * w + x] - tmp[(yout < 0 ? 0 : yout) * w + x];
    }
  }
}

/**
 * Sin color elegido, la selección se ve azul a medias: que se note qué está marcado antes de
 * elegir con qué pintarlo.
 */
function seleccionVisible(destino: Uint8ClampedArray, origen: Uint8ClampedArray, alpha: Float32Array, ancho: number, rect?: Rect) {
  const alto = alpha.length / ancho;
  const x0 = rect ? Math.max(0, rect.x0) : 0;
  const y0 = rect ? Math.max(0, rect.y0) : 0;
  const x1 = rect ? Math.min(ancho, rect.x1) : ancho;
  const y1 = rect ? Math.min(alto, rect.y1) : alto;
  for (let y = y0; y < y1; y++) {
    for (let i = y * ancho + x0, fin = y * ancho + x1; i < fin; i++) {
      const p = i * 4;
      const a = alpha[i] * 0.5;
      const ia = 1 - a;
      destino[p] = a > 0 ? 20 * a + origen[p] * ia : origen[p];
      destino[p + 1] = a > 0 ? 120 * a + origen[p + 1] * ia : origen[p + 1];
      destino[p + 2] = a > 0 ? 230 * a + origen[p + 2] * ia : origen[p + 2];
      destino[p + 3] = origen[p + 3];
    }
  }
}
