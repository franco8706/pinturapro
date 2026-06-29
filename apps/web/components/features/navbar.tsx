"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AuthNav } from "./auth-nav";

const links = [
  { href: "/obras", label: "Obras" },
  { href: "/pintores", label: "Pintores" },
  { href: "/simulador", label: "Simulador" },
  { href: "/aprender", label: "Aprender" },
  { href: "/asesoramiento", label: "Asesoramiento" },
  { href: "/colores", label: "Colores" },
  { href: "/nosotros", label: "Nosotros" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-500 ease-expo-out",
        scrolled ? "bg-plaster/80 backdrop-blur-md border-b border-concrete/10" : "bg-transparent",
      )}
    >
      <nav className="container-asymmetric flex items-center justify-between h-20">
        <Link href="/" className="font-display text-display-md leading-none tracking-tight">
          Pintura<span className="text-concrete">Pro</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "group relative font-body text-body-sm transition-colors duration-300 hover:text-ink",
                  active ? "text-ink" : "text-concrete",
                )}
              >
                {link.label}
                <span
                  className={cn(
                    "absolute -bottom-1.5 left-0 h-px bg-ink transition-all duration-300 ease-expo-out",
                    active ? "w-full" : "w-0 group-hover:w-full",
                  )}
                />
              </Link>
            );
          })}
          <AuthNav />
          <Link
            href="/cotizar"
            className="px-5 py-2.5 bg-ink text-bone font-body text-body-sm hover:bg-ink/90 transition-colors duration-300"
          >
            Cotizar
          </Link>
        </div>

        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Abrir menú"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={cn("block w-6 h-px bg-ink transition-transform", open && "translate-y-[7px] rotate-45")} />
          <span className={cn("block w-6 h-px bg-ink transition-opacity", open && "opacity-0")} />
          <span className={cn("block w-6 h-px bg-ink transition-transform", open && "-translate-y-[7px] -rotate-45")} />
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-plaster/95 backdrop-blur-md border-t border-concrete/10">
          <div className="container-asymmetric flex flex-col py-6 gap-1">
            {links.map((link, i) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{ animation: `fadeIn 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.05}s both` }}
                  className={cn(
                    "flex items-center justify-between font-body text-body-lg py-2.5 border-b border-concrete/10",
                    active ? "text-ink" : "text-concrete",
                  )}
                >
                  {link.label}
                  <span aria-hidden className="font-mono text-concrete">→</span>
                </Link>
              );
            })}
            <AuthNav className="py-2 text-body-lg text-left" />
            <Link
              href="/cotizar"
              style={{ animation: `fadeIn 0.4s cubic-bezier(0.16,1,0.3,1) ${links.length * 0.05}s both` }}
              className="mt-3 px-5 py-3 bg-ink text-bone text-center font-body text-body-sm"
            >
              Cotizar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
