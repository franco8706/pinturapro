# Reglas comunes para todos los agentes y sub-agentes — Pintura Pro

Proyecto: `/workspaces/codespaces-blank/pinturapro` · app Next.js 15 en `apps/web` · Supabase vivo.
Este archivo es obligatorio, y junto con él **`tools/auditoria/BITACORA.md`**: ahí está lo que ya se
encontró, lo que se arregló y lo que se descartó midiendo. Leerla evita reportar por tercera vez
algo que ya está resuelto, que es tiempo y tokens tirados.

Si sos un agente líder, **pasale las dos rutas a cada sub-agente que lances** y decile que las lea
con la herramienta Read antes de empezar.

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

## 5. Medir en desarrollo engaña

El servidor compartido corre en modo **desarrollo**: compila cada ruta la primera vez que
alguien la pide, y eso tarda segundos. Dos cosas que ya hicieron reportar bugs que no existen:

- **Páginas en blanco que después se llenan.** Una 404 de `/obras/<slug-inexistente>` se ve vacía
  al principio y completa un segundo después. En la compilación de producción aparece entera de
  entrada. Si ves algo así, esperá y volvé a mirar antes de reportarlo.
- **Clics que no hacen nada.** Si la página todavía no se "activó" (hidratación), un clic o un
  archivo que manda el script cae en una página muerta. `k.ir()` ya espera eso; si armás tu propia
  navegación, esperá igual.

Y una trampa del propio script: si tocás un botón que desplaza la página, el `boundingBox()` que
tomaste antes queda viejo y el clic siguiente cae en otro lado.

## 6. Ya conocido — está en la BITÁCORA

La lista vive en `tools/auditoria/BITACORA.md`, con cuatro estados: `corregido`, `abierto`,
`descartado` (se midió y no era un problema) y `decisión del dueño`.

Leela antes de reportar. Y si encontrás algo que figura como **corregido**, no lo anotes como un
hallazgo más: es una regresión, que es bastante más grave. Decilo así.

## 7. Si arreglás algo, dejá una prueba

`pnpm verificar` corre las pruebas de regresión en un navegador real. Cada cosa de esta lista se
había roto sin que nadie se enterara, y se descubrió recién cuando una persona la probó a mano.
Un arreglo sin prueba se vuelve a romper. El agente `regresiones` se ocupa de eso.
