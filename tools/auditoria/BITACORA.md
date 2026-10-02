# Bitácora de hallazgos — Pintura Pro

La memoria del sistema. Sin esto, cada ronda de auditoría vuelve a descubrir lo mismo, y lo que
se arregló hace dos semanas se rompe sin que nadie se entere.

**Si sos un agente:** leé esto antes de reportar. Lo que figura como `corregido` no se reporta de
nuevo — salvo que lo veas ROTO otra vez, y en ese caso es un hallazgo mucho más grave, porque
significa que volvió.

**Si estás cerrando una ronda:** agregá acá lo que se encontró, con su estado, y anotá si quedó
una prueba que lo vigile. Un arreglo sin prueba se vuelve a romper; es lo que pasó con todo lo
que está más abajo.

Estados: `abierto` · `corregido` · `descartado` (se miró y no era un problema) · `decisión del dueño`

---

## Corregido y vigilado por una prueba

Estos ya no se reportan. `pnpm verificar` los revisa en cada corrida.

| Qué se rompía | Cómo se veía | Prueba que lo cuida |
|---|---|---|
| Cualquier cuenta podía hacerse pasar por pintor | Una clienta entró a /trabajos, cotizó el pedido de otra clienta por $111.111 y se creó | `seguridad-roles` |
| Un cliente podía publicar obras de portfolio | El formulario cargaba entero y fallaba recién al enviar | `seguridad-roles` |
| Un texto largo rompía las páginas públicas | Un título de 10.000 caracteres dejó /trabajos en 254.443 px de ancho, para todos | `textos-largos` |
| Los filtros de /obras no filtraban | "Industrial", sin ninguna obra, seguía mostrando las tres | `filtros-obras` |
| El pintor llenaba cotizaciones condenadas | Ya había cotizado, pero el botón seguía ahí; fallaba al enviar | `ya-cotizado` |
| Tres clics creaban tres consultas | La bandeja del dueño recibía el mismo mensaje tres veces | `doble-envio` |
| El simulador agarraba media pared | 54% de una pared con luz de ventana | `simulador-calidad` |
| La textura dependía del color | 0,48 con Marfil, 0,79 con Negro Mate: con oscuros la pared salía más contrastada que la foto real | `simulador-calidad` |
| Recargar borraba el formulario | /cotizar volvía al paso 1 en blanco, sin aviso | `borrador` |
| Controles de 6 px | Los puntos de los carruseles; "Editar", "Borrar" y "Retirar cotización" de 17 px | `tactil` |
| Foto de 30 MP dejaba sin salida | El rechazo abría el editor vacío sin selector de archivos: sólo se salía recargando | `foto-rechazada` |
| La pintura se pasaba 2 px sobre molduras | De manchar el 16,8% de una moldura a 2,5% | `sangrado-moldura` |
| Con teclado no se podía avanzar en /cotizar | Enter en "Continuar" mandaba el foco al `<body>` y tabear seguía a las preguntas frecuentes: el campo del paso nuevo nunca se alcanzaba | `accesibilidad` |
| "Continuar" deshabilitado no se podía enfocar | Quien usa teclado no podía ni acercarse a averiguar qué faltaba | `accesibilidad` |
| Los carruseles y el scroll ignoraban "reducir movimiento" | Seguían pasando solos cada 5-6 s con la preferencia activada | `accesibilidad` |
| El menú del celular no cerraba con Escape | `aria-expanded` seguía en true | `accesibilidad` |
| Texto por debajo del piso de contraste | Iniciales del pintor 2,38:1 e inicial del equipo 1,49:1, con piso de 3:1 | `accesibilidad` |
| El móvil convertía "150.000,50" en $15.000.050 | Copia vieja del parser de montos: cien veces más, en una cotización que el cliente acepta | `reglas-compartidas` |
| El móvil no validaba largos ni traducía el error 23514 | Se escribían 2.000 caracteres para leer "No pudimos completar la acción" | `reglas-compartidas` |
| "Publicar trabajo" quedaba cortado en el panel del cliente | La fila de tres botones medía 495 px en una pantalla de 390, sin scroll ni forma de llegar al botón: se veían sus primeros 41 px | `desborde-celular` |
| La foto reemplazada quedaba pública para siempre | Cambiar la portada de una obra subía la nueva y dejaba la anterior viva en el almacenamiento: el sitio no la mostraba más y la dirección seguía abriendo. Lo mismo con la foto de perfil | `foto-reemplazada` |
| El archivo "mis datos" no incluía las fotos | Devolvía nombre, zona y reseñas, y omitía lo más personal que guarda el sitio: la cara de la persona y el interior de casas | `mis-datos` |
| El simulador no se podía usar sin mouse | El lienzo es un canvas: no se enfocaba, no tenía nombre y no escuchaba el teclado. La función principal del sitio no existía para quien navega con teclado, y tampoco había un aviso | `simulador-teclado` |
| Las Server Actions se rompían con un cuerpo inesperado | `[null]` a la acción de dar de baja devolvía 500 con `Cannot read properties of null (reading 'trim')`; el mismo cuerpo contra `/contacto` rompía las tres acciones de formulario. El tipo dice `string` o `FormData` y por la red llega lo que el que llama quiera | `acciones-hostiles` |
| El parser de montos adivinaba en vez de rechazar | `1,500,000` (monto copiado de una planilla en inglés) salía **1**: el pintor cotizaba UN PESO creyendo cotizar un millón y medio. `1500.50` daba 150.050 y `1.50E+06` daba 15.006 —creíble, nadie sospecha—. El defecto estaba en las dos copias por igual, así que la prueba de sincronía no lo veía | `reglas-compartidas` |
| Las estrellas de la reseña no decían cuál estaba elegida | La única señal era el color: quien usa lector de pantalla calificaba a una persona sin saber con cuánto. Y el comentario no tenía más nombre que su texto de ejemplo, que se va al escribir | `accesibilidad` |
| `sharp` con ejecución remota de código en el procesado de fotos | 0.35.3 traía libheif vulnerable (GHSA-rgj7-g3m4-5g8c), justo en lo que procesa las fotos que sube la gente, en Linux con glibc como Cloud Run | `dependencias-seguras` |
| Cambiar la contraseña con una sesión que sólo quedó abierta | /nueva-contrasena aceptaba cualquier sesión: en una compu compartida se fijaba una contraseña nueva sin saber la actual y la cuenta cambiaba de dueño | `nueva-contrasena` |
| Pantallas con el título genérico del sitio | /recuperar, /nueva-contrasena, el panel del pintor y la página de error decían "Transformamos espacios con color"; la de error parecía una página que existe | `titulos` |
| Con el texto del celular agrandado, el menú quedaba fuera de la pantalla | Al 200 % los puntos del carrusel y el selector Interior/Exterior no bajaban de línea, la página se estiraba y el encabezado fijo con ella | `desborde-celular` |
| Enlaces de 17 px en todo el sitio | El pie, la barra y /trabajos, reportados por cinco agentes: `tactil` medía sólo botones y salteaba el pie a propósito, así que nada podía ponerse en rojo | `tactil` |
| Dos fórmulas para la misma comisión | El pintor veía `comisionDe` y se guardaba `commissionFor`; daban igual pero nada las ataba (ya se mostró 8 % guardando 10 %) | `reglas-compartidas` |
| Una imagen de 1.600 megapíxeles publicada como portada | El servidor miraba firma y peso, no píxeles: un PNG liso de 40.000 × 40.000 pesa 4,7 MB y cada visita a /obras intentaba decodificar 6,4 GB | pruebas del paquete (`packages/dominio/pruebas.ts`, corren dentro de `reglas-compartidas`) |
| /admin y /panel se abrían con el rol "empresa" | El rol lo elige cualquiera en el alta; alcanzaba para ver las cifras del marketplace y la bandeja de consultas | `admin-panel-empresa` |
| Tres clics en "Publicar trabajo" creaban tres pedidos | Cada envío arma su propio slug, así que el índice único no los frenaba | `duplicados-publicar` |
| Guardar el perfil no avisaba | La persona volvía al panel sin saber si el cambio entró, y guardaba de nuevo por las dudas | `perfil-guardado` |
| El sitemap mandaba a indexar datos de demostración | Los pintores y obras inventados están en la base como filas normales y el filtro los dejaba pasar | `sitemap-demo` |
| La caché de las páginas públicas mostraba datos viejos | Sin limpiar la caché al guardar, el perfil público seguía con la bio anterior hasta un minuto (29/9) | `cache-publico` |
| Nadie veía el autor de una reseña | La caché lee como anónimo, que no puede leer perfiles de clientes: "Cliente" hasta para la autora (29/9) | `autor-de-resenas` |
| El móvil tenía su propia copia de las reglas | Parser de montos, comisión (`* 0.1` a mano), topes y errores duplicados; ya se habían desincronizado una vez | `reglas-compartidas` |
| Los formularios de pasos no decían qué faltaba | "Completá los datos de este paso" aunque faltaran dos campos distintos | `formularios-de-pasos`, `accesibilidad` |
| Al publicar, el foco quedaba en la página | El formulario desaparece y un lector de pantalla no se entera de que funcionó | `formularios-de-pasos` |
## Corregido, sin prueba todavía

