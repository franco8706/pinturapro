"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Ejecuta una Server Action con estado de envío REAL y guarda contra doble disparo.
 *
 * Por qué no `useTransition`: en React 18 (el que usa este proyecto, 18.3.1)
 * `startTransition` agenda `setPending(false)` ANTES de invocar el callback y nunca espera
 * la promesa de una función `async`. O sea que `isPending` vuelve a false a los pocos
 * milisegundos, mientras la acción sigue viajando: el botón se re-habilita solo, la persona
 * vuelve a hacer clic y dispara la acción de nuevo. (En React 19 sí se espera la promesa.)
 *
 * Además centraliza dos cosas que faltaban en todos los formularios:
 *  - `try/catch`: si la acción RECHAZA (red caída, excepción en el servidor) el estado de
 *    envío se apagaba nunca y la UI quedaba clavada en "Guardando…" para siempre.
 *  - Re-lanzar `NEXT_REDIRECT`: varias acciones terminan en `redirect()`, que Next señaliza
 *    con una excepción. Atraparla a ciegas rompería la navegación de éxito.
 */
export function useAccion<A extends unknown[]>(
  accion: (...args: A) => Promise<{ error?: string } | void>,
  opciones?: { onOk?: () => void },
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const enVuelo = useRef(false);

  const ejecutar = useCallback(
    async (...args: A) => {
      if (enVuelo.current) return; // guarda contra el doble clic
      enVuelo.current = true;
      setPending(true);
      setError("");
      try {
        const res = await accion(...args);
        if (res && "error" in res && res.error) {
          setError(res.error);
          setPending(false);
        } else {
          opciones?.onOk?.();
          // En el camino feliz NO apagamos `pending`: la acción revalida y el componente
          // se desmonta o se vuelve a renderizar. Apagarlo dejaría el botón activo un
          // instante, justo el hueco por el que entra el segundo clic.
        }
      } catch (e) {
        // `redirect()` de Next viaja como excepción: dejarla pasar.
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
        console.error("[accion] falló:", e);
        setError("No pudimos completar la acción. Revisá tu conexión y probá de nuevo.");
        setPending(false);
      } finally {
        enVuelo.current = false;
      }
    },
    [accion, opciones],
  );

  return { ejecutar, pending, error, setError };
}
