"use client";

import { useState } from "react";
import { Navbar } from "@/components/features/navbar";
import { Footer } from "@/components/features/footer";

const COMMISSION = 0.08;

export default function CheckoutPage() {
  const [paid, setPaid] = useState(false);
  const amount = 320000;
  const commission = Math.round(amount * COMMISSION);
  const total = amount + commission;

  const fmt = (n: number) => `$${n.toLocaleString("es-AR")}`;

  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric max-w-5xl">
          {paid ? (
            <div className="text-center py-section-sm">
              <div className="w-16 h-16 rounded-full bg-ink text-bone mx-auto mb-8 flex items-center justify-center text-display-md">
                ✓
              </div>
              <h1 className="font-display text-display-lg mb-4">¡Pago confirmado!</h1>
              <p className="font-body text-body-lg text-concrete max-w-md mx-auto">
                Reservamos el trabajo con Martín Rojas. El dinero queda retenido en garantía y se libera cuando
                confirmes que la obra está terminada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
              {/* Resumen */}
              <div className="lg:col-span-5 lg:order-2">
                <div className="bg-mist border border-concrete/15 p-8 sticky top-28">
                  <h2 className="font-display text-display-md mb-6">Resumen</h2>
                  <div className="space-y-4 font-body text-body-md">
                    <Row label="Pintura interior · 2 amb." value={fmt(amount)} />
                    <Row label="Pintor" value="Martín Rojas" muted />
                    <Row label={`Comisión plataforma (${COMMISSION * 100}%)`} value={fmt(commission)} muted />
                    <div className="h-px bg-concrete/20 my-2" />
                    <Row label="Total" value={fmt(total)} bold />
                  </div>
                  <p className="font-body text-body-sm text-concrete mt-6 leading-relaxed">
                    El pago se retiene en garantía (escrow) y se libera al pintor cuando confirmás la entrega.
                  </p>
                </div>
              </div>

              {/* Form de pago */}
              <div className="lg:col-span-7 lg:order-1">
                <p className="font-mono text-mono-sm text-concrete uppercase tracking-widest mb-4">Checkout seguro</p>
                <h1 className="font-display text-display-xl mb-10">Confirmá tu pago.</h1>
                {/* INTEGRACIÓN: tokenización y pago real con Stripe / Mercado Pago */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPaid(true);
                  }}
                  className="space-y-8 max-w-lg"
                >
                  <Field label="Nombre en la tarjeta" placeholder="Como figura en la tarjeta" />
                  <Field label="Número de tarjeta" placeholder="4242 4242 4242 4242" />
                  <div className="grid grid-cols-2 gap-6">
                    <Field label="Vencimiento" placeholder="MM/AA" />
                    <Field label="CVC" placeholder="123" />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-7 py-4 bg-ink text-bone font-body text-body-md hover:bg-ink/90 transition-colors"
                  >
                    Pagar {fmt(total)}
                  </button>
                  <p className="font-mono text-mono-sm text-concrete text-center">🔒 Pago cifrado de extremo a extremo</p>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={muted ? "text-concrete" : "text-ink"}>{label}</span>
      <span className={bold ? "font-display text-display-md" : muted ? "text-concrete" : "text-ink"}>{value}</span>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="font-mono text-mono-sm text-concrete uppercase tracking-widest block mb-2">{label}</span>
      <input
        required
        placeholder={placeholder}
        className="w-full bg-transparent border-b-2 border-concrete/30 py-2 font-body text-body-lg focus:outline-none focus:border-ink transition-colors"
      />
    </label>
  );
}
