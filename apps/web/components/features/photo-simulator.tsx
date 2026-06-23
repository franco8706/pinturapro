"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "empty" | "ready" | "segmenting" | "error";

interface PhotoSimulatorProps {
  color: string | null;
}

const MAX_DIM = 1024;

/**
 * Simulador de color sobre foto — arquitectura cliente-servidor.
 *
 * La segmentación pesada (SAM) corre en el SERVIDOR (vía `/api/segment`), no en
 * el navegador: el cliente queda fluido y la precisión la da un modelo grande.
 *
 * Flujo: subir foto → clic en la pared → se envía la foto al backend (SAM) → vuelven
 * TODAS las regiones de la imagen → el cliente elige la que contiene el punto del clic
 * (la pared exacta que tocaste) → se aplica con feathering + color transfer en HSL
 * (preserva textura, luces y sombras del revoque).
 *
 * El pincel manual queda como herramienta de ajuste / fallback si no hay backend.
 */
export function PhotoSimulator({ color }: PhotoSimulatorProps) {
  const viewRef = useRef<HTMLCanvasElement>(null);
  const baseImageData = useRef<ImageData | null>(null);
  const compositeRef = useRef<ImageData | null>(null);
  const lumaRef = useRef<Float32Array | null>(null); // luminancia HSL por píxel (cache)
  const maskRef = useRef<Uint8Array | null>(null); // máscara binaria
  const alphaRef = useRef<Float32Array | null>(null); // máscara con bordes difuminados (0..1)
  const avgLumaRef = useRef(0.5); // luminancia promedio de la pared seleccionada
  const imageUrlRef = useRef<string>(""); // dataURL de la foto (para enviar al server)
  const dims = useRef({ w: 0, h: 0 });
  const segmentingRef = useRef(false); // guard anti clics múltiples
  // Banco de regiones de SAM, cacheado tras UNA sola llamada al servidor. Cada clic elige
  // de acá (instantáneo, sin red). `small` = máscara binaria a baja resolución para el
  // hit-test/área; `url` = data URL para redibujar la ganadora a resolución plena.
  const maskBankRef = useRef<{ small: Uint8Array; sw: number; sh: number; area: number; url: string }[]>([]);
  const segmentedRef = useRef(false); // ¿ya segmentamos esta foto?
  const pendingAnalyzeRef = useRef(false); // disparar análisis tras montar la imagen

  const [status, setStatus] = useState<Status>("empty");
  const [errorMsg, setErrorMsg] = useState("");
  const [brush, setBrush] = useState<"off" | "add" | "erase">("off");
  const [brushSize, setBrushSize] = useState(36);
  const [strength, setStrength] = useState(0.9); // intensidad del color (0..1)
  const [hasSelection, setHasSelection] = useState(false);
  const [zoom, setZoom] = useState(1);
  const drawing = useRef(false);

  // ---- Cargar imagen ----
  const onFile = useCallback((file: File) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
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
      avgLumaRef.current = 0.5;
      imageUrlRef.current = off.toDataURL("image/jpeg", 0.85); // para enviar al backend
      dims.current = { w, h };

      // cache de luminancia (HSL L) por píxel, una sola vez
      const luma = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const p = i * 4;
        luma[i] = (Math.max(base.data[p], base.data[p + 1], base.data[p + 2]) + Math.min(base.data[p], base.data[p + 1], base.data[p + 2])) / 2 / 255;
      }
      lumaRef.current = luma;

      // foto nueva → invalidar segmentación previa y disparar análisis (una sola vez)
      maskBankRef.current = [];
      segmentedRef.current = false;
      pendingAnalyzeRef.current = true;

      setHasSelection(false);
      setErrorMsg("");
      URL.revokeObjectURL(img.src);
      setStatus("ready");
    };
    img.onerror = () => {
      setErrorMsg("No pudimos cargar la imagen.");
      setStatus("error");
    };
    img.src = URL.createObjectURL(file);
  }, []);

  // ---- Datos derivados de la máscara: luminancia promedio (regla 1) + feather (regla 3) ----
  const recomputeMaskDerived = useCallback((feather: boolean) => {
    const mask = maskRef.current;
    const luma = lumaRef.current;
    const alpha = alphaRef.current;
    const { w, h } = dims.current;
    if (!mask || !luma || !alpha) return;

    let sum = 0;
    let count = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) {
        sum += luma[i];
        count++;
      }
    }
    avgLumaRef.current = count > 0 ? sum / count : 0.5;

    if (feather && count > 0) {
      featherMask(mask, alpha, w, h, 2);
    } else {
      for (let i = 0; i < mask.length; i++) alpha[i] = mask[i] ? 1 : 0;
    }
  }, []);

  // ---- Recompositar (color transfer fotorrealista) ----
  const repaint = useCallback(() => {
    const base = baseImageData.current;
    const canvas = viewRef.current;
    const composite = compositeRef.current;
    const luma = lumaRef.current;
    const alpha = alphaRef.current;
    if (!base || !canvas || !composite || !luma || !alpha) return;
    const src = base.data;
    const data = composite.data;
    data.set(src);

    if (color) {
      const [tr, tg, tb] = hexToRgb(color);
      const [th, ts, tl] = rgbToHsl(tr, tg, tb);
      const avg = avgLumaRef.current;
      // CONTRAST: cuánta textura/sombra del muro se conserva (1 = copia 1:1, irreal).
      // BAND: tope de cuánto puede aclararse/oscurecerse respecto al color elegido →
      // evita parches lavados (blancos) o ennegrecidos en zonas de luz/sombra fuerte.
      const CONTRAST = 0.6;
      const BAND = 0.34;
      for (let i = 0; i < alpha.length; i++) {
        const a0 = alpha[i];
        if (a0 <= 0) continue;
        const p = i * 4;
        const ol = luma[i];
        // Sombreado del muro, comprimido y acotado alrededor de la L del color.
        let shade = (ol - avg) * CONTRAST;
        if (shade > BAND) shade = BAND;
        else if (shade < -BAND) shade = -BAND;
        let nl = tl + shade;
        if (nl < 0.04) nl = 0.04;
        else if (nl > 0.97) nl = 0.97;
        // Saturación casi plena (mantiene el tono); sólo baja un poco si el RESULTADO
        // es muy claro/oscuro (donde el ojo no distingue color igual).
        const rd = Math.abs(nl - 0.5) * 2;
        const ns = ts * (1 - rd * rd * 0.35);
        const [nr, ng, nb] = hslToRgb(th, ns, nl);
        const a = a0 * strength; // intensidad regulable
        const ia = 1 - a;
        data[p] = nr * a + src[p] * ia;
        data[p + 1] = ng * a + src[p + 1] * ia;
        data[p + 2] = nb * a + src[p + 2] * ia;
      }
    } else {
      for (let i = 0; i < alpha.length; i++) {
        const a = alpha[i] * 0.5;
        if (a <= 0) continue;
        const p = i * 4;
        const ia = 1 - a;
        data[p] = 20 * a + src[p] * ia;
        data[p + 1] = 120 * a + src[p + 1] * ia;
        data[p + 2] = 230 * a + src[p + 2] * ia;
      }
    }
    canvas.getContext("2d")!.putImageData(composite, 0, 0);
  }, [color, strength]);

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
  }, [color, status, repaint]);

  // ---- Análisis SAM: UNA sola llamada al servidor por foto; cacheamos todas las regiones. ----
  const analyzeImage = useCallback(async (): Promise<boolean> => {
    if (segmentingRef.current) return false;
    const { w, h } = dims.current;
    if (!w || !h) return false;
    segmentingRef.current = true;
    setStatus("segmenting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageUrlRef.current, point: { x: 0.5, y: 0.5 }, width: w, height: h }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        let msg = "No se pudo analizar la foto.";
        if (data?.error === "backend_not_configured") msg = "El servidor de IA todavía no está configurado. Por ahora marcá la pared con el 🖌 Pincel.";
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
      console.error(e);
      setErrorMsg("No se pudo contactar al servidor de segmentación. Usá el 🖌 Pincel.");
      return false;
    } finally {
      segmentingRef.current = false;
      setStatus("ready");
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
      const fc = document.createElement("canvas");
      fc.width = w;
      fc.height = h;
      const fctx = fc.getContext("2d", { willReadFrequently: true })!;
      fctx.drawImage(img, 0, 0, w, h);
      const fd = fctx.getImageData(0, 0, w, h).data;
      for (let i = 0; i < w * h; i++) if (isSet(fd, i * 4)) out[i] = 1;
      recomputeMaskDerived(true);
      repaint();
      return true;
    },
    [recomputeMaskDerived, repaint],
  );

  // Dispara el análisis (una vez) cuando la foto ya está montada.
  useEffect(() => {
    if (status === "ready" && pendingAnalyzeRef.current && !segmentedRef.current) {
      pendingAnalyzeRef.current = false;
      void analyzeImage();
    }
  }, [status, analyzeImage]);

  // ---- Clic en el canvas → suma la región del clic (analiza primero si hace falta) ----
  const onCanvasClick = async (e: React.MouseEvent) => {
    if (brush !== "off" || status !== "ready") return;
    const canvas = viewRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (!segmentedRef.current) {
      const ok = await analyzeImage();
      if (!ok) return;
    }
    const picked = await pickAt(nx, ny);
    if (picked) setHasSelection(true);
    else setErrorMsg("No detectamos una superficie en ese punto. Hacé clic más al centro de la pared, o usá el 🖌 Pincel.");
  };

  // ---- Pincel (ajuste manual) ----
  const paintAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = viewRef.current;
      const mask = maskRef.current;
      if (!canvas || !mask || brush === "off") return;
      const rect = canvas.getBoundingClientRect();
      const { w, h } = dims.current;
      const x = Math.round(((clientX - rect.left) / rect.width) * w);
      const y = Math.round(((clientY - rect.top) / rect.height) * h);
      const radius = Math.round((brushSize / rect.width) * w);
      const val = brush === "add" ? 1 : 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= w || py >= h) continue;
          mask[py * w + px] = val;
        }
      }
      recomputeMaskDerived(false);
      repaint();
      setHasSelection(true);
    },
    [brush, brushSize, repaint, recomputeMaskDerived],
  );

  const clearSelection = () => {
    if (maskRef.current) maskRef.current.fill(0);
    recomputeMaskDerived(true);
    repaint();
    setHasSelection(false);
  };

  const reset = () => {
    baseImageData.current = null;
    maskRef.current = null;
    compositeRef.current = null;
    lumaRef.current = null;
    alphaRef.current = null;
    imageUrlRef.current = "";
    maskBankRef.current = [];
    segmentedRef.current = false;
    pendingAnalyzeRef.current = false;
    setHasSelection(false);
    setZoom(1);
    setStatus("empty");
    setErrorMsg("");
    setBrush("off");
  };

  const segmenting = status === "segmenting";

  return (
    <div>
      {status === "empty" ? (
        <label className="flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed border-concrete/30 bg-mist cursor-pointer hover:border-ink transition-colors duration-300">
          <span className="font-display text-display-md text-concrete mb-2">＋</span>
          <span className="font-body text-body-md text-ink">Subí una foto de tu ambiente</span>
          <span className="font-body text-body-sm text-concrete mt-1">JPG o PNG · pared, frente o fachada</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      ) : (
        <div className="space-y-4">
          {/* Lienzo (con zoom) */}
          <div className="relative overflow-auto bg-mist border border-concrete/15" style={{ maxHeight: "70vh" }}>
            <div className="relative" style={{ width: `${zoom * 100}%` }}>
              <canvas
                ref={viewRef}
                onClick={onCanvasClick}
                className={cn(
                  "block w-full h-auto touch-none select-none",
                  segmenting ? "cursor-wait" : brush !== "off" ? "cursor-crosshair" : "cursor-pointer",
                )}
                onPointerDown={(e) => {
                  if (brush === "off") return;
                  drawing.current = true;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  paintAt(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => drawing.current && paintAt(e.clientX, e.clientY)}
                onPointerUp={() => {
                  if (!drawing.current) return;
                  drawing.current = false;
                  recomputeMaskDerived(true);
                  repaint();
                }}
              />

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
                onClick={() => setBrush((b) => (b === "add" ? "off" : "add"))}
                disabled={segmenting}
                className={cn("px-3 py-2 font-body text-body-sm transition-colors disabled:opacity-40", brush === "add" ? "bg-ink text-bone" : "hover:bg-mist")}
              >
                🖌 Pincel
              </button>
              <button
                onClick={() => setBrush((b) => (b === "erase" ? "off" : "erase"))}
                disabled={segmenting}
                className={cn("px-3 py-2 font-body text-body-sm border-l border-concrete/30 transition-colors disabled:opacity-40", brush === "erase" ? "bg-ink text-bone" : "hover:bg-mist")}
              >
                ⌫ Borrar
              </button>
            </div>

            {brush !== "off" && (
              <label className="flex items-center gap-2 font-mono text-mono-sm text-concrete">
                Tamaño
                <input type="range" min={10} max={120} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
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

            {hasSelection && (
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

            {hasSelection && (
              <button onClick={clearSelection} disabled={segmenting} className="font-body text-body-sm text-concrete hover:text-ink transition-colors disabled:opacity-40">
                Limpiar selección
              </button>
            )}

            <button onClick={reset} className="ml-auto font-body text-body-sm text-concrete hover:text-ink transition-colors">
              Cambiar foto
            </button>
          </div>

          {errorMsg ? (
            <p className="font-body text-body-sm text-[#C41E3A]">{errorMsg}</p>
          ) : status === "ready" && brush === "off" ? (
            <p className="font-body text-body-sm text-concrete">
              <strong className="text-ink">Tocá la pared</strong> que querés pintar. Si quedó en partes (bloques, luces),
              <strong className="text-ink"> sumá clics</strong> sobre el resto: se van acumulando al instante. Elegí un color
              a la derecha y afiná los bordes con el 🖌 Pincel.
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
      alpha[y * w + x] = sum / win;
      const yin = y + radius + 1;
      const yout = y - radius;
      sum += tmp[(yin >= h ? h - 1 : yin) * w + x] - tmp[(yout < 0 ? 0 : yout) * w + x];
    }
  }
}

// ---------- helpers de color ----------
function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const dd = max - min;
    s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
    if (max === r) h = (g - b) / dd + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / dd + 2;
    else h = (r - g) / dd + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number;
  let g: number;
  let b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
