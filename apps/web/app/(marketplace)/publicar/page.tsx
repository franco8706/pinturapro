import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicarForm } from "./publicar-form";


// Panel privado: título propio (antes usaba el genérico de la home) y fuera de
// buscadores, como defensa en profundidad además del gate de sesión.
export const metadata: Metadata = {
  title: "Publicar un trabajo",
  robots: { index: false, follow: false },
};

/**
 * Gate de sesión para publicar un pedido.
 *
 * Antes la página era enteramente cliente y el único chequeo vivía al final, dentro de la
 * Server Action: la persona completaba los tres pasos, apretaba "Publicar" y recibía un
 * error de texto sin link a /ingresar — perdiendo todo lo cargado, porque el estado del
 * formulario vive en useState. Cortamos antes, y `?next=` la devuelve acá al entrar.
 */
export default async function PublicarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar?next=/publicar");

  return <PublicarForm />;
}
