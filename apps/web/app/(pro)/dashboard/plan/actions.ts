"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnProfile } from "@/lib/queries";
import { avisarTransferencia, datosDeTransferencia } from "@/lib/pagos/transferencia";
import { puedeCotizar, fechaAR } from "@pinturapro/dominio";

/**
 * "Ya transferí": el pintor avisa que hizo la transferencia del mes. Queda un cobro pendiente por
 * el monto del día (vale 3 días) hasta que el dueño la confirme con el extracto del banco.
 *
 * Es un endpoint como cualquier Server Action: no recibe nada del navegador (ni monto ni código:
 * los pone el servidor), y verifica que quien llama sea un pintor con sesión.
 */
export async function yaTransferi(): Promise<{ error?: string; ok?: boolean; mensaje?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Tenés que iniciar sesión." };
  let perfil = null;
  try {
    perfil = await getOwnProfile(user.id);
  } catch {
    perfil = null;
  }
  if (!perfil || !puedeCotizar(perfil.type)) return { error: "La suscripción es para pintores y empresas." };
  if (!datosDeTransferencia() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "La transferencia todavía no está disponible." };
  }
  const { data: ajustes } = await createAdminClient().from("ajustes_de_cobro").select("medios_activos").maybeSingle();
  const medios = (ajustes as { medios_activos: string[] } | null)?.medios_activos ?? [];
  if (!medios.includes("transferencia")) return { error: "La transferencia está pausada por el momento." };

  const cobro = await avisarTransferencia(user.id);
  if ("error" in cobro) return { error: cobro.error };
  revalidatePath("/dashboard/plan");
  return {
    ok: true,
    mensaje: `Listo: esperamos $${cobro.montoArs.toLocaleString("es-AR")} con el código ${cobro.codigo}. Lo confirmamos cuando llega a la cuenta (hasta un día hábil). Este monto vale hasta el ${fechaAR(cobro.venceEn)}.`,
  };
}