Candidatos a la próxima prueba. El que agregue una, la mueve a la tabla de arriba.

- **La base que falla ya no muestra pintores inventados** (20/9). Cuesta probarlo sin poder
  cortarle la base a la app; se podría interceptar la conexión desde el navegador.
- **Se podía cotizar con comisión cero** (22/9). Verificado contra la base: la policy había
  perdido la aritmética de la comisión al reescribirse en 0015 y 0016. Migración **0018** la
  restaura. Una prueba tendría que insertar por la API con la clave anon.
- **`recalc_profile_rating` la ejecutaba cualquiera sin cuenta** (22/9). Revocado en 0018.
- **Una base caída decía "esta página no existe"** (22/9): 404 para la persona y para Google,
  cuando la página sí existe. Ahora se separa "no existe" de "no se pudo leer".
- **Nadie le decía al pintor que se le cobra 10%** (22/9). Ahora está en el formulario de
  cotizar y en /terminos.
- **El simulador congelaba la pantalla 363 ms al cambiar de color** (22/9). Ahora 241 ms, con
  las tablas de conversión. La prueba `simulador-calidad` ya vigila que el color no cambie;
  faltaría una que vigile el tiempo.
- **La ubicación del pintor salía con precisión de 11 metros** (25/9), aunque /privacidad promete
  "a nivel de zona". Confirmado con la clave anon y sin sesión. Migración **0020** redondea a dos
  decimales (~1,1 km) dentro de la función, no en la columna. De paso se sacó `projects` del
  grant a nivel tabla: tiene las mismas dos columnas `lat`/`lng` que ya habían filtrado el
  domicilio de los clientes en otra tabla. Probarlo pide la clave anon.
