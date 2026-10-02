# Mapa de cobertura — Pintura Pro

Generado por `node tools/auditoria/cobertura.mjs` el 2026-10-02. **No se edita a mano**: se vuelve a generar.

🟢 lo nombra una prueba de regresión · 🟡 sólo un agente o el vigilante · 🔴 no lo nombra nadie

**Total:** 42 🟢 · 15 🟡 · 25 🔴 — 28 archivos de prueba, 21 agentes.

Que algo esté 🟢 no quiere decir que esté bien probado: quiere decir que alguien lo nombra. Lo 🔴
seguro que no lo mira nadie. El agente `retroalimentacion` lee este archivo al cerrar cada ronda.

## Pantallas (34)

Las páginas que ve la gente. 🔴 = ninguna prueba, agente ni vigilante la nombra.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `/cuenta-eliminada` | — | — | — |
| 🟡 | `/bienvenida` | — | buscadores, sesiones-y-acceso | — |
| 🟡 | `/cotizaciones` | — | buscadores, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟡 | `/dashboard/editar/[slug]` | — | sesiones-y-acceso | — |
| 🟢 | `/` | accesibilidad, desborde-celular, perfil-guardado, tactil | accesibilidad, dependencias, escala-y-volumen, rendimiento | sí |
| 🟢 | `/admin` | admin-panel-empresa | buscadores, sesiones-y-acceso | sí |
| 🟢 | `/aprender` | titulos | buscadores | — |
| 🟢 | `/asesoramiento` | titulos | buscadores | — |
| 🟢 | `/cliente` | accesibilidad, desborde-celular, seguridad-roles | buscadores, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/colores` | titulos | buscadores | — |
| 🟢 | `/contacto` | accesibilidad, acciones-hostiles, desborde-celular, doble-envio, duplicados-publicar, titulos | abuso-marketplace, buscadores, formularios-hostiles | sí |
| 🟢 | `/crear-cuenta` | admin-panel-empresa, titulos | — | — |
| 🟢 | `/dashboard` | admin-panel-empresa, desborde-celular, foto-reemplazada, perfil-guardado, ya-cotizado | dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/dashboard/nueva-obra` | acciones-hostiles, seguridad-roles | sesiones-y-acceso | — |
| 🟢 | `/dashboard/perfil` | acciones-hostiles, cache-publico, perfil-guardado | sesiones-y-acceso | — |
| 🟢 | `/ingresar` | mis-datos, titulos | accesibilidad, sesiones-y-acceso | — |
| 🟢 | `/mapa` | titulos | — | — |
| 🟢 | `/mi-cuenta` | acciones-hostiles, desborde-celular, mis-datos | buscadores, sesiones-y-acceso | sí |
| 🟢 | `/mi-panel` | admin-panel-empresa | sesiones-y-acceso | — |
| 🟢 | `/nosotros` | accesibilidad, titulos | buscadores, contenido-confianza, recorrido-web, riesgo-legal | — |
| 🟢 | `/novedades` | titulos | buscadores | — |
| 🟢 | `/nueva-contrasena` | nueva-contrasena, titulos | sesiones-y-acceso | — |
| 🟢 | `/obras` | desborde-celular, filtros-obras, sitemap-demo, tactil, textos-largos, titulos | buscadores, escala-y-volumen, formularios-hostiles, rendimiento | sí |
| 🟢 | `/obras/[slug]` | titulos | buscadores | — |
| 🟢 | `/panel` | admin-panel-empresa | contenido-confianza, dinero-y-comisiones, sesiones-y-acceso | sí |
| 🟢 | `/pintor/[id]` | autor-de-resenas, cache-publico | buscadores, escala-y-volumen | — |
| 🟢 | `/pintores` | accesibilidad, desborde-celular, sitemap-demo, tactil, textos-largos, titulos | buscadores, contenido-confianza, escala-y-volumen, rendimiento | sí |
| 🟢 | `/privacidad` | autor-de-resenas, desborde-celular, titulos | buscadores, contenido-confianza, riesgo-legal | sí |
| 🟢 | `/publicar` | accesibilidad, acciones-hostiles, borrador, desborde-celular, duplicados-publicar, formularios-de-pasos | accesibilidad, buscadores, recorrido-web, rendimiento, sesiones-y-acceso | sí |
| 🟢 | `/recuperar` | titulos | abuso-marketplace | — |
| 🟢 | `/registro` | duplicados-publicar, formularios-de-pasos, titulos | — | — |
| 🟢 | `/simulador` | desborde-celular, foto-rechazada, sangrado-moldura, simulador-calidad, simulador-teclado, tactil, titulos | accesibilidad, buscadores, rendimiento, simulador-color | sí |
| 🟢 | `/terminos` | desborde-celular, titulos | buscadores, contenido-confianza, riesgo-legal | sí |
| 🟢 | `/trabajos` | acciones-hostiles, desborde-celular, seguridad-roles, tactil, textos-largos, titulos, ya-cotizado | buscadores, dinero-y-comisiones | sí |

