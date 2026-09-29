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

/**
 * Casos que el parser de montos tiene que contestar así, en el paquete que ahora usan la web Y
 * el móvil. El primero es el bug histórico. Antes se corrían contra la copia del móvil.
 */
const CASOS = [
  ["150.000,50", 150000],
  ["320.000", 320000],
  ["$ 45.500", 45500],
  ["1250", 1250],
  ["150 000", 150000],
  ["1.000.000.000", 1000000000],
  ["-99999", null],
  ["0", null],
  ["abc", null],
  ["", null],
  ["99999999999", null],
  // Lo que el parser adivinaba mal y ahora rechaza. Ninguno de estos estaba acá, y por eso
  // el defecto vivía en las DOS copias sin que la prueba de sincronía lo viera: no estaban
  // desincronizadas, estaban igual de rotas. Cada uno con el número que salía antes:
  ["1,500,000", null], // daba 1 — un pintor cobrando $1 en vez de $1.500.000
  ["150,000,000", null], // daba 150
  ["150,000.50", null], // daba 150
  ["1,500", null], // daba 1
  ["1500.50", null], // daba 150.050 (×100)
  ["150.00", null], // daba 15.000 (×100)
  ["1.50.000", null], // daba 150.000
  ["1.5e6", null], // daba 156
  ["1.50E+06", null], // daba 15.006 — el más peligroso: es un número creíble
  ["abc150000", null], // daba 150.000: las letras se borraban en silencio
  ["1e999", null], // daba 1999
];

module.exports = {
  nombre: "reglas compartidas · montos, comisión y el móvil sin copias propias",

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

    // ── 2. El móvil ya no tiene copia: importa el paquete ──
    // Hasta el 29/9 esta prueba extraía el `toInt` de la copia del móvil y lo comparaba con el
    // de la web, caso por caso: un parche, porque cada regla copiada necesitaba su propia
    // comparación y alguien que se acordara de escribirla. El móvil tenía su copia porque "Metro
    // no resolvía paquetes del monorepo"; con Expo 52 sí (verificado por `arquitectura-modular` y
    // `app-movil`). Ahora lo que se vigila es que no vuelva a aparecer una copia.
    const pkgMovil = JSON.parse(fs.readFileSync(path.join(RAIZ, "apps/mobile/package.json"), "utf8"));
    const dep = (pkgMovil.dependencies || {})["@pinturapro/dominio"];
    t.cierto(!!dep, "apps/mobile/package.json no declara @pinturapro/dominio: el móvil volvió a quedar sin las reglas compartidas");
    t.cierto(
      !dep || dep.startsWith("file:"),
      `el móvil declara @pinturapro/dominio como ${JSON.stringify(dep)}; tiene que ser "file:..." — "workspace:*" rompe \`npm install\` (medido el 29/9)`,
    );
    const ruta = path.join(RAIZ, "apps/mobile/lib/mutations.ts");
    const fuente = fs.readFileSync(ruta, "utf8");
    t.cierto(/from "@pinturapro\/dominio"/.test(fuente), "apps/mobile/lib/mutations.ts no importa @pinturapro/dominio");
    for (const [patron, que] of [
      [/function toInt\(/, "el parser de montos"],
      [/function mensajeDeError\(/, "el traductor de errores de la base"],
      [/const TOPES\s*=/, "los topes de largo"],
      [/function revisarLargos\(/, "la validación de largos"],
      [/type === "client"/, "la regla de quién puede cotizar"],
    ]) {
      t.cierto(!patron.test(fuente), `el móvil volvió a tener su propia copia de ${que}: tiene que venir de @pinturapro/dominio`);
    }
    // Los casos históricos, contra el mismo archivo que importan las dos apps.
    const montosTs = path.join(RAIZ, "packages/dominio/src/montos.ts");
    let respuestas = null;
    try {
      const salida = execFileSync(
        "node",
        ["--input-type=module", "-e",
          `import { montoDesdeTexto } from ${JSON.stringify(montosTs)};` +
          `console.log(JSON.stringify(${JSON.stringify(CASOS.map((c) => c[0]))}.map(montoDesdeTexto)));`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      respuestas = JSON.parse(salida.trim().split("\n").pop());
    } catch (e) {
      t.cierto(false, `no pude correr el parser del paquete: ${String(e.stderr || e).slice(0, 200)}`);
    }
    if (respuestas) {
      CASOS.forEach(([entrada, esperado], i) =>
        t.igual(respuestas[i], esperado, `el parser convierte ${JSON.stringify(entrada)} mal (web y móvil usan este)`),
      );
    }

    // El paquete se resuelve desde la carpeta del móvil (lo que va a hacer Metro).
    try {
      require.resolve("@pinturapro/dominio", { paths: [path.join(RAIZ, "apps/mobile")] });
    } catch {
      t.cierto(false, "@pinturapro/dominio no se resuelve desde apps/mobile: falta `pnpm install` o el enlace se rompió");
    }

    // ── La comisión: una sola fórmula ──
    // La web tenía DOS: `comisionDe` (del paquete) para lo que ve el pintor y `commissionFor`
    // (en lib/utils.ts) para lo que se guarda. Daban lo mismo, pero nada las ataba, y este
    // proyecto ya mostró 8% mientras guardaba 10%. Lo marcó el agente `dinero-y-comisiones`.
    const utils = fs.readFileSync(path.join(RAIZ, "apps/web/lib/utils.ts"), "utf8");
    t.cierto(
      /from "@pinturapro\/dominio"/.test(utils) && !/Math\.round\(\s*amount/.test(utils),
      "apps/web/lib/utils.ts volvió a calcular la comisión por su cuenta en vez de tomarla de @pinturapro/dominio",
    );
    // Y el móvil tampoco la calcula por su cuenta: escribía `amount * 0.1` a mano en dos
    // lugares, sin constante. Ahora usa `comisionDe`, como la web.
    const COMISION = 0.1; // espejo de packages/dominio/src/montos.ts; si cambia allá, cambia acá
    const movil = ["apps/mobile/lib/mutations.ts", "apps/mobile/app/cotizar/[id].tsx"]
      .map((r) => fs.readFileSync(path.join(RAIZ, r), "utf8"))
      .join("\n");
    const tasas = [...movil.matchAll(/\*\s*0\.\d+/g)].map((m) => m[0]);
    t.cierto(tasas.length === 0, `el móvil volvió a calcular la comisión a mano (${tasas.join(", ")}) en vez de usar comisionDe`);
    t.cierto(/comisionDe\(/.test(movil), "no encontré comisionDe en el móvil: ¿dónde calcula ahora la comisión?");
    const montos = fs.readFileSync(path.join(RAIZ, "packages/dominio/src/montos.ts"), "utf8");
    t.cierto(
      new RegExp(`COMISION\\s*=\\s*${COMISION}\\b`).test(montos),
      "la comisión del paquete cambió y esta prueba (y el móvil) no se enteraron",
    );
  },
};