- **La radiografía del kit no veía los desbordes** (25/9). `auditar()` comparaba contra
  `window.innerWidth`, que el navegador agranda hasta el tamaño del contenido cuando algo se
  desborda sin recorte: medía 495 en una pantalla de 390 y concluía que todo entraba. Ahora usa
  `document.documentElement.clientWidth`. **Cualquier ronda anterior pudo haber dejado pasar
  desbordes por esto.**

- **El monto que se veía no era el que se guardaba** (28/9). Pisando el campo sin avisarle a
  React la pantalla decía $100.000 y se guardó $1. Ahora se manda lo que se muestra.
- **/recuperar mandaba un mail por clic y decía "Revisá tu correo" ante un email rechazado**
  (28/9). Cerrojo, validación de formato y errores visibles.
- **`leads` aceptaba inserción directa con la clave pública** (27/9), salteando el anti-spam:
  0022. Verificado a mano (401). Una prueba tendría que insertar con la clave anon.
- **`is_admin` legible sin cuenta** (27/9): 0023 y `es_admin()`. `admin-panel-empresa`
  cubre el acceso; la lectura de la columna no tiene prueba.
- **Datos personales en los registros** (28/9): el asunto de los mails llevaba nombres.
- **El mapa no se podía usar con teclado** (28/9): Enter en un marcador no hacía nada.
- **La barra bajaba el cliente de Supabase en cada página** (28/9): 52 KB comprimidos para
  leer un sí o un no. La portada pasó de 202 a 138 KB de JavaScript.