## Puntos de la API (6)

Lo que se puede llamar sin pasar por una pantalla.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🟡 | `/api/health` | — | listo-para-publicar | sí |
| 🟡 | `/api/segment` | — | abuso-marketplace, escala-y-volumen, listo-para-publicar, nube-google | — |
| 🟡 | `/api/sesion` | — | rendimiento | — |
| 🟡 | `/auth/callback` | — | sesiones-y-acceso | — |
| 🟡 | `/auth/signout` | — | sesiones-y-acceso | — |
| 🟢 | `/api/mis-datos` | acciones-hostiles, mis-datos | — | sí |

## Acciones de servidor (14)

Son endpoints aunque se escriban como funciones (REGLAS). Que una prueba recorra la pantalla del formulario no aparece acá: se cuenta sólo si alguien nombra la acción.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `cancelarTrabajo` | — | — | — |
| 🔴 | `createObra` | — | — | — |
| 🔴 | `dejarResena` | — | — | — |
| 🔴 | `enviarConsulta` | — | — | — |
| 🔴 | `guardarTelefono` | — | — | — |
| 🔴 | `marcarCompletado` | — | — | — |
| 🔴 | `postularmeComoPintor` | — | — | — |
| 🔴 | `updateObra` | — | — | — |
| 🟡 | `aceptarCotizacion` | — | dinero-y-comisiones | — |
| 🟢 | `cotizar` | accesibilidad, acciones-hostiles, borrador, desborde-celular, reglas-compartidas, seguridad-roles, ya-cotizado, dominio/pruebas.ts | abuso-marketplace, accesibilidad, app-movil, buscadores, dinero-y-comisiones, formularios-hostiles, recorrido-web, riesgo-legal, seguridad-rls | sí |
| 🟢 | `deleteObra` | foto-reemplazada | — | — |
| 🟢 | `eliminarMiCuenta` | acciones-hostiles | — | — |
| 🟢 | `publicarTrabajo` | acciones-hostiles | — | — |
| 🟢 | `updateProfile` | perfil-guardado | — | — |

## Tablas de la base (8)

Sacadas de `supabase/migrations/`.

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `faqs` | — | — | — |
| 🔴 | `news` | — | — | — |
| 🔴 | `resources` | — | — | — |
| 🟢 | `jobs` | ya-cotizado | abuso-marketplace, dinero-y-comisiones, integridad-datos | — |
| 🟢 | `leads` | doble-envio | abuso-marketplace, seguridad-rls | — |
| 🟢 | `profiles` | admin-panel-empresa, autor-de-resenas, cache-publico | escala-y-volumen, integridad-datos | — |
| 🟢 | `projects` | duplicados-publicar, formularios-de-pasos, foto-reemplazada | integridad-datos | — |
| 🟢 | `reviews` | autor-de-resenas | abuso-marketplace, integridad-datos | — |

## Funciones de la base (20)

Cada una necesita `revoke ... from public, anon` al crearse (ver REGLAS, trampas de la base).

| | Qué | Pruebas | Agentes | Vigilante |
|---|---|---|---|---|
| 🔴 | `actividad_reciente` | — | — | — |
| 🔴 | `contacto_del_trabajo` | — | — | — |
| 🔴 | `es_service_role` | — | — | — |
| 🔴 | `freeze_profile_trust_fields` | — | — | — |
| 🔴 | `metricas_plataforma` | — | — | — |
| 🔴 | `mi_telefono` | — | — | — |
| 🔴 | `on_job_cancelled` | — | — | — |
| 🔴 | `on_review_change` | — | — | — |
| 🔴 | `pedidos_abiertos` | — | — | — |
| 🔴 | `pintores_geolocalizados` | — | — | — |
| 🔴 | `resumen_publico` | — | — | — |
| 🔴 | `set_updated_at` | — | — | — |
| 🔴 | `volumen_mensual` | — | — | — |
| 🟡 | `enforce_job_rules` | — | escala-y-volumen | — |
| 🟡 | `es_admin` | — | escala-y-volumen, seguridad-rls | — |
| 🟡 | `handle_new_user` | — | escala-y-volumen | — |
| 🟡 | `on_job_accepted` | — | escala-y-volumen | — |
| 🟡 | `recalc_profile_rating` | — | escala-y-volumen | — |
| 🟡 | `una_sola_adjudicacion` | — | escala-y-volumen | — |
| 🟢 | `es_pintor` | seguridad-roles | abuso-marketplace, app-movil, escala-y-volumen | — |
