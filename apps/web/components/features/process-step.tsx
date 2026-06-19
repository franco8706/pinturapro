import { cn } from "@/lib/utils";

interface ProcessStepProps {
  number: number | string;
  title: string;
  description: string;
  className?: string;
}

export function ProcessStep({ number, title, description, className }: ProcessStepProps) {
  return (
    <div className={cn("flex gap-6 group", className)}>
      <div className="shrink-0">
        <span className="font-mono text-mono-sm text-concrete tabular-nums">
          {String(number).padStart(2, "0")}
        </span>
        <div className="w-px h-full mt-3 bg-concrete/20 group-last:hidden" />
      </div>
      <div className="pb-12 group-last:pb-0">
        <h3 className="font-display text-display-md mb-3">{title}</h3>
        <p className="font-body text-body-md text-concrete max-w-md leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
