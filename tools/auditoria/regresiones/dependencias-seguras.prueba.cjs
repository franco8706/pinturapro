/**
 * Vigila que lo que atiende pedidos de internet no traiga vulnerabilidades conocidas.
 *
 * El peor agujero que tuvo este proyecto no estaba en su código: Next.js 15.5.22 traía dos
 * ejecuciones remotas de código críticas, una en el optimizador de imágenes. Se arregló
 * cuando alguien se acordó de mirar. La segunda vez fue `sharp` 0.35.3 —la librería que
 * procesa las fotos que sube la gente—, con ejecución remota de código vía libheif en Linux
 * con glibc, que es justo lo que corre un contenedor de Cloud Run (GHSA-rgj7-g3m4-5g8c,
 * publicada el 8/9/2026). La encontró el agente `dependencias` en su primera ronda. Nadie
 * miraba de forma regular, y un aviso se publica cualquier día, no cuando uno se acuerda.
 *
 * Qué mira: `pnpm audit --prod`, sólo los avisos cuyo camino pasa por `apps/web` o por los
 * paquetes compartidos (lo que corre en el servidor que da la cara a internet). Falla con
 * cualquier aviso ALTO o CRÍTICO ahí.
 *
 * Qué NO mira, a propósito: la CLI de Expo (`apps/mobile`) trae decenas de avisos, todos de
 * herramientas que corren en la máquina de quien compila la app, nunca en un servidor ni en
 * el teléfono. Se resuelven actualizando Expo, que es un proyecto aparte (ver BITÁCORA). Si
 * esta prueba los contara, estaría en rojo para siempre, y una prueba que siempre está en
 * rojo termina ignorada — que es lo que le pasó a la del doble envío con su "1 salteada".
 *
 * Necesita salir a internet (consulta la base de avisos de npm). Si no puede, se anota y no
 * falla: un corte de red no es una vulnerabilidad.
 */
const { execFileSync } = require("child_process");
const path = require("path");

const RAIZ = path.join(__dirname, "../../..");

module.exports = {
  nombre: "dependencias · lo que atiende internet no trae vulnerabilidades altas conocidas",

  async correr(t) {
    let crudo;
    let motivo = "";
    try {
      crudo = execFileSync("pnpm", ["audit", "--prod", "--json"], {
        cwd: RAIZ,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 120000,
        // La respuesta pesa ~45 MB (cada aviso lista todos sus caminos por el árbol) y el
        // tope por defecto de execFileSync es 1 MB. La primera versión de esta prueba se
        // quedaba con el primer mega, no podía leerlo, y anotaba "sin red": daba verde sin
        // haber medido nada. Justo el tipo de punto ciego que esta prueba existe para evitar.
        maxBuffer: 512 * 1024 * 1024,
      });
    } catch (e) {
      // `pnpm audit` sale con código distinto de cero cuando ENCUENTRA algo: la salida
      // igual viene en stdout. Sólo es un problema real si no vino nada.
      crudo = e.stdout || "";
      motivo = e.code || (e.signal ? `señal ${e.signal}` : "");
    }

    let datos;
    try {
      datos = JSON.parse(crudo);
    } catch {
      t.nota(
        `no se pudo leer la respuesta de la base de avisos de npm (${motivo || "¿sin red?"}, ` +
          `${crudo.length} bytes): la prueba no midió nada`,
      );
      return;
    }

    const delServidor = (p) =>
      p.startsWith("apps/web") || p.startsWith("apps__web") || p.startsWith("packages/") || p.startsWith(".>");
    const graves = Object.values(datos.advisories || {}).filter(
      (a) =>
        (a.severity === "high" || a.severity === "critical") &&
        (a.findings || []).some((f) => (f.paths || []).some(delServidor)),
    );

    const detalle = graves.map((a) => {
      const version = (a.findings || [])[0]?.version || "?";
      return `${a.module_name}@${version} (${a.severity}, ${a.github_advisory_id}: ${a.title.slice(0, 70)}; se arregla en ${a.patched_versions})`;
    });
    t.nota(`avisos altos o críticos en lo que atiende internet: ${graves.length}`);
    t.cierto(
      graves.length === 0,
      `hay dependencias con vulnerabilidades conocidas en el servidor -> ${detalle.join(" · ")}`,
    );
  },
};
