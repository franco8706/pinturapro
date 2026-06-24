"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createObra, updateObra } from "../actions";

const PALETTE = ["#C41E3A", "#1E3A8A", "#2D5A3D", "#B45309", "#3F3F46", "#0F766E"];
const CATEGORIES = ["Residencial", "Comercial", "Industrial"];

export interface ObraInitial {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  accent: string;
  cover: string;
}

export function NuevaObraForm({ initial }: { initial?: ObraInitial }) {
  const editing = !!initial;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accent, setAccent] = useState(initial?.accent ?? PALETTE[4]);
  const [cover, setCover] = useState(initial?.cover ?? "");
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [resizing, setResizing] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResizing(true);
    try {
      const { blob, url } = await resizeImage(file);
      setFileBlob(blob);
      setFilePreview(url);
    } catch {
      setError("No pudimos procesar esa imagen.");
    } finally {
      setResizing(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    fd.set("accent_color", accent);
    if (fileBlob) fd.set("cover_file", fileBlob, "cover.jpg");
    let res: { error?: string };
    if (editing) {
      fd.set("id", initial!.id);
      res = await updateObra(fd);
    } else {
      res = await createObra(fd);
    }
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
    // En éxito, el server action redirige al dashboard.
  }

  const preview = filePreview || (cover.startsWith("http") ? cover : "");

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-2xl">
      <Field name="title" label="Título" placeholder="Casa Belgrano" required defaultValue={initial?.title} />
      <div>
        <Label>Descripción</Label>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          placeholder="Contá qué hiciste: paleta, ambientes, materiales…"
          className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <Label>Categoría</Label>
          <select
            name="category"
            defaultValue={initial?.category ?? "Residencial"}
            className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <Field name="location" label="Ubicación" placeholder="Belgrano, CABA" defaultValue={initial?.location} />
      </div>

      <div>
        <Label>Foto de la obra</Label>
        <label className="mt-2 flex flex-col items-center justify-center aspect-[16/9] border-2 border-dashed border-concrete/30 bg-mist cursor-pointer hover:border-ink transition-colors overflow-hidden">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Vista previa" className="w-full h-full object-cover" />
          ) : (
            <>
              <span className="font-display text-display-md text-concrete">＋</span>
              <span className="font-body text-body-sm text-ink mt-1">
                {resizing ? "Procesando…" : "Subí una foto (JPG/PNG)"}
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <span className="mt-2 block font-body text-body-sm text-concrete">
          Se sube comprimida automáticamente. O si preferís, pegá una URL:
        </span>
        <input
          name="cover_url"
          placeholder="https://…"
          value={cover}
          onChange={(e) => setCover(e.target.value)}
          className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
        />
      </div>

      <div>
        <Label>Color de acento</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setAccent(c)}
              aria-label={c}
              className={cn("w-9 h-9 border-2 transition-transform", accent === c ? "border-ink scale-110" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}

      <button
        type="submit"
        disabled={loading || resizing}
        className="px-6 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Guardando…" : editing ? "Guardar cambios" : "Publicar obra"}
      </button>
    </form>
  );
}

// Redimensiona/comprime la imagen en el navegador antes de subirla (payload liviano).
function resizeImage(file: File, max = 1600, quality = 0.85): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      const url = canvas.toDataURL("image/jpeg", quality);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (!blob) return reject(new Error("no blob"));
          resolve({ blob, url });
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("img load failed"));
    img.src = URL.createObjectURL(file);
  });
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-mono-sm uppercase tracking-widest text-concrete">{children}</span>;
}

function Field({
  name,
  label,
  placeholder,
  required,
  value,
  defaultValue,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
      />
      {hint && <span className="mt-1 block font-body text-body-sm text-concrete">{hint}</span>}
    </label>
  );
}
