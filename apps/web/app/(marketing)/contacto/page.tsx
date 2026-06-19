"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";

export default function ContactoPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

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
                onSubmit={(e) => {
                  e.preventDefault();
                  // INTEGRACIÓN: enviar mensaje a Supabase / email transaccional
                  setSent(true);
                }}
                className="space-y-8"
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
                <button type="submit" className="px-7 py-4 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors">
                  Enviar mensaje →
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
