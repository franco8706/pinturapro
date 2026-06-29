"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Resource, ResourceKind } from "@/lib/queries";

const TABS: { id: ResourceKind | "all"; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "guide", label: "Guías para empezar" },
  { id: "video", label: "Videos instructivos" },
  { id: "course", label: "Cursos" },
];

const KIND_LABEL: Record<ResourceKind, string> = {
  guide: "Guía",
  video: "Video",
  course: "Curso",
  advice: "Asesoramiento",
};

export function AprenderClient({ resources }: { resources: Resource[] }) {
  const [tab, setTab] = useState<ResourceKind | "all">("all");
  const list = tab === "all" ? resources : resources.filter((r) => r.kind === tab);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 border font-body text-body-sm transition-colors",
              tab === t.id ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="font-body text-body-md text-concrete">Todavía no hay contenido en esta sección.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((r) => (
            <article key={r.id} className="border border-concrete/15 p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{KIND_LABEL[r.kind]}</span>
                {r.level && <span className="font-mono text-mono-sm text-concrete">· {r.level}</span>}
                {r.duration && <span className="font-mono text-mono-sm text-concrete">· {r.duration}</span>}
              </div>
              <h3 className="font-display text-display-md leading-tight mb-2">{r.title}</h3>
              {r.summary && <p className="font-body text-body-sm text-concrete">{r.summary}</p>}
              {r.body && <p className="font-body text-body-sm text-concrete/80 mt-3">{r.body}</p>}
              <div className="mt-auto pt-5">
                {r.kind === "video" && r.mediaUrl ? (
                  <a
                    href={r.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors"
                  >
                    ▶ Ver video
                  </a>
                ) : r.kind === "course" ? (
                  <span className="inline-block px-4 py-2 border border-ink font-body text-body-sm">Próximamente</span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
