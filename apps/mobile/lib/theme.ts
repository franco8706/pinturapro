/**
 * Design tokens de Pintura Pro replicados para la app móvil.
 * Mismos valores que la web (tailwind.config.ts) para mantener coherencia de marca.
 */
export const colors = {
  plaster: "#EDEBE6", // fondo base
  ink: "#141414", // texto / superficies oscuras
  concrete: "#6B6B6B", // texto secundario
  mist: "#F5F4F0", // superficies elevadas
  bone: "#FFFFFF", // puros
  line: "rgba(20,20,20,0.12)", // bordes hairline
  danger: "#C41E3A",
  success: "#2D5A3D",
  amber: "#B45309",
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
};

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  full: 999,
};

// Tipografías (se cargan con expo-google-fonts en una iteración; por ahora system + pesos).
export const font = {
  display: undefined as string | undefined, // Space Grotesk (a sumar)
  body: undefined as string | undefined, // Inter (a sumar)
  mono: undefined as string | undefined, // JetBrains Mono (a sumar)
};

export const type = {
  displayXl: { fontSize: 40, lineHeight: 42, fontWeight: "700" as const, letterSpacing: -0.5 },
  displayLg: { fontSize: 30, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.4 },
  displayMd: { fontSize: 22, lineHeight: 26, fontWeight: "700" as const, letterSpacing: -0.2 },
  bodyLg: { fontSize: 17, lineHeight: 26, fontWeight: "400" as const },
  bodyMd: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: "400" as const },
  mono: { fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" as const },
};
