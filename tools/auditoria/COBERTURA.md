# Mapa de cobertura — Pintura Pro

Generado por `node tools/auditoria/cobertura.mjs` el 2026-10-03. **No se edita a mano**: se vuelve a generar.

🟢 lo nombra una prueba de regresión · 🟡 sólo un agente o el vigilante · 🔴 no lo nombra nadie

**Total:** 47 🟢 · 28 🟡 · 12 🔴 — 32 archivos de prueba, 21 agentes.

Que algo esté 🟢 no quiere decir que esté bien probado: quiere decir que alguien lo nombra. Lo 🔴
seguro que no lo mira nadie. El agente `retroalimentacion` lee este archivo al cerrar cada ronda.

## Pantallas (34)

Las páginas que ve la gente. 🔴 = ninguna prueba, agente ni vigilante la nombra.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `/cuenta-eliminada` | — | — | — |
| 🟡 | `/bienvenida` | — | buscadores, sesiones-y-acceso | — |
| 🟡 | `/dashboard/editar/[slug]` | — | sesiones-y-acceso | — |
| 🟢 | `/` | accesibilidad, desborde-celular, perfil-guardado, tactil | accesibilidad, buscadores, dependencias, dinero-y-comisiones, escala-y-volumen, formularios-hostiles, rendimiento, seguridad-rls, simulador-color | sí |
| 🟢 | `/admin` | admin-panel-empresa, moderacion-resenas | abuso-marketplace, buscadores, contenido-confianza, sesiones-y-acceso | sí |
| 🟢 | `/aprender` | titulos | buscadores | — |
| 🟢 | `/asesoramiento` | titulos | buscadores | — |
| 🟢 | `/cliente` | accesibilidad, ciclo-de-trabajo, desborde-celular, seguridad-roles | buscadores, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/colores` | titulos | buscadores | — |
| 🟢 | `/contacto` | accesibilidad, acciones-hostiles, desborde-celular, doble-envio, duplicados-publicar, titulos | abuso-marketplace, buscadores, formularios-hostiles | sí |
| 🟢 | `/cotizaciones` | ciclo-de-trabajo | buscadores, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/crear-cuenta` | admin-panel-empresa, titulos | — | — |
| 🟢 | `/dashboard` | admin-panel-empresa, ciclo-de-trabajo, desborde-celular, foto-reemplazada, moderacion-resenas, perfil-guardado, ya-cotizado | dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/dashboard/nueva-obra` | acciones-hostiles, seguridad-roles | sesiones-y-acceso | — |
| 🟢 | `/dashboard/perfil` | acciones-hostiles, cache-publico, perfil-guardado | sesiones-y-acceso | — |
| 🟢 | `/ingresar` | mis-datos, titulos | accesibilidad, recorrido-web, sesiones-y-acceso | — |
| 🟢 | `/mapa` | titulos | buscadores | — |
| 🟢 | `/mi-cuenta` | acciones-hostiles, desborde-celular, mis-datos | buscadores, riesgo-legal, sesiones-y-acceso | sí |
| 🟢 | `/mi-panel` | admin-panel-empresa | sesiones-y-acceso | — |
| 🟢 | `/nosotros` | accesibilidad, titulos | buscadores, contenido-confianza, recorrido-web, riesgo-legal | — |
| 🟢 | `/novedades` | titulos | buscadores | — |
| 🟢 | `/nueva-contrasena` | nueva-contrasena, titulos | sesiones-y-acceso | — |
| 🟢 | `/obras` | desborde-celular, filtros-obras, sitemap-demo, tactil, textos-largos, titulos | buscadores, escala-y-volumen, formularios-hostiles, rendimiento | sí |
| 🟢 | `/obras/[slug]` | titulos | buscadores | — |
| 🟢 | `/panel` | admin-panel-empresa | contenido-confianza, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/pintor/[id]` | autor-de-resenas, cache-publico | accesibilidad, buscadores, escala-y-volumen, riesgo-legal | — |
| 🟢 | `/pintores` | accesibilidad, desborde-celular, sitemap-demo, tactil, textos-largos, titulos | buscadores, contenido-confianza, escala-y-volumen, rendimiento | sí |
| 🟢 | `/privacidad` | autor-de-resenas, desborde-celular, titulos | buscadores, contenido-confianza, riesgo-legal | sí |
| 🟢 | `/publicar` | accesibilidad, acciones-hostiles, borrador, ciclo-de-trabajo, desborde-celular, duplicados-publicar, formularios-de-pasos, tope-por-hora | accesibilidad, buscadores, formularios-hostiles, recorrido-web, rendimiento, sesiones-y-acceso | sí |
| 🟢 | `/recuperar` | titulos | abuso-marketplace | — |
| 🟢 | `/registro` | duplicados-publicar, formularios-de-pasos, titulos | accesibilidad, contenido-confianza, formularios-hostiles | — |
| 🟢 | `/simulador` | desborde-celular, foto-rechazada, sangrado-moldura, simulador-calidad, simulador-deshacer, simulador-teclado, tactil, titulos | accesibilidad, buscadores, rendimiento, simulador-color | sí |
| 🟢 | `/terminos` | desborde-celular, moderacion-resenas, titulos | buscadores, contenido-confianza, riesgo-legal | sí |
| 🟢 | `/trabajos` | acciones-hostiles, ciclo-de-trabajo, desborde-celular, seguridad-roles, tactil, textos-largos, titulos, ya-cotizado | buscadores, dinero-y-comisiones, recorrido-web | sí |