- **La app móvil**: cancelar, presupuesto inválido, monto interpretado, aviso de reseña y
  acceso a los datos (27/9). No se puede correr la app desde el Codespace.

- **Las páginas públicas consultaban la base en cada visita** (29/9): salían `private, no-store`
  por una sola causa (el cliente de Supabase lee las cookies). Ahora un cliente sin cookies y
  caché de datos de 60 s (`lib/cache-publico.ts`). La portada: 1.505 → 166 ms con 10 visitas a
  la vez. `cache-publico` vigila la limpieza; el tiempo no tiene prueba (se mide con
  `tools/auditoria/escala/carga.mjs`).
- **Ninguna página tenía imagen al compartirla** (29/9): Next reemplaza entero el `openGraph`
  del layout. `lib/tarjeta.ts` + `/og.png`. Lo mira el vigilante 24/7 (`compartir()`), no una
  prueba de regresión.
- **"Verificado" en el perfil del pintor sin ningún proceso detrás** (29/9, riesgo-legal).
- **El pie de los mails decía "Pintura profesional de obra"** (29/9, riesgo-legal).
- **El cliente no sabía que su pedido es público**, y /trabajos estaba en el sitemap (29/9):
  aviso en /publicar y /privacidad; `noindex`. Lo mira el vigilante.
- **/registro prometía "activar tu perfil"**, el móvil decía "pintores verificados" y abría
  `pinturapro.app` (29/9, contenido-confianza).
- **Un pintor sin reseñas mostraba "★ 0.0"** (29/9): se lee como una nota pésima. Los datos demo
  no tienen ningún pintor sin reseñas: por eso nadie lo había visto, y por eso no tiene prueba.
- **El pintor no volvía a ver su comisión después de cotizar** (29/9): ahora en cada fila de su panel.
- **El build bajaba las tipografías de Google** y una compilación falló ahí (28/9): ahora en el
  repo, y acotadas a los pesos que se usan (111 → 79,6 KB por página).
- **La fecha de los textos legales no cambiaba** aunque el texto sí (1/10).

## Abierto

- **El primer clic del simulador congela la pantalla 400-724 ms** (re-medido el 28/9 por `rendimiento`, 3 corridas; antes figuraba ~400) (medido en producción, celular de
  gama media). Es la varita recorriendo la imagen. Se arreglaría de verdad moviendo el cálculo a
  un Web Worker con OffscreenCanvas. **Severidad: menor, pero se nota.**
- **Faltan datos legales del responsable** (razón social, CUIT, domicilio). La pantalla ahora lo
  avisa en vez de aparentar estar completa, pero el dato lo tiene que poner el dueño. Además de
  la Ley 25.326 (AAIP), es un requisito de la normativa de comercio electrónico de Defensa del
  Consumidor: la misma falta, con dos organismos que la pueden mirar.
- **Volver a "Intensidad" después de elegir un color cuesta 8 Shift+Tab.** El control vive en
  el DOM del simulador, ANTES de la grilla de colores, que la dibuja la página; en la tarea
  real se usa DESPUÉS. Arreglarlo es mover contenido entre dos componentes, no un ajuste.
  **Severidad: molesto, no bloqueante.**
- **No hay "Deshacer" en el simulador**, ni con mouse ni con teclado: sólo "Limpiar selección",
  que borra todo de una vez. Afecta a todos por igual. **Severidad: menor.**
- **Derecho de arrepentimiento (Ley 24.240):** el cliente acepta una cotización online y recién
  ahí conoce al pintor. Si eso cuenta como contratación a distancia, podría haber 10 días de
  arrepentimiento que el sitio no menciona. **No es una certeza: es la pregunta para el
  abogado.**

- **Un pintor puede publicar un pedido** en /publicar (sólo se pide sesión). No rompe nada;
  es una pregunta de producto para el dueño. **Severidad: decisión.**

