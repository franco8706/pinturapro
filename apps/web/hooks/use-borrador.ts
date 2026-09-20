"use client";

import { useEffect, useRef } from "react";

/**
 * Guarda lo que la persona va escribiendo en un formulario largo, para que una recarga no
 * se lo lleve puesto.
 *
 * Por qué hace falta, medido: en `/cotizar` se completa el tipo de trabajo y la superficie,
 * se recarga la página —sin aviso de ninguna clase— y vuelve al paso 1 en blanco. Ese es el
 * formulario con el que la empresa consigue clientes: cada recarga accidental, en un celular
 * con mala señal, es un presupuesto que nunca llega. Lo mismo en `/publicar`.
 *
 * `sessionStorage` y no `localStorage` a propósito: el borrador dura lo que dura la pestaña.
 * Si alguien completa un pedido en una computadora compartida y cierra, no queda ahí para el
 * que se siente después.
 *
 * Todo va envuelto en try/catch: en modo incógnito, con las cookies bloqueadas o con el disco
 * lleno, `sessionStorage` tira excepción. Perder el borrador es molesto; romper el formulario
 * entero por intentar guardarlo sería peor.
 */
export function useBorrador<T extends Record<string, unknown>>(
  clave: string,
  valor: T,
  restaurar: (v: Partial<T>) => void,
  { activo = true }: { activo?: boolean } = {},
) {
  const yaRestauró = useRef(false);

  // Restaurar una sola vez, al montar.
  useEffect(() => {
    if (yaRestauró.current) return;
    yaRestauró.current = true;
    try {
      const crudo = sessionStorage.getItem(clave);
      if (!crudo) return;
      const datos = JSON.parse(crudo) as Partial<T>;
      if (datos && typeof datos === "object") restaurar(datos);
    } catch {
      // borrador ilegible: se sigue con el formulario vacío, que es el comportamiento viejo
    }
    // `restaurar` se redefine en cada render del componente padre; incluirlo en las
    // dependencias haría que este efecto corra siempre y pise lo que la persona escribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  // Guardar en cada cambio.
  useEffect(() => {
    if (!activo || !yaRestauró.current) return;
    try {
      sessionStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      // sin espacio o sin permiso: no se guarda, y no pasa nada más
    }
  }, [clave, valor, activo]);

  /** Se llama al enviar con éxito: el borrador ya no tiene sentido. */
  return () => {
    try {
      sessionStorage.removeItem(clave);
    } catch {
      /* nada que hacer */
    }
  };
}