## Puntos de la API (6)

Lo que se puede llamar sin pasar por una pantalla.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🟡 | `/api/health` | — | listo-para-publicar | sí |
| 🟡 | `/api/segment` | — | abuso-marketplace, escala-y-volumen, listo-para-publicar, nube-google | — |
| 🟡 | `/api/sesion` | — | rendimiento, sesiones-y-acceso | — |
| 🟡 | `/auth/callback` | — | sesiones-y-acceso | — |
| 🟡 | `/auth/signout` | — | sesiones-y-acceso | — |
| 🟢 | `/api/mis-datos` | acciones-hostiles, mis-datos | — | sí |

## Acciones de servidor (15)

Son endpoints aunque se escriban como funciones (REGLAS). Que una prueba recorra la pantalla del formulario no aparece acá: se cuenta sólo si alguien nombra la acción.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `borrarResena` | — | — | — |
| 🔴 | `createObra` | — | — | — |
| 🔴 | `enviarConsulta` | — | — | — |
| 🔴 | `guardarTelefono` | — | — | — |
| 🔴 | `postularmeComoPintor` | — | — | — |
| 🔴 | `updateObra` | — | — | — |
| 🟢 | `aceptarCotizacion` | ciclo-de-trabajo | dinero-y-comisiones | — |
| 🟢 | `cancelarTrabajo` | ciclo-de-trabajo | — | — |
| 🟢 | `cotizar` | accesibilidad, acciones-hostiles, borrador, ciclo-de-trabajo, desborde-celular, reglas-compartidas, seguridad-roles, ya-cotizado, dominio/pruebas.ts | abuso-marketplace, accesibilidad, app-movil, buscadores, dinero-y-comisiones, formularios-hostiles, recorrido-web, riesgo-legal, seguridad-rls | sí |
| 🟢 | `dejarResena` | ciclo-de-trabajo | — | — |
| 🟢 | `deleteObra` | foto-reemplazada | — | — |
| 🟢 | `eliminarMiCuenta` | acciones-hostiles | — | — |
| 🟢 | `marcarCompletado` | ciclo-de-trabajo | — | — |
| 🟢 | `publicarTrabajo` | acciones-hostiles | formularios-hostiles | — |
| 🟢 | `updateProfile` | perfil-guardado | — | — |

## Tablas de la base (9)

Sacadas de `supabase/migrations/`.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `registro_de_pedidos` | — | — | — |
| 🟡 | `faqs` | — | contenido-confianza | — |
| 🟡 | `news` | — | contenido-confianza | — |
| 🟡 | `resources` | — | contenido-confianza | — |
| 🟢 | `jobs` | ciclo-de-trabajo, moderacion-resenas, ya-cotizado | abuso-marketplace, dinero-y-comisiones, integridad-datos | — |
| 🟢 | `leads` | doble-envio | abuso-marketplace, formularios-hostiles, seguridad-rls | — |
| 🟢 | `profiles` | admin-panel-empresa, autor-de-resenas, cache-publico, ciclo-de-trabajo, moderacion-resenas, tope-por-hora | contenido-confianza, escala-y-volumen, integridad-datos, riesgo-legal | — |
| 🟢 | `projects` | ciclo-de-trabajo, duplicados-publicar, formularios-de-pasos, foto-reemplazada, tope-por-hora | integridad-datos | — |
| 🟢 | `reviews` | autor-de-resenas, ciclo-de-trabajo, moderacion-resenas | abuso-marketplace, integridad-datos | — |

## Funciones de la base (23)

Cada una necesita `revoke ... from public, anon` al crearse (ver REGLAS, trampas de la base).

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `fecha_de_alta_fija` | — | — | — |
| 🔴 | `limites_de_cotizacion` | — | — | — |
| 🔴 | `resumen_publico` | — | — | — |
| 🔴 | `tope_de_pedidos` | — | — | — |
| 🟡 | `actividad_reciente` | — | seguridad-rls | — |
| 🟡 | `contacto_del_trabajo` | — | seguridad-rls | — |
| 🟡 | `enforce_job_rules` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `es_admin` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `es_service_role` | — | seguridad-rls | — |
| 🟡 | `freeze_profile_trust_fields` | — | seguridad-rls | — |
| 🟡 | `handle_new_user` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `metricas_plataforma` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `mi_telefono` | — | seguridad-rls | — |
| 🟡 | `on_job_accepted` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `on_job_cancelled` | — | seguridad-rls | — |
| 🟡 | `on_review_change` | — | seguridad-rls | — |
| 🟡 | `pedidos_abiertos` | — | abuso-marketplace, escala-y-volumen, seguridad-rls | — |
| 🟡 | `pintores_geolocalizados` | — | seguridad-rls | — |
| 🟡 | `recalc_profile_rating` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `set_updated_at` | — | seguridad-rls | — |
| 🟡 | `una_sola_adjudicacion` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `volumen_mensual` | — | seguridad-rls | — |
| 🟢 | `es_pintor` | seguridad-roles | abuso-marketplace, app-movil, escala-y-volumen, seguridad-rls | — |
