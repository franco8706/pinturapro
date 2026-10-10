# Cierre de la etapa 3 (transferencia) · 8-10/10/2026

Lo escribe el orquestador y manda sobre los reportes (`abuso-marketplace.md`, `dinero-y-comisiones.md`).
Todo se verificó y se corrigió contra la **base local** (`tools/auditoria/base-local/`). La base en vivo no se
tocó: sigue sin 0024-0027.

## Lo que se verificó antes de corregir

Los dos agentes coincidieron en los cuatro hallazgos principales y cada uno se confirmó leyendo el código
(línea por línea) o reproduciéndolo:

| Hallazgo | Agentes | Cómo se confirmó |
|---|---|---|
| El concepto corre las columnas del CSV ($1 → $7.700), la "coma-bomba", el importe imposible | abuso H1 | `extracto.ts:72` contaba `;` y `,` en 5 líneas; ningún control de columnas ni de tope |
| Una línea con salto de línea mete otra línea entera **con las columnas justas** | (nuevo, del orquestador) | El control de columnas solo no alcanza: hace falta el saldo |
| "Llegó" + extracto (o dos exportaciones) = dos meses | abuso H2, dinero D1 | `manual:<id>` y `extracto:<hash>` no se conocían |
| El aviso no vence: precio del dólar viejo | abuso H3, dinero D2 | Ninguna consulta miraba `vence_en`; nada escribía `vencido` |
| "Llegó" registra lo pedido | abuso H4, dinero D3 | `transferencia.ts:190` (`monto: c.monto_ars`) |
| El pintor lee el saldo del negocio | abuso H5, dinero D4 | Grant de tabla en `0027:633`; además salía en "mis datos" |

## Lo que se corrigió (cada cosa con su prueba, vista fallar)

- **Lector del extracto** (`packages/dominio/src/extracto.ts`, `analizarExtracto`): separador por el encabezado
  (que necesita una fecha y un importe, rótulos sin números), filas con otras columnas no se leen, importe
  imposible no se lee, columna "Tipo" para importes sin signo, y **cadena de saldos**: un crédito se confirma
  solo si cierra con el saldo de las líneas de al lado. Sin columna de saldo, nada se confirma solo.
  Pruebas: los ataques del agente en `packages/dominio/pruebas.ts`; además se pasaron sus scripts
  (`parser.mjs`): A1, A2, A3, C1, D1 y Q1 ya no leen nada, y E1 lee los tres créditos.
- **Duplicados**: un pago parecido (±3 %) del mismo pintor a menos de 7 días va a revisar; "Llegó" sobre una
  línea revisada usa la llave de esa línea; dos líneas idénticas en un archivo son dos pagos (`ocurrencia`).
- **Vencimiento**: vale el aviso vigente el día que llegó la plata, o el precio de ese día; los vencidos pasan
  a `vencido`; un solo aviso vivo por pintor (índice en 0027); "Mi plan" sólo muestra el vigente.
- **Lo recibido**: `cobros.monto_recibido`, "Llegó" en dos clics con el monto que registra, la línea y el motivo
  en la cola, "Últimos pagos" y "Devolver" (registra la devolución en el libro y recalcula el acceso).
- **Permisos**: grant por columna en `suscripciones`, `codigos_de_pago`, `cobros` y `pagos_suscripcion`; "mis
  datos" sin la línea del banco. `probar-0027.sql` 13a-13f (vistos fallar con el grant viejo).
- **Lo chico**: pagos de prueba fuera del recálculo; meses desde un ancla fija (31/1 → 31/1); código sólo en su
  forma exacta (PP-003 ya no es PP-0003); precio y dólar de la misma lectura; primer dólar sin control "a
  confirmar"; dólar descartado se puede "Usar igual"; Latin-1; reparación de "pagado sin acceso"; `/api/health`
  reusa sus sondas 10 s; textos ("comisión" en /panel, el redondeo en "Mi plan" y en /terminos).

Prueba de punta a punta: `extracto-transferencias` (7 pasos, ~2 min). Rota a propósito en tres lugares
("Llegó" con lo pedido, sin control de duplicados, sin mirar el vencimiento) dio exactamente esas fallas.

## Lo que NO se corrigió (y por qué)

- **H6, la cotización enviada sobrevive a la suscripción**: el plan aprobado dice "lo enviado sigue". Es
  decisión del dueño (BITÁCORA → Abierto).
- **D6, fijar el fin del lanzamiento no recalcula**: no hay pantalla que lo fije todavía (etapa 4).
- **D9, el ingreso del mes por fecha de confirmación**: queda `fecha_banco` guardada; es para el contador.
- **Pagos de varios meses**: van a revisar y suman uno.
- **Mercado Pago**: no existe todavía (el dueño lo dejó para después, igual que el CBU).

## Antes de prender la transferencia de verdad

1. Exportar un extracto REAL de la cuenta del negocio y cargarlo en la base local: ¿trae saldo? ¿el
   concepto con `;` o comillas sale escapado? (la "prueba de 2 minutos" de `abuso-marketplace.md`).
2. Aplicar 0024 → 0027 en la base en vivo, en orden, antes de publicar la web.
