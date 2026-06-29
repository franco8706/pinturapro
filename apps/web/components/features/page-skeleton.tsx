import { Navbar } from "@/components/features/navbar";
import { Skeleton } from "@/components/features/states";

/**
 * Esqueleto de página para los loading.tsx: encabezado + grilla de tarjetas.
 * Da una transición de carga pulida durante la navegación (Next muestra esto al instante).
 */
export function PageSkeleton({
  label,
  cards = 6,
  ratio = "aspect-[4/3]",
  cols = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  label?: boolean;
  cards?: number;
  ratio?: string;
  cols?: string;
}) {
  return (
    <main>
      <Navbar />
      <section className="pt-32 sm:pt-40 pb-section min-h-screen">
        <div className="container-asymmetric">
          {label && <Skeleton className="h-3 w-28 mb-6" />}
          <Skeleton className="h-12 w-2/3 max-w-2xl mb-4" />
          <Skeleton className="h-5 w-1/2 max-w-md mb-12" />
          <div className={`grid grid-cols-1 ${cols} gap-6`}>
            {Array.from({ length: cards }).map((_, i) => (
              <div key={i} style={{ animationDelay: `${i * 0.06}s` }} className="animate-pulse">
                <Skeleton className={`w-full ${ratio} mb-4`} />
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
