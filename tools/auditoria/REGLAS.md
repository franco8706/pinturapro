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
- **Si creás un trabajo, anotá su id.** `jobs.project_id` es `on delete set null`: cuando el
  orquestador borra tu pedido ZZAGENT, el trabajo que colgaba de él queda huérfano y sin ninguna
  marca que lo delate, salvo que la nota diga ZZAGENT o que vos hayas dado el id.

### 3 bis. Cuando corren varios agentes a la vez

En las rondas grandes corren cinco o seis agentes juntos contra **el mismo servidor y la misma
base**. Cada uno cree que está solo, y así fue como una ronda le dejó a la siguiente datos que
rompían las pruebas. Reglas:

- **No toques datos demo que no creaste.** No aceptes, canceles ni completes trabajos existentes;
  no dejes reseñas en trabajos existentes; no des de baja cuentas demo. Si necesitás recorrer un
  ciclo entero (pedido → cotización → aceptar → completar → reseña), **armalo desde cero con un
  pedido ZZAGENT** y listalo al final.
- **Hay un trabajo que es sagrado:** el de `cliente4` (carolina.ruiz) con `pintor2`
  (lucia.fernandez), completado y SIN reseña. La prueba de accesibilidad lo necesita así para
  poder abrir el formulario de reseña. Si le dejás una reseña, esa prueba se rompe.
- **Si editás un perfil demo para probar algo, dejalo exactamente como estaba** — anotá los
  valores antes de tocar y restauralos en `finally`.
- **`pnpm verificar` lo corre sólo el agente `regresiones`** (o el orquestador). Las pruebas
  crean y restauran datos; dos corridas a la vez se pisan.
- **El servidor de producción, cuando existe, está en el puerto 3100** (lo levanta el orquestador con `bash tools/auditoria/produccion.sh`) y es sólo para medir
  (rendimiento, publicación, nube). No lo reinicies ni lo compiles de nuevo: si no responde,
  decilo en el reporte.
- Tu Chrome es tuyo; el servidor no. Si notás que tarda, puede ser otro agente compilando una
  página por primera vez: esperá y reintentá una vez antes de reportar lentitud.

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

Y estas trampas del propio script, que ya costaron tiempo:

- **`button[type=submit]` agarra el botón "Salir" del menú**, que también es un submit. El script
  cierra la sesión y termina en la portada, y parece que el formulario está roto. Buscá el botón
  DENTRO del formulario: `document.querySelector("textarea[name=bio]").closest("form")`.
- Si tocás algo que **desplaza la página**, el `boundingBox()` que tomaste antes queda viejo y el
  clic siguiente cae en otro lado.
- **`window.innerWidth` NO es el ancho de la pantalla cuando algo se desborda.** El navegador lo
  agranda hasta el tamaño del contenido: en una pantalla de 390 px con una fila de 495, devuelve
  495, y cualquier cuenta del tipo "¿entra todo?" da que sí. Usá
  `document.documentElement.clientWidth`. Esto tapó un botón cortado durante varias rondas.
- **Lo que está en -9999 px no siempre es un bug.** Los formularios tienen una trampa anti-spam:
  un campo "No completar" con `aria-hidden="true"` parado fuera de la pantalla, que sólo llenan
  los robots. Antes de reportar algo fuera de la pantalla, fijate si él o alguno de sus padres
  tiene `aria-hidden="true"`.
- **`/auth/signout` sólo acepta POST.** Visitarlo con `goto` devuelve 405 y deja la pestaña en un
  documento de error, y la navegación siguiente se corta a la mitad con un
  `chrome-error://chromewebdata`. Para cerrar sesión alcanza con borrar las cookies — es lo que
  hace `k.salir()`.

### Trampas de las pruebas que dan verde sin medir nada

Todas pasaron en este proyecto. Si escribís una prueba, revisá que no caiga en ninguna, y
**verla fallar rompiendo el arreglo a propósito es la única forma de saber que mide algo**.

- **Una prueba salteada para siempre.** `doble-envio` pedía `psql` y una conexión directa que
  desde el Codespace nunca anduvo: figuró "1 salteada" en cada corrida durante días, y el
  "salteada" se volvió ruido. Para contar filas usá `regresiones/base.cjs` (API REST).
- **Una respuesta que no entra en el búfer.** `pnpm audit --json` devuelve ~45 MB y
  `execFileSync` corta en 1 MB por defecto: la prueba no podía leerla, anotaba "sin red" y
  daba verde. Poné `maxBuffer` y, si no se pudo medir, decilo en la nota.
- **El resumen en el medio del archivo.** `packages/dominio/pruebas.ts` imprimía "todo en
  verde" y hacía `process.exit` antes de las pruebas que se agregaron debajo. Resumen al final.
- **Esperas fijas con el servidor cargado.** Esperar 5 s y contar falla cuando corren seis
  agentes a la vez, y encima lo que llega tarde queda sin limpiar. Esperá la confirmación en
  pantalla, no un tiempo.
- **Leer el DOM en el mismo instante del clic.** React todavía no repintó: `aria-pressed` se
  lee viejo. Clic, esperar, y leer en OTRA llamada a `page.evaluate`.
- **Un filtro de `--solo` que no coincide con el archivo.** `--solo cotizar` no corre
  `ya-cotizado`: "0 filas quedaron" no probaba nada. Mirá que la línea ✓ aparezca.

### Trampas de la base

- **Una función nueva no existe para la API hasta recargar su caché**:
  `notify pgrst, 'reload schema';`. Antes contesta `PGRST202`, que parece un error de
  permisos y no lo es.
- **`pkill -f "algo"` se mata a sí mismo** si "algo" aparece en la línea de comandos del
  propio shell. Usá un patrón que no se contenga: `pkill -f "serve[r].js"`.

## 6. Ya conocido — está en la BITÁCORA

La lista vive en `tools/auditoria/BITACORA.md`, con cuatro estados: `corregido`, `abierto`,
`descartado` (se midió y no era un problema) y `decisión del dueño`.

Leela antes de reportar. Y si encontrás algo que figura como **corregido**, no lo anotes como un
hallazgo más: es una regresión, que es bastante más grave. Decilo así.

## 7. Si arreglás algo, dejá una prueba

`pnpm verificar` corre las pruebas de regresión en un navegador real. Cada cosa de esta lista se
había roto sin que nadie se enterara, y se descubrió recién cuando una persona la probó a mano.
Un arreglo sin prueba se vuelve a romper. El agente `regresiones` se ocupa de eso.
