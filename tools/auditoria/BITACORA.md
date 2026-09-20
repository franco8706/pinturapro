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

## Corregido, sin prueba todavía

Candidatos a la próxima prueba. El que agregue una, la mueve a la tabla de arriba.

- **Guardar el perfil no avisaba** (20/9). Ahora el panel muestra "Listo, guardamos los cambios
  de tu perfil". Verificado a mano, sin prueba automática.
- **La base que falla ya no muestra pintores inventados** (20/9). Cuesta probarlo sin poder
  cortarle la base a la app; se podría interceptar la conexión desde el navegador.

## Abierto

- **En desarrollo, la consola muestra errores crudos de Postgres** (`invalid input syntax for type
  uuid`) al pedir un pintor con un id inventado. No se ve en pantalla. Falta confirmar que en
  producción no aparezca. **Severidad: menor.**
- **Quedan consultas públicas que caen a datos de demostración si la base falla.** Las dos que
  más importan ya avisan en vez de inventar (el directorio de pintores y el portfolio, 20/9),
  pero faltan repasar las demás: obras por slug, perfil de pintor, novedades y recursos.
  **Severidad: importante antes de publicar.**
- **`/simulador` no se puede usar con teclado.** El lienzo es un canvas y se pinta con clics: hoy
  no hay ninguna alternativa ni aviso. **Severidad: importante, y no tiene arreglo rápido.**

## Descartado (se midió y no era)

No los vuelvas a levantar sin evidencia nueva.

- **"Las páginas 404 quedan en blanco".** Pasa sólo en modo desarrollo, donde compilar la ruta
  tarda: la página aparece un segundo después. En la compilación de producción se ve entera de
  entrada (verificado con `pnpm build` + `pnpm start`).
- **"El simulador no responde al toque en celular".** Era un error del script de prueba: al tocar
  el color, la página se desplazaba y el `boundingBox()` tomado antes quedaba viejo, así que el
  toque siguiente caía en otro lado. Con un dedo real pinta el 56% de la pared.
- **"Publicar obra duplica con tres clics".** Medido: crea una sola fila.
- **"Secciones vacías en la home".** Son animaciones que aparecen al hacer scroll.

## Decisión del dueño (no son bugs)

- Todos los datos visibles son de demostración: pintores, reseñas y obras inventados.
- La paleta de colores es de muestra; las marcas no la proveyeron. La interfaz lo avisa.
- No hay `RESEND_API_KEY`: no salen emails.
- `/publicar` no tiene descripción libre ni presupuesto numérico: se arma solo y se elige de una
  lista.
