"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Muestra "Ingresar" o "Salir" en el navbar según la sesión.
 * Si Supabase todavía no está configurado, no renderiza nada (no rompe el navbar).
 */
export function AuthNav({ className }: { className?: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [known, setKnown] = useState(false);

  useEffect(() => {
    if (!READY) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setKnown(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!READY || !known) return null;

  if (email) {
    return (
      <div className={cn("flex items-center gap-4 sm:gap-6", className)}>
        <Link
          href="/mi-panel"
          className="font-body text-body-sm text-ink hover:text-concrete transition-colors duration-300"
        >
          Mi panel
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="font-body text-body-sm text-concrete hover:text-ink transition-colors duration-300"
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
      className={cn("font-body text-body-sm text-concrete hover:text-ink transition-colors duration-300", className)}
    >
      Ingresar
    </Link>
  );
}
