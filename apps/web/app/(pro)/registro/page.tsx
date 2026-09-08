"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { MultiStepForm, type FormStep } from "@/components/features/multi-step-form";
import { cn } from "@/lib/utils";
import { postularmeComoPintor } from "@/app/(marketing)/actions";

const specialties = ["Residencial", "Comercial", "Industrial", "Esmaltes", "Texturas", "Exteriores", "Impermeabilización"];
const zones = ["CABA", "Zona Norte", "Zona Oeste", "Zona Sur"];

export default function RegistroPage() {
  const [name, setName] = useState("");
  const [years, setYears] = useState("");
  const [zone, setZone] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot anti-bot

  // La postulación se PERSISTE en `leads`. Antes el formulario decía "te avisamos cuando
  // tu perfil esté activo" sin guardar nada — y sin siquiera pedir un dato de contacto.
  const enviar = async () => {
    setError("");
    const fd = new FormData();
    fd.set("name", name);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("zone", zone);
    fd.set("experience", years);
    fd.set("specialties", specs.join(", "));
    fd.set("website", website);
    // `await` de verdad: MultiStepForm espera esta promesa para mantener su botón
    // bloqueado. Con startTransition el botón se re-habilitaba a los milisegundos
    // (React 18 no espera callbacks async) y un doble clic mandaba dos veces.
    setPending(true);
    try {
      const res = await postularmeComoPintor(fd);
      if (res?.error) setError(res.error);
      else setDone(true);
    } catch (e) {
      console.error("[form] falló el envío:", e);
      setError("No pudimos enviar el formulario. Revisá tu conexión y probá de nuevo.");
    } finally {
      setPending(false);
    }
  };

  const toggleSpec = (s: string) =>
    setSpecs((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const steps: FormStep[] = [
    {
      id: "datos",
      title: "Empecemos por vos",
      subtitle: "Tu nombre como aparecerá en tu perfil público.",
      isValid: name.trim() !== "" && Number(years) > 0,
      content: (
        <div className="space-y-8 max-w-md">
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">
              Nombre y apellido
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">
              Años de experiencia
            </span>
            <input
              type="number"
              min={0}
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className="w-32 bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
        </div>
      ),
    },
    {
      id: "zona",
      title: "¿En qué zona trabajás?",
      isValid: zone !== "",
      content: (
        <div className="flex flex-wrap gap-3">
          {zones.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZone(z)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                zone === z ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {z}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "especialidades",
      title: "¿Cuáles son tus especialidades?",
      subtitle: "Elegí hasta 4. Aparecerán en tu perfil.",
      isValid: specs.length > 0,
      content: (
        <div className="flex flex-wrap gap-3">
          {specialties.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSpec(s)}
              className={cn(
                "px-5 py-3 border font-body text-body-sm transition-colors duration-300",
                specs.includes(s) ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "contacto",
      title: "¿Cómo te contactamos?",
      subtitle: "Es por acá que te avisamos cuando activemos tu perfil.",
      isValid: /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 6,
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
          <label className="block">
            <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Teléfono</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
            />
          </label>
        </div>
      ),
    },
  ];

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-3xl">
          {done ? (
            <div className="text-center py-section-sm">
              <div className="w-16 h-16 rounded-full bg-ink text-bone mx-auto mb-8 flex items-center justify-center text-display-md">
                ✓
              </div>
              <h1 className="font-display text-display-lg mb-4">¡Bienvenido, {name.split(" ")[0]}!</h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto">
                Recibimos tu postulación. Vamos a revisar tus datos y te escribimos a <strong className="text-ink">{email}</strong> para activar tu perfil.
              </p>
            </div>
          ) : (
            <>
              <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Sumate como Pro</p>
              <h1 className="font-display text-display-xl mb-12">Tu perfil profesional en 4 pasos.</h1>
              <MultiStepForm
                steps={steps}
                onComplete={enviar}
                submitLabel={pending ? "Enviando…" : "Enviar postulación"}
              />

              {/* Honeypot: fuera de la vista y del foco. */}
              <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
                <label>
                  No completar
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              {error && (
                <p role="alert" className="mt-6 font-body text-body-sm text-[#C41E3A] border-l-2 border-[#C41E3A] pl-3">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
