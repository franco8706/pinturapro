# Reglas comunes para todos los agentes y sub-agentes — Pintura Pro

Proyecto: `/workspaces/codespaces-blank/pinturapro` · app Next.js 15 en `apps/web` · Supabase vivo.
Este archivo es obligatorio. Si sos un agente líder, **pasale esta ruta a cada sub-agente que lances**
y decile que la lea con la herramienta Read antes de empezar.

Kit: `tools/auditoria/` **dentro del repositorio** (antes vivía en `/tmp` y el Codespace se lo
llevó puesto dos veces).

---

## 1. Lo que NO se hace nunca (cada una ya rompió algo)

- **NO correr `pnpm build`, `next build` ni `rm -rf .next`.** El build pisa el `.next` del servidor
  compartido y deja a TODOS los agentes con errores 500. Ya pasó dos veces.
- **NO levantar otro servidor** (`pnpm dev`, `next dev`, `next start`) en ningún puerto. Hay UNO solo,
  en `http://localhost:3000`, y lo maneja el orquestador. Si no responde, reportalo; no lo reinicies.
- **NO matar procesos** (`pkill`, `kill`).
- **NO tocar la base con SQL directo, ni pedir la contraseña.** Todo por la interfaz o la API pública.
- **NO usar las herramientas MCP de Playwright** (`mcp__playwright__*`): son un navegador compartido
  que usa el orquestador. Usá el kit, que te da tu propio Chrome.
- **NO editar archivos del proyecto** salvo que tu tarea lo diga. Vos reportás; el orquestador corrige.

## 2. Navegador: usá el kit

```js
const k = require("/workspaces/codespaces-blank/pinturapro/tools/auditoria/navegador.cjs");
(async () => {
  const { browser, page, eventos } = await k.abrir({ movil: true }); // o { movil: false } = 1440px
  try {
    await k.ingresar(page, "pintor");          // admin, pintor, pintor2, pintor3, cliente, cliente2, cliente3, cliente4
    await k.ir(page, "/dashboard");            // devuelve el status HTTP
    k.limpiarEventos(eventos);                 // antes de auditar una pantalla nueva
    console.log(JSON.stringify(await k.auditar(page, eventos), null, 2));
  } finally {
    await browser.close();                     // SIEMPRE, aunque falle
  }
})();
```

Guardá tus scripts en `/tmp/auditoria/<tu-nombre>/` (NO dentro del repo: son descartables y
ensucian el control de versiones). Corrélos con
`timeout 240 node <script>`. **Un solo navegador a la vez, y cerralo** antes de abrir otro.

`k.auditar()` devuelve `titulo`, `h1`, `scrollHorizontal`, `elementosFueraDePantalla`,
`objetivosTactilesChicos` (< 24px), `imagenesRotas`, `textosProhibidos` (errores crudos de base, stack
traces, NaN, "Invalid Date"…), `erroresConsola`, `erroresJs`, `requestsFallidos` (4xx/5xx). Todo
debería venir vacío o en cero; lo que no, es un hallazgo.

Cuentas demo: contraseña `Demo1234!`. `admin` es el único con `is_admin`.

**Si el servidor no responde** (ERR_CONNECTION_REFUSED): pará, avisá al orquestador y esperá. No lo
levantes vos.

## 3. Datos de prueba: marcados y declarados

- **Todo lo que crees lleva el prefijo `ZZAGENT`**: títulos de pedidos, notas de cotizaciones,
  comentarios de reseñas, nombres en formularios. Ej: `ZZAGENT pintura living`.
- **En tu reporte final listá todo lo que creaste** (qué y con qué título exacto): el orquestador lo
  borra, vos no tenés acceso a la base.

## 4. Cómo reportar

- En español. Concreto: **página, qué hiciste, qué esperabas, qué pasó**, con el texto exacto visto.
- Archivo y línea cuando lo encuentres en el código.
- Por severidad: **BLOQUEANTE** (impide usar o publicar) · **IMPORTANTE** · **MENOR**.
- Marcá qué es **medido/visto** y qué es **deducido**. Si no pudiste probar algo, decilo.
- Lo que funciona bien, en una línea. No rellenes.

## 5. Ya conocido — no lo reportes como nuevo

- Todos los datos visibles (pintores, reseñas, obras) son de demostración.
- La paleta de colores es de muestra (`PALETA_DEMO`), y la pantalla ya lo avisa.
- No hay `RESEND_API_KEY`: no salen emails.
- El motor de color del simulador todavía no usa OKLab ni guided filter (los bordes sangran ~2px en
  molduras). Está planificado.
- `/api/segment` usa una cuota en memoria (no Redis).
- Los links del pie miden ~17px de alto. Ya está anotado; no hace falta repetirlo por pantalla.
- **Corregido el 19/9, no lo reportes salvo que lo veas ROTO:**
  · una cuenta de cliente podía cotizar pedidos ajenos y publicar obras de portfolio (ahora /trabajos
    le dice "Las cotizaciones las envían los pintores");
  · tres clics seguidos en /contacto creaban tres consultas (ahora una);
  · la varita del simulador agarraba media pared con luz de ventana (ahora 83%).
- En `/publicar` no hay descripción libre ni presupuesto numérico: la descripción se arma sola y el
  presupuesto se elige de una lista. Es a propósito por ahora.
