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
- **NO disparar mails reales en volumen.** El alta, `/recuperar` y los avisos de cotización
  mandan correos de verdad. Los rebotes a dominios inventados (`@pinturapro.demo`, `@example.com`)
  le bajan la reputación al proyecto de Supabase y pueden limitarle los envíos. Un mail suelto
  para verificar un flujo, sí; ráfagas, nunca: los topes se deducen del código y la configuración.
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

Guardá tus scripts y capturas en `tools/auditoria/.salida/<tu-nombre>/`: está dentro del repo
pero fuera de git, así que no ensucia y **sobrevive a un reinicio del Codespace**. Hasta el 3/10
iban en `/tmp/auditoria/`, y un reinicio a mitad de ronda se llevó los scripts y las capturas de
tres agentes. Corrélos con `timeout 240 node <script>`. **Un solo navegador a la vez, y
cerralo** antes de abrir otro.

**Nada de bajar ni instalar archivos en la raíz del repo.** Un `pip download` dejó dos `.whl` de
30 MB junto al `package.json` (3/10). Si necesitás una librería de Python: `pip install --user`.

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
- **Un enlace que desaparece a mitad de tu navegación puede no ser un bug de caché.** Un
  sub-agente reportó "enlace muerto transitorio" a una obra que acababa de ver en un listado: no
  era la caché de 60s (que invalida al instante, medido aparte), era OTRO agente borrando su
  propio dato ZZAGENT mientras el primero tenía la página ya cargada. Si ves algo así, primero
  preguntate si alguien más puede estar limpiando en paralelo antes de reportarlo como falla de
  invalidación.
- **`pnpm verificar` lo corre sólo el agente `regresiones`** (o el orquestador). Las pruebas
  crean y restauran datos; dos corridas a la vez se pisan.
- **El servidor de producción, cuando existe, está en el puerto 3100** (lo levanta el orquestador con `bash tools/auditoria/produccion.sh`) y es sólo para medir
  (rendimiento, publicación, nube). No lo reinicies ni lo compiles de nuevo: si no responde,
  decilo en el reporte.
- Tu Chrome es tuyo; el servidor no. Si notás que tarda, puede ser otro agente compilando una
  página por primera vez: esperá y reintentá una vez antes de reportar lentitud.

## 4. Cómo reportar

- **Guardá tu reporte final en el repo**, en `tools/auditoria/rondas/<ronda>/<tu-nombre>.md`
  (o `<tu-nombre>-<papel>.md` si sos un sub-agente). La carpeta de la ronda te la da el
  orquestador en el pedido. Es la única excepción a "no editar archivos del proyecto". Por qué:
  hasta el 28/9 los reportes vivían sólo en el contexto del orquestador y se perdían cada vez
  que la conversación se compactaba; en el repo, la ronda siguiente puede comparar números y el
  agente `retroalimentacion` puede cerrar la ronda. Nada de claves ni tokens adentro.
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

- **Playwright no hace clic en un botón con `aria-disabled`.** Espera 30 s "a que se habilite" y
  explota, y parece que el formulario está roto. Los formularios de pasos dejan "Continuar"
  apretable a propósito (explica qué falta): una persona lo puede apretar, `page.click` no.
  Usá el teclado: `page.focus(...)` y `page.keyboard.press("Enter")`.
- **`img.naturalWidth` miente en el celular emulado.** Para una imagen de `next/image` con
  `fill` + `object-cover` devuelve el ancho PINTADO (390), no el del archivo (1200): cualquier
  cuenta de "imagen más grande de lo que se muestra" da que está perfecta. Mirá el archivo real
  (`curl` y medirlo) o el `w=` de la dirección de `/_next/image`.
- **Un porcentaje medido en píxeles puede moverse entre versiones de Chrome sin que cambie una
  sola línea de código.** La moldura manchada del simulador pasó de 2,5% a 4,5% entre rondas sin
  ningún commit que tocara `magic-wand.ts`/`oklab.ts`; medida dos veces, dio 4,5% idéntico bit a
  bit. La hipótesis es la versión de Chrome del Codespace (no se confirmó). Antes de reportar un
  cambio en una métrica de píxeles, anotá la versión (`google-chrome --version`) junto al número:
  sin eso, la ronda siguiente no puede saber si cambió el código o el navegador.

### Trampas de las pruebas que dan verde sin medir nada

Todas pasaron en este proyecto. Si escribís una prueba, revisá que no caiga en ninguna, y
**verla fallar rompiendo el arreglo a propósito es la única forma de saber que mide algo**.

