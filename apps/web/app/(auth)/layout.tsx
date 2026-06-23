import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-plaster px-6 py-16">
      <Link href="/" className="font-display text-display-md leading-none tracking-tight mb-10">
        Pintura<span className="text-concrete">Pro</span>
      </Link>
      <div className="w-full max-w-md bg-bone border border-concrete/15 p-8 sm:p-10">{children}</div>
      <Link href="/" className="mt-8 font-body text-body-sm text-concrete hover:text-ink transition-colors">
        ← Volver al inicio
      </Link>
    </main>
  );
}
