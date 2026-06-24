"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { updateProfile } from "../actions";

const SPECIALTIES = [
  "Residencial",
  "Comercial",
  "Industrial",
  "Esmaltes",
  "Texturas",
  "Exteriores",
  "Impermeabilización",
  "Empapelado",
];

interface Initial {
  name: string;
  bio: string;
  zone: string;
  avatar: string;
  specialty: string[];
}

export function PerfilForm({ initial }: { initial: Initial }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [specs, setSpecs] = useState<string[]>(initial.specialty);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  const toggle = (s: string) => setSpecs((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResizing(true);
    try {
      const { blob, url } = await resizeSquare(file);
      setAvatarBlob(blob);
      setAvatarPreview(url);
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
    fd.set("specialties", JSON.stringify(specs));
    if (avatarBlob) fd.set("avatar_file", avatarBlob, "avatar.jpg");
    const res = await updateProfile(fd);
    if (res?.error) {
      setError(res.error);
      setLoading(false);
    }
    // En éxito redirige al panel.
  }

  const preview = avatarPreview || (initial.avatar.startsWith("http") ? initial.avatar : "");
  const inicial = (initial.name.trim()[0] || "·").toUpperCase();

  return (
    <form onSubmit={onSubmit} className="space-y-8 max-w-2xl">
      {/* Avatar */}
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-mist overflow-hidden flex items-center justify-center font-display text-display-lg shrink-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Tu foto" className="w-full h-full object-cover" />
          ) : (
            inicial
          )}
        </div>
        <label className="cursor-pointer">
          <span className="inline-block px-4 py-2.5 border border-concrete/30 font-body text-body-sm hover:border-ink transition-colors">
            {resizing ? "Procesando…" : "Cambiar foto"}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <Field name="full_name" label="Nombre y apellido" defaultValue={initial.name} required />
      <Field name="location" label="Zona / Ubicación" placeholder="Belgrano, CABA" defaultValue={initial.zone} />

      <div>
        <Label>Bio</Label>
        <textarea
          name="bio"
          rows={4}
          defaultValue={initial.bio}
          placeholder="Contá tu experiencia, tu estilo de trabajo y qué te diferencia."
          className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors resize-y"
        />
      </div>

      <div>
        <Label>Especialidades</Label>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggle(s)}
              className={cn(
                "px-3 py-2 border font-body text-body-sm transition-colors",
                specs.includes(s) ? "border-ink bg-ink text-bone" : "border-concrete/30 hover:border-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="font-body text-body-sm text-[#C41E3A]">{error}</p>}

      <button
        type="submit"
        disabled={loading || resizing}
        className="px-6 py-3 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Guardando…" : "Guardar perfil"}
      </button>
    </form>
  );
}

// Recorta a cuadrado y comprime el avatar en el navegador antes de subirlo.
function resizeSquare(file: File, size = 512, quality = 0.85): Promise<{ blob: Blob; url: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
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
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-2 w-full border border-concrete/30 bg-plaster px-3 py-2.5 font-body text-body-md text-ink focus:border-ink outline-none transition-colors"
      />
    </label>
  );
}