- **Migraciones 0024 y 0025 escritas y probadas, SIN aplicar** (29/9). 0024: los números de la
  portada calculados en la base (hoy la app baja todas las reseñas y la API corta en 1.000),
  el tablero con "ver anteriores" (hoy muestra los 50 pedidos más nuevos y el resto desaparece
  para siempre), tres índices, las 14 policies envueltas en `(select …)`, y `es_service_role`
  cerrada. 0025: las preguntas frecuentes de la base dicen "pintamos" y "nuestro equipo", y una
  novedad anuncia "pintores verificados". El clasificador de permisos frenó aplicarlas y
  commitearlas: **las tiene que autorizar el dueño**. Después falta conectar la web
  (`getNumerosReales` → `resumen_publico()`, y la paginación de /trabajos).
- **Topes sin "ver más"** (escala-y-volumen, 29/9): el directorio, el mapa y el sitemap muestran
  60 pintores; /obras, 60 obras. El número 61 no aparece en ningún lado. Con 3 pintores no se
  nota. **Hay que resolverlo antes de llegar a 60.**
- **Los trabajos de `getPedidosDelCliente` no tienen límite**: un cliente con más de 1.000
  cotizaciones entre sus pedidos vería estados equivocados en su panel. Lejos hoy.
  (`getPedidosYaCotizados` ya se acotó a los pedidos en pantalla, 1/10.)
- **Los contadores del panel del pintor y del cliente** ("trabajos completados", "activos") se
  cuentan sobre los últimos 50 trabajos. **Severidad: menor.**
- **El almacenamiento de fotos es el límite real del plan** (integridad-datos): una foto de obra
  pesa ~295 KB; 3.000 pintores con una sola obra ya pasan el 1 GB gratuito.
- **En Cloud Run, la caché de las páginas públicas vive en cada instancia**: quien cambia su
  perfil lo ve al instante (con `--session-affinity`), los demás hasta un minuto después.
- **Sin captcha en el alta ni en /recuperar** (abuso-marketplace): es configuración de Supabase.
- **Las fotos de /obras se ven borrosas en celulares de alta densidad** (rendimiento, 1/10): son
  apaisadas, metidas en tarjetas verticales; hay que agrandarlas 2,1×. Son fotos de stock demo.
- **Cotización de prueba sin retirar**: $550.000 de Martín (cuenta `pintor`) sobre el pedido demo
  "Pintura completa de PH en Barracas". La dejó el script de un agente; el sistema de permisos
  le bloqueó retirarla. Se retira desde /dashboard con esa cuenta.

## Descartado (se midió y no era)

No los vuelvas a levantar sin evidencia nueva.

- **"Enter y un clic dan máscaras distintas en el simulador".** Llaman a la misma función con
  la misma fracción; la diferencia de 1 px venía de que un clic de mouse se redondea a píxeles
  CSS enteros (0,3987 en vez de 0,4). Para compararlos hay que darles la misma fracción exacta.

- **"La baja de cuenta acepta 'eliminar' en minúscula".** Es a propósito. El paso está para
  frenar el clic distraído, no para tomar un dictado: quien escribió la palabra en un campo que
  pide escribirla, decidió. Lo que sí importaba —y se revisó— es que la pantalla y el servidor
  usen el MISMO criterio, para que el botón no se vea apagado con un texto que el servidor
  después acepta. Usan el mismo. Y el botón no se deshabilita de verdad a propósito: un botón
  deshabilitado no se puede enfocar y quien usa teclado no puede averiguar qué le falta, que es
  el problema que ya está más arriba en esta misma tabla.

- **"Las páginas 404 quedan en blanco".** Pasa sólo en modo desarrollo, donde compilar la ruta
  tarda: la página aparece un segundo después. En la compilación de producción se ve entera de
  entrada (verificado con `pnpm build` + `pnpm start`).
- **"El simulador no responde al toque en celular".** Era un error del script de prueba: al tocar
  el color, la página se desplazaba y el `boundingBox()` tomado antes quedaba viejo, así que el
  toque siguiente caía en otro lado. Con un dedo real pinta el 56% de la pared.
- **"Publicar obra duplica con tres clics".** Medido: crea una sola fila.
- **"Secciones vacías en la home".** Son animaciones que aparecen al hacer scroll.
- **"La web pesa 3 MB y tarda 18 segundos".** Era el modo desarrollo. Medido contra la
  compilación de producción con 4G flojo y el procesador frenado cuatro veces: la home pesa
  324 KB y carga en 2,2 s. Cualquier medición de peso o de carga hecha en desarrollo no sirve.
