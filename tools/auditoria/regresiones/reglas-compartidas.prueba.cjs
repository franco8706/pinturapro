/**
 * Vigila las reglas de negocio, y que la web y el móvil sigan diciendo lo mismo.
 *
 * Lo que se rompió: la app móvil tenía su propia copia del parser de montos, la versión que
 * la web había corregido nueve meses antes. En el teléfono, "150.000,50" se convertía en
 * $15.000.050 —cien veces más— y ese número viajaba a una cotización que un cliente después
 * aceptaba. Nadie se enteró porque las dos copias vivían en archivos distintos.
 *
 * Esta prueba hace dos cosas:
 *  1. Corre las pruebas del paquete `packages/dominio` (sin navegador ni base).
 *  2. Compara la copia del móvil contra el paquete, con los mismos casos. Si alguien toca una
 *     y no la otra, salta acá.
 *
 * La copia del móvil existe porque Metro, el empaquetador de Expo, necesita configuración
 * extra para resolver paquetes del monorepo y eso no se puede probar desde este entorno. El
 * día que se configure, el móvil importa el paquete y la mitad 2 de esta prueba se borra.
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RAIZ = path.resolve(__dirname, "../../..");

/** Casos que los dos lados tienen que contestar igual. El primero es el bug histórico. */
const CASOS = [
  ["150.000,50", 150000],
  ["320.000", 320000],
  ["$ 45.500", 45500],
  ["1250", 1250],
  ["-99999", null],
  ["0", null],
  ["abc", null],
  ["", null],
  ["99999999999", null],
];

module.exports = {
  nombre: "reglas compartidas · montos, topes y la copia del móvil al día",

  async correr(t) {
    // ── 1. El paquete se prueba solo ──
    try {
      const salida = execFileSync("node", [path.join(RAIZ, "packages/dominio/pruebas.ts")], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      t.contiene(salida, "todo en verde", "las pruebas del paquete de reglas no pasaron");
    } catch (e) {
      t.cierto(false, `las pruebas del paquete fallaron: ${String(e.stdout || e).slice(0, 300)}`);
    }

    // ── 2. La copia del móvil contesta lo mismo ──
    // Se extrae `toInt` del archivo del móvil y se ejecuta aislada, sin importar el módulo
    // entero (que arrastra supabase y React Native, imposibles de cargar acá).
    const ruta = path.join(RAIZ, "apps/mobile/lib/mutations.ts");
    const fuente = fs.readFileSync(ruta, "utf8");
    const desde = fuente.indexOf("function toInt(");
    if (desde < 0) {
      t.cierto(false, "no encontré `toInt` en apps/mobile/lib/mutations.ts: ¿cambió de nombre?");
      return;
    }
    const hasta = fuente.indexOf("\n}", desde) + 2;
    const cuerpo = fuente
      .slice(desde, hasta)
      .replace(/:\s*string/g, "")
      .replace(/:\s*number \| null/g, ""); // sacar los tipos para poder evaluarlo

    let toIntMovil;
    try {
      toIntMovil = new Function(`${cuerpo}; return toInt;`)();
    } catch (e) {
      t.cierto(false, `no pude evaluar el toInt del móvil: ${String(e).slice(0, 200)}`);
      return;
    }

    for (const [entrada, esperado] of CASOS) {
      t.igual(
        toIntMovil(entrada),
        esperado,
        `el móvil convierte ${JSON.stringify(entrada)} distinto que la web (es la copia desincronizada)`,
      );
    }

    // El traductor de errores del móvil también tiene que cubrir los topes de largo (0017).
    t.cierto(
      /23514/.test(fuente),
      "el traductor de errores del móvil no cubre el código 23514: escribir de más cae en el mensaje genérico",
    );
    t.cierto(
      /revisarLargos/.test(fuente),
      "el móvil no valida los largos antes de enviar: la persona escribe todo y se entera al final",
    );
  },
};
