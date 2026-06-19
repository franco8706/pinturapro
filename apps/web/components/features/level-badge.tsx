import { cn } from "@/lib/utils";

type Level = "Silver" | "Gold" | "Master";

const styles: Record<Level, { bg: string; text: string; dot: string }> = {
  Silver: { bg: "bg-concrete/10", text: "text-concrete", dot: "#9CA3AF" },
  Gold: { bg: "bg-[#DAA520]/12", text: "text-[#B8860B]", dot: "#DAA520" },
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
