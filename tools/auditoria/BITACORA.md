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

## Corregido, sin prueba todavía

Candidatos a la próxima prueba. El que agregue una, la mueve a la tabla de arriba.

- **Guardar el perfil no avisaba** (20/9). Ahora el panel muestra "Listo, guardamos los cambios
  de tu perfil". Verificado a mano, sin prueba automática.
- **La base que falla ya no muestra pintores inventados** (20/9). Cuesta probarlo sin poder
  cortarle la base a la app; se podría interceptar la conexión desde el navegador.
- **Se podía cotizar con comisión cero** (22/9). Verificado contra la base: la policy había
  perdido la aritmética de la comisión al reescribirse en 0015 y 0016. Migración **0018** la
  restaura. Una prueba tendría que insertar por la API con la clave anon.
- **`recalc_profile_rating` la ejecutaba cualquiera sin cuenta** (22/9). Revocado en 0018.
- **Una base caída decía "esta página no existe"** (22/9): 404 para la persona y para Google,
  cuando la página sí existe. Ahora se separa "no existe" de "no se pudo leer".
- **El sitemap mandaba a indexar los pintores y obras inventados** (22/9). Con
  `NEXT_PUBLIC_DATOS_DEMO` (true por defecto) sólo se publican las páginas fijas.
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

## Abierto

- **El primer clic del simulador congela la pantalla ~400 ms** (medido en producción, celular de
  gama media). Es la varita recorriendo la imagen. Se arreglaría de verdad moviendo el cálculo a
  un Web Worker con OffscreenCanvas. **Severidad: menor, pero se nota.**
- **La app móvil mantiene una copia de las reglas** en vez de importar `packages/dominio`: Metro
  necesita configuración para resolver paquetes del monorepo, y no se puede probar sin levantar
  la app. Hay una prueba que avisa si las dos copias se desincronizan. **Severidad: deuda.**
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
- **Los enlaces del pie miden 17-20 px de alto** (el piso es 24). Es de todo el sitio, no de
  una pantalla. **Severidad: menor.**
- **Derecho de arrepentimiento (Ley 24.240):** el cliente acepta una cotización online y recién
  ahí conoce al pintor. Si eso cuenta como contratación a distancia, podría haber 10 días de
  arrepentimiento que el sitio no menciona. **No es una certeza: es la pregunta para el
  abogado.**

## Descartado (se midió y no era)

No los vuelvas a levantar sin evidencia nueva.

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

## Decisión del dueño (no son bugs)

- Todos los datos visibles son de demostración: pintores, reseñas y obras inventados.
- La paleta de colores es de muestra; las marcas no la proveyeron. La interfaz lo avisa.
- No hay `RESEND_API_KEY`: no salen emails.
- `/publicar` no tiene descripción libre ni presupuesto numérico: se arma solo y se elige de una
  lista.