- **"Hay claves filtradas en el repositorio".** Se escanearon los 82 commits del historial: no
  hay ninguna. El único hallazgo era un ejemplo de documentación.

- **"/trabajos muestra el nombre completo de los clientes sin sesión"** (buscadores, 29/9): falso.
  Sin sesión dice "Cliente": RLS no deja leer perfiles de clientes a un anónimo. Se dedujo del
  código sin medirlo.
- **"`getProjects` tarda 893 ms y el panel del admin 1,9 s con 300.000 filas"** (escala-y-volumen,
  29/9): no se repitió (62 ms y 54 ms en la segunda corrida). Era la primera lectura de filas
  recién insertadas. Con volumen sintético hay que medir dos veces.
- **"El enlace a una obra borrada sigue en los listados por la caché"** (recorrido-web, 29/9): no
  era la caché, que se limpia al instante (`cache-publico`); la obra la borró otro agente
  mientras el visitante miraba una página ya cargada.

## Tareas del dueño en paneles externos (no se hacen desde el código)

- **Supabase → Authentication → URL Configuration.** Hoy la "Site URL" es la del Codespace y
  `…/nueva-contrasena` no está en "Redirect URLs": medido el 28/9, el enlace de recuperación
  IGNORA el destino pedido y manda a la portada del Codespace. En producción, quien olvidó la
  contraseña terminaría en una dirección muerta. Poner la Site URL del dominio real y agregar
  `https://<dominio>/nueva-contrasena` y `https://<dominio>/auth/callback`.
- **Supabase → Authentication → Email → "Secure password change".** La pantalla ya pide la
  contraseña actual si la sesión no viene del mail, pero eso frena a quien usa la pantalla,
  no a quien tenga el token y llame a la API directo. Esa opción lo frena en el servidor.
- **Rotar la contraseña de la base** (Settings → Database): se pegó en el chat el 27/9.

- **Supabase → Authentication: SMTP propio.** Los mails de confirmar cuenta y recuperar
  contraseña salen por el servidor de fábrica de Supabase, que es para pruebas y tiene un tope
  de pocos por hora. Con 50 altas en una hora, la mayoría no recibe nada (escala-y-volumen, 29/9).
- **Supabase → Authentication: captcha** (Turnstile, gratis) en el alta y en recuperar: hoy un
  programa puede crear cuentas o llenarle el correo a un tercero sin tope propio.
- **Supabase → Authentication: tope de intentos de ingreso.** El sitio no tiene freno propio
  contra probar contraseñas en /ingresar: el login va directo a Supabase. Seis intentos fallidos
  seguidos no activaron ningún bloqueo (sesiones-y-acceso, 1/10). Se configura en el panel.
- **AAIP: inscribir la base de datos personales** (Ley 25.326). Trámite gratuito, con CUIT; es
  distinto de identificar al responsable, que también falta (riesgo-legal, 29/9).
- **Preguntarle al abogado** por el botón de arrepentimiento (Res. 424/2020) aplicado a un
  intermediario que no vende.

## Decisión del dueño (no son bugs)

- Todos los datos visibles son de demostración: pintores, reseñas y obras inventados.
- La paleta de colores es de muestra; las marcas no la proveyeron. La interfaz lo avisa.
- No hay `RESEND_API_KEY`: no salen emails.
- `/publicar` no tiene descripción libre ni presupuesto numérico: se arma solo y se elige de una
  lista.
- **Cómo se cobra la comisión** (29/9, dinero-y-comisiones): la base guarda el 10 % de cada
  trabajo pero no hay cobro, ni estado "pagada", ni deuda por pintor, ni aviso al completar. El
  mínimo para empezar está en `tools/auditoria/rondas/2026-09-28-escala/dinero-y-comisiones.md`.
- **¿El nombre del autor de una reseña se le muestra a quien no tiene cuenta?** Hoy no (0013):
  el anónimo ve "Cliente". Mostrar el nombre de pila daría más confianza y expone más.
- **¿El tablero /trabajos va a Google?** Hoy no (`noindex`, 29/9): son pedidos de personas.

