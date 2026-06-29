"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const READY = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

interface Faq {
  id: string;
  question: string;
  answer: string;
}

/**
 * Acordeón de "preguntas básicas antes de un presupuesto". Lee de la tabla faqs
 * (pública). Si no hay datos o Supabase no está configurado, no renderiza nada.
 */
export function FaqAccordion({ title = "Antes de pedir tu presupuesto" }: { title?: string }) {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!READY) return;
    const supabase = createClient();
    supabase
      .from("faqs")
      .select("id, question, answer")
      .eq("published", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setFaqs(data as unknown as Faq[]);
      });
  }, []);

  if (faqs.length === 0) return null;

  return (
    <div className="border-t border-concrete/15 pt-10">
      <h2 className="font-display text-display-md mb-2">{title}</h2>
      <p className="font-body text-body-md text-concrete mb-6 max-w-xl">
        Tener estas respuestas a mano hace que tu cotización sea más rápida y precisa.
      </p>
      <div className="divide-y divide-concrete/15 border-y border-concrete/15">
        {faqs.map((f) => {
          const isOpen = open === f.id;
          return (
            <div key={f.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="w-full flex items-center justify-between gap-4 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-body text-body-lg text-ink">{f.question}</span>
                <span className="font-mono text-body-lg text-concrete shrink-0">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && <p className="pb-4 font-body text-body-md text-concrete max-w-2xl">{f.answer}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
