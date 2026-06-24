"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProfileType } from "@/lib/supabase/types";

const ROLES: { value: ProfileType; title: string; desc: string }[] = [
  { value: "client", title: "Soy cliente", desc: "Quiero pintar mi casa u obra y contratar profesionales." },
  { value: "painter", title: "Soy pintor", desc: "Ofrezco mis servicios y quiero mostrar mi portfolio." },
  { value: "company", title: "Somos una empresa", desc: "Constructora o estudio que gestiona obras y equipos." },
];

/** Tarjetas para elegir el rol en el primer ingreso; guarda type + onboarded y rutea al panel. */
export function RolePicker({ userId }: { userId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ProfileType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!selected) return;
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ type: selected, onboarded: true } as never)
      .eq("id", userId);
    if (error) {
      setError("No pudimos guardar tu elección: " + error.message);
      setLoading(false);
      return;
    }
    // El cliente va directo a su panel; pintor/empresa pasan a completar su perfil público.
    router.push(selected === "client" ? "/mi-panel" : "/dashboard/perfil");
    router.refresh();
  }

  return (
    <div>
      <div className="space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelected(r.value)}
            className={cn(
              "w-full text-left p-5 border transition-colors",
              selected === r.value ? "border-ink bg-bone" : "border-concrete/30 hover:border-ink bg-bone/50",
            )}
          >
            <span className="block font-display text-body-lg text-ink">{r.title}</span>
            <span className="block font-body text-body-sm text-concrete mt-1">{r.desc}</span>
          </button>
        ))}
      </div>

      {error && <p className="mt-4 font-body text-body-sm text-[#C41E3A]">{error}</p>}

      <button
        type="button"
        onClick={confirm}
        disabled={!selected || loading}
        className="mt-6 w-full py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-40"
      >
        {loading ? "Creando tu espacio…" : "Continuar"}
      </button>
    </div>
  );
}