- **Cómo verla fallar sin romper el producto a mano:** mientras la compilación de producción
  (:3100) siga siendo la del código ANTERIOR al arreglo, corré la prueba nueva contra ella:
  `PINTURAPRO_URL=http://localhost:3100 node tools/auditoria/regresiones/correr.cjs --solo <prueba>`.
  Tiene que dar rojo con el mismo número que vio el agente (3/10: "Deshacer dejó 0 píxeles donde
  había 262.451"). Recién después se recompila :3100.
- **En el simulador, un color se elige con `button[aria-pressed]:has-text("Arena")`**, no con
  `button:has-text("Arena")`. Desde el 4/10 el botón "＋ Dejar Arena y pintar otra pared" también
  dice el nombre del color, y `page.click` toma el primero que encuentra: la prueba fijaba la pared
  en vez de cambiarle el color, y parecía que el color nuevo no se aplicaba (`simulador-color-fiel`).
- **Lo que cuesta plata se simula.** La IA del simulador (`/api/segment`, Replicate) se contesta
  desde la prueba con `page.route`: tarde, y con una máscara blanca de 8×8 en data URL ("toda la
  foto es una región"). Así se prueba una carrera sin gastar (`simulador-carreras`).
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

- **Con volumen sintético, la primera lectura miente.** Postgres tarda mucho más la primera vez
  que lee filas recién insertadas (tiene que marcarlas): una consulta dio 893 ms y el panel del
  admin 1,9 s; en la corrida siguiente, 62 y 54 ms sin cambiar nada. Medí dos veces y quedate
  con la segunda.
- **Las variables de psql no se reemplazan dentro de `$$ … $$`.** `:N_PINTORES` adentro de un
  bloque `do $$` es un error de sintaxis. Y `disable trigger all` incluye los triggers internos
  de las claves foráneas, que no se pueden tocar: es `disable trigger user`.
- **Los scripts SQL de prueba van siempre entre `begin` y `rollback`**, y los corre el
  orquestador (`tools/auditoria/escala/volumen.sql` es el modelo). Aplicar una migración a la
  base real lo autoriza el dueño: el sistema de permisos lo frena, y no se le busca la vuelta.

### El simulador se mide con fotos REALES

Hasta el 3/10 la varita se afinó sólo con las tres fotos sintéticas de `generar.py`: daban 82-84 %
de pared con 99 % de precisión, y en fotos de verdad la pintura terminaba en un arco de círculo,
se comía el techo de los cuartos blancos y no servía en ninguna fachada. Las sintéticas no tienen
techo del mismo color, cuadros, ni textura de ladrillo. `python3 tools/auditoria/simulador/fotos-reales.py`
baja 18 fotos reales (siempre las mismas) y arma 19 variantes de archivo; los puntos de toque y
las zonas "seguro pared"/"fugas" de cada una están en `tools/auditoria/.salida/simulador-color/reales.json`
(los dibujó el agente mirando cada foto). Para medir en Node, el reescalado de PIL no es el de
Chrome: los números son aproximados; lo que se publica, se confirma en el navegador.

### Lo que le pasó al orquestador (para el que lance agentes)

- **Mientras los agentes miden contra :3000, el orquestador arregla en una copia aparte**
  (`git worktree add`) y verifica en Node (`pnpm pruebas-color`, `tsc`). Editar el código que el
  servidor de desarrollo está sirviendo cambia lo que los agentes miden a mitad de camino. Se
  integra cuando terminan (3/10: así se arreglaron 15 cosas del simulador sin pisar ninguna
  medición).
- **El Codespace se puede reiniciar a mitad de ronda** (3/10, ~07:17 UTC): se cae el servidor de
  desarrollo (`pnpm dev`, lo levanta el orquestador), se borra `/tmp`, y los agentes que estaban
  cortados por el límite de uso se retoman con SendMessage: conservan lo que sabían, no sus
  archivos de `/tmp`. Pediles que escriban el reporte parcial apenas tengan algo.

- **Un agente lanzado como `general-purpose` puede editar**, aunque su definición diga
  `tools: Bash, Read, Glob, Grep`. Pasó el 28/9 con `buscadores` (su tipo todavía no estaba
  registrado): editó 17 archivos del producto por su cuenta y el límite de uso lo cortó a la
  mitad. Lanzá cada agente por su tipo; si no se puede, decile explícitamente que no edite.
- **El límite de uso corta agentes a mitad de tarea.** Lo que hayan creado en la base queda
  ahí, y un "romper el arreglo para ver fallar la prueba" a medio hacer deja el producto roto.
  Después de un corte: `git status` y contar filas, antes de reanudar a nadie.
- **Tandas chicas.** Seis o siete agentes a la vez agotaron el cupo tres veces en esta ronda.
  De a dos o tres, y con el reporte guardado en el repo apenas tengan hallazgos.
- **Los agentes lanzados en segundo plano mueren si se cierra la sesión.** Pasó tres veces en
  esta ronda. Lanzalos en primer plano, de a dos o tres, y esperá a que terminen.
- **La suite de regresión conviene correrla como proceso suelto, con el log fuera de `/tmp`**
  (`tools/auditoria/.salida/verificar.log`, dentro del repo pero fuera de git; no `/tmp`, que se borra): si la
  sesión se corta, la corrida termina igual y el resultado no se pierde.
- **Commiteá apenas un cambio compile**, antes de correr `pnpm verificar`: si un corte de sesión
  llega en el medio, el trabajo ya está guardado.

## 6. Ya conocido — está en la BITÁCORA

La lista vive en `tools/auditoria/BITACORA.md`, con cuatro estados: `corregido`, `abierto`,
`descartado` (se midió y no era un problema) y `decisión del dueño`.

Leela antes de reportar. Y si encontrás algo que figura como **corregido**, no lo anotes como un
hallazgo más: es una regresión, que es bastante más grave. Decilo así.

## 7. Si arreglás algo, dejá una prueba

`pnpm verificar` corre las pruebas de regresión en un navegador real. Cada cosa de esta lista se
había roto sin que nadie se enterara, y se descubrió recién cuando una persona la probó a mano.
Un arreglo sin prueba se vuelve a romper. El agente `regresiones` se ocupa de eso.
