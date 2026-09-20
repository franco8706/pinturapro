import { cn } from "@/lib/utils";

type Level = "Silver" | "Gold" | "Master";

const styles: Record<Level, { bg: string; text: string; dot: string }> = {
  Silver: { bg: "bg-concrete/10", text: "text-concrete", dot: "#9CA3AF" },
  // El dorado sobre dorado claro daba 2,96:1, por debajo del piso de 4,5:1 para texto chico.
  // Se oscurece el texto y se deja el punto dorado, que es lo que da la identidad del nivel.
  Gold: { bg: "bg-[#DAA520]/12", text: "text-[#6B4E00]", dot: "#DAA520" },
  Master: { bg: "bg-ink", text: "text-bone", dot: "#FFD700" },
};

export function LevelBadge({ level, className }: { level: Level; className?: string }) {
  const s = styles[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-mono-sm uppercase tracking-widest",
        s.bg,
        s.text,
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.dot }} />
      {level}
    </span>
  );
}
