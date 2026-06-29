/**
 * template.tsx se re-monta en cada navegación → habilita una transición de entrada.
 * Usamos solo opacidad (sin transform) para no afectar el navbar fijo.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
