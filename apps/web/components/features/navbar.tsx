"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/obras", label: "Obras" },
  { href: "/simulador", label: "Simulador" },
  { href: "/pintores", label: "Pintores" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/contacto", label: "Contacto" },
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
                  "font-body text-body-sm transition-colors duration-300 hover:text-ink",
                  active ? "text-ink" : "text-concrete",
                )}
              >
                {link.label}
              </Link>
            );
          })}
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
        <div className="md:hidden bg-plaster border-t border-concrete/10">
          <div className="container-asymmetric flex flex-col py-6 gap-4">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="font-body text-body-lg text-ink py-1">
                {link.label}
              </Link>
            ))}
            <Link href="/cotizar" className="mt-2 px-5 py-3 bg-ink text-bone text-center font-body text-body-sm">
              Cotizar
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
