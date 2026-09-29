# Recorrido web — visitante (2026-09-28-escala)

Chrome propio, desktop 1440px y mobile 390px, sin cuenta. 19 rutas: `/`, `/obras`, `/pintores`,
3 perfiles de pintor + 1 id inexistente, `/simulador`, `/colores`, `/publicar`, `/trabajos`,
`/contacto`, `/nosotros`, `/privacidad`, `/terminos`, `/mapa`, `/aprender`, `/novedades`,
`/registro` (completo). Repetí en mobile perfiles de pintor, `/trabajos` y `/registro`.

## BLOQUEANTE
Ninguno.

## IMPORTANTE
**`/pintor/<id>` — foco pedido: nadie la prueba, y el hueco es real.** Medido: la base tiene
sólo 3 pintores (mismos ids que las cuentas demo `pintor`/`pintor2`/`pintor3`: Martín 9 reseñas,
Lucía 7, Diego 4), **ninguno con foto de avatar** (caen en el fallback de iniciales) y
**ninguno con 0 reseñas** — Diego sí tiene 0 obras y esa sección se omite bien
(`portfolio.length > 0`), pero "con foto" y "sin reseñas" no se pueden ejercitar con los datos
actuales. Deducido leyendo `review-system.tsx`: si `reviews` llega vacío, la columna derecha
(`lg:col-span-8`) queda en blanco, sin ningún "Todavía no tiene reseñas". Rompe el criterio de
"estado vacío que explica el paso siguiente"; no confirmado en vivo por falta de dato. **Prueba
que haría falta:** recorrer los 3 ids reales (desde `/pintores`) + un id inventado (ya da 404
real, confirmado), y sumar un pintor de un solo uso (sin obras ni reseñas) para forzar los dos
estados vacíos que hoy nadie ve.

## MENOR
- **Enlace muerto transitorio, con causa identificada.** Desde portada y `/obras` seguí un link
  a `/obras/zzagent-reforma-cocina-nunez-duf9e` (portfolio de Martín) y dio 404. Minutos después
  la caché de 60s se refrescó y el link desapareció de portada, `/obras` y el perfil de Martín.
  Medido, pero explicado: dato ZZAGENT de otro sub-agente de esta corrida que borró su prueba
  mientras yo navegaba, no un bug del código.
- **Dato ZZAGENT ajeno visible en `/trabajos`:** "ZZAGENT pintura living ronda escala" (Villa
  Urquiza, $300.000–500.000). No es mío; lo anoto para el cierre de ronda.

## Medido vs. deducido
Medido: 19 rutas en desktop y 5 en mobile — `auditar()` sin imágenes rotas, textos prohibidos,
errores de consola/JS ni requests fallidos (salvo el 404 esperado del id inventado). `/registro`
completado de punta a punta. `/publicar` sin sesión redirige a `/ingresar?next=/publicar` (gate
documentado, sin preview del form: no es bug). `og:image` dinámico confirmado: real en
`/obras/estudio-nordelta`, genérico donde no hay foto real. Deducido: estado de 0 reseñas del
perfil (código, no forzado en vivo).

## Funciona bien
- 19 páginas sin error de consola/JS ni imagen rota, desktop y mobile.
- "Verificado" ausente en los 3 perfiles — sigue corregido (comentario en el código cita el
  hallazgo legal del 28/9).
- `/registro` termina con el texto nuevo y honesto ("no existe revisión ni activación... creá tu
  cuenta con `<email>`"), confirmado en vivo en mobile.
- `/trabajos` visible sin cuenta y `noindex, follow`: fuera de Google.
- `/pintor/<id inexistente>` da 404 real, no pantalla en blanco.
- Los 17px del pie (`Privacidad`/`Términos`) y los links de pintor inline en los testimonios:
  los revisé como posibles hallazgos nuevos y **no lo son** — ya exentos a propósito en
  `tactil.prueba.cjs` (WCAG 2.5.8 para links dentro de una oración, y exclusión del pie).

## Datos ZZAGENT creados
- `/registro`, postulación de pintor (tabla `leads`): "ZZAGENT Visitante Prueba",
  `zzagent.visitante@example.com`, teléfono `1122334455`, zona CABA, especialidad Residencial,
  5 años de experiencia.
