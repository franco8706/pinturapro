# seguridad-rls · migración 0027 (suscripción), 8/10/2026

Revisó la 0027 antes de pedirle al dueño que la aplique. Trabajó en la **base local**
(`tools/auditoria/base-local/`), con SQL entre `begin` y `rollback` y por la API REST con las
cuentas demo. El agente no puede escribir archivos: este resumen lo guardó el orquestador, con lo
que se hizo con cada punto.

**Conclusión del agente:** no encontró forma de fabricarse acceso, ni de leer lo de otro pintor,
ni recursión de policies. Ningún hallazgo crítico ni alto.

## Hallazgos y qué se hizo

| # | Severidad | Hallazgo | Qué se hizo |
|---|---|---|---|
| 1 | Medio-bajo | **H8 se esquivaba si el dueño del pedido era un pintor.** `projects_update_own` deja cambiar `type` a un pintor: pasaba su pedido a "portfolio", aceptaba la cotización y lo borraba. El trabajo quedaba aceptado sin pedido. También anulaba la regla de 0026 "un pedido adjudicado no se edita". | Trigger `tipo_de_proyecto_fijo`: el tipo de una publicación no cambia después de creada. Caso 12a de `probar-0027.sql`. |
| 2 | Bajo | `aceptado_en` no se puede rellenar nunca más (el rastro devuelve el valor viejo). Los trabajos aceptados antes de aplicar la 0027 quedaban sin fecha: no saldrían en `cancelaciones_tras_aceptar()` y la baja de cuenta los borraría. | La migración completa `aceptado_en` (con `updated_at`, sin tocarlo) antes de crear el trigger. Caso 12b. |
| 3 | Bajo | `planes.publico` no se respetaba, y `precio_ars()` daba precio a planes apagados. | `planes_lectura` usa `activo and publico`; `precio_ars` filtra `activo`. Caso 12c. |
| 4 | Bajo | Las secuencias de las columnas identity quedaban abiertas a anon y authenticated (el `revoke` era sólo de tablas). | `revoke all on sequence …`. Caso 12d. |
| 5 | Bajo | `puede_cotizar` no miraba `suscripciones.modo`: un pago del sandbox de Mercado Pago daba acceso real si las pruebas usaban la base en vivo. | Sólo cuentan las filas de `produccion`, salvo que `ajustes_de_cobro.aceptar_pagos_de_prueba` lo active (para una base de pruebas). Casos 12g y 12h. |
| 6 | Bajo | `ajustes_de_cobro` se leía entero sin cuenta, umbrales del control del dólar incluidos. | Permiso por columna: sólo `id`, `lanzamiento_hasta`, `exigir_suscripcion` y `medios_activos`. Casos 12e y 12f. |
| 7 | Info | El dueño de la tabla (postgres, SQL Editor) puede poner en NULL las referencias del libro a mano. | Aceptado: es el administrador de la base. La clave de servicio no puede. |
| 8 | Info | El pintor lee `suscripciones.nota` y `pagos.linea_extracto` de lo suyo. | Comentado en la tabla: nada interno del admin en `nota`. |
| 9 | Info | Reaplicar 0024 después de 0027 pisaría la policy de cotizar. | El orden 0024 → 0027 está en el encabezado de la 0027 y en la BITÁCORA. |

## Lo que el agente verificó sin problemas (resumen)

- **Permisos.** anon lee sólo ajustes (ahora por columna) y planes. authenticated no escribe en
  ninguna de las 8 tablas nuevas y no lee `cotizaciones_dolar` ni `eventos_pago`. La clave de
  servicio no puede editar, borrar ni truncar el libro.
- **Funciones.** Todas las `security definer` con `search_path=public`; las de trigger, revocadas.
  Ninguna función ejecutable por anon o authenticated escribe.
- **`puede_cotizar(uid)`** no revela si otro pintor paga, ni por SQL ni por REST.
- **Ciclo completo** (cotizar, retirar, aceptar, perdedoras, cancelar tras aceptar, en curso,
  completar, reseñar) y **baja de cuenta** andan. H1 y H10 dan P0001 para las dos partes.
- **Métricas** de cobro sólo para el admin, también con `limite` raro.
- **0024 y 0026 intactos.**

## Efecto que dejó en la base local

Movió dos secuencias (`nextval`/`setval` no se deshacen con rollback). La base local se rearmó
de cero con `levantar.sh` antes de la siguiente corrida.
