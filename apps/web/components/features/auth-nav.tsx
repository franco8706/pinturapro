"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Muestra "Ingresar" o "Mi panel · Salir" en el navbar según haya sesión.
 * Si Supabase todavía no está configurado, no renderiza nada (no rompe el navbar).
 *
 * Le pregunta al servidor (`/api/sesion`) en vez de abrir el cliente de Supabase acá. Antes lo
 * abría, y como este componente está en la barra de TODAS las páginas, cada visitante bajaba
 * el SDK entero —52 KB comprimidos, medido en producción por el agente `rendimiento`— para
 * leer un sí o un no, incluso en /terminos y /privacidad, que no usan sesión para nada.
 *
 * Se vuelve a preguntar en cada cambio de página: es lo que actualiza la barra después de
 * ingresar (el ingreso navega a /mi-panel). Salir es un formulario que recarga la página
 * entera, así que ahí la pregunta sale sola.
 */
export function AuthNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    if (!READY) return;
    let vigente = true;
    fetch("/api/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { sesion: false }))
      .then((d: { sesion?: boolean }) => vigente && setSesion(!!d.sesion))
      .catch(() => vigente && setSesion(false));
    return () => {
      vigente = false;
    };
  }, [pathname]);

  if (!READY || sesion === null) return null;

  if (sesion) {
    return (
      <div className={cn("flex items-center gap-4 sm:gap-6", className)}>
        <Link
          href="/mi-panel"
          className="inline-block py-1 font-body text-body-sm text-ink hover:text-concrete transition-colors duration-300"
        >
          Mi panel
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="inline-block py-1 font-body text-body-sm text-concrete hover:text-ink transition-colors duration-300"
          >
            Salir
          </button>
        </form>
      </div>
    );
  }

  return (
    <Link
      href="/ingresar"
      className={cn("inline-block py-1 font-body text-body-sm text-concrete hover:text-ink transition-colors duration-300", className)}
    >
      Ingresar
    </Link>
  );
}
