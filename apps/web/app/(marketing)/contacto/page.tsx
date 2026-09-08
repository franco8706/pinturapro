"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";
import { enviarConsulta } from "../actions";

export default function ContactoPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  // Campo trampa: invisible para una persona, los bots lo completan.
  const [website, setWebsite] = useState("");

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Contacto</p>
            <h1 className="font-display text-display-xl mb-8">Hablemos de tu obra.</h1>
            <p className="font-body text-body-lg text-concrete max-w-md mb-12">
              ¿Tenés un proyecto en mente o una consulta puntual? Escribinos y te respondemos dentro del día.
            </p>
            <dl className="space-y-6">
              {[
                { label: "Email", value: "hola@pinturapro.ar" },
                { label: "WhatsApp", value: "+54 9 11 5555-0123" },
                { label: "Taller", value: "Barracas, CABA — con cita previa" },
                { label: "Horario", value: "Lun a Vie, 8 a 18hs" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-1">{item.label}</dt>
                  <dd className="font-body text-body-lg text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            {sent ? (
              <div className="h-full flex flex-col items-center justify-center text-center border border-concrete/15 p-12">
                <div className="w-14 h-14 rounded-full bg-ink text-bone mb-6 flex items-center justify-center text-display-md">
                  ✓
                </div>
                <h2 className="font-display text-display-md mb-2">Mensaje enviado</h2>
                <p className="font-body text-body-md text-concrete">Te respondemos a la brevedad. ¡Gracias!</p>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  const fd = new FormData();
                  fd.set("name", form.name);
                  fd.set("email", form.email);
                  fd.set("message", form.message);
                  fd.set("website", website);
                  void (async () => {
                    setPending(true);
                    try {
                      const res = await enviarConsulta(fd);
                      if (res?.error) setError(res.error);
                      else setSent(true);
                    } catch (err) {
                      console.error("[contacto] falló el envío:", err);
                      setError("No pudimos enviar el mensaje. Revisá tu conexión y probá de nuevo.");
                    } finally {
                      setPending(false);
                    }
                  })();
                }}
                className="space-y-8 relative"
              >
                <label className="block">
                  <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Nombre</span>
                  <input
                    required
                    value={form.name}
                    onChange={update("name")}
                    className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Email</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={update("email")}
                    className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
                  />
                </label>
                <label className="block">
                  <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">Mensaje</span>
                  <textarea
                    required
                    rows={5}
                    value={form.message}
                    onChange={update("message")}
                    className="w-full bg-transparent border-2 border-concrete/30 p-4 font-body text-body-md focus:outline-none focus:border-ink transition-colors resize-none"
                  />
                </label>
                {/* Honeypot: fuera de la vista y del foco, sin anunciarse a lectores de pantalla. */}
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
                  <p role="alert" className="font-body text-body-sm text-[#C41E3A] border-l-2 border-[#C41E3A] pl-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="px-7 py-4 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pending ? "Enviando…" : "Enviar mensaje →"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
