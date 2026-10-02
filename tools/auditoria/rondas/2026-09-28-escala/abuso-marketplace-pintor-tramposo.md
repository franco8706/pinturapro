# abuso-marketplace — pintor-tramposo (ronda 2026-09-28-escala)

Cuentas: `pintor3` (diego.sosa) y `cliente3` (sofia.luna), servidor :3000. Cinco jugadas,
todas medidas (navegador + REST con la clave anon / tokens de `auth/v1/token`).

## 1. Reseñarse a sí mismo

**Se puede, de punta a punta, sin freno.** cliente3 publicó un pedido ZZAGENT, pintor3 lo
cotizó ($150.000), cliente3 aceptó, pintor3 marcó completado y dejó 5★. Nada exige que cliente
y pintor no sean la misma persona con dos mails; sin cooldown entre pasos. **Tiempo real: bajo
un minuto** (publicar ~8 s; el resto son pares de clics con confirmación inline).

- **Costo:** cero. **Pierde:** clientes que confían en un rating inflado; pintores honestos que
  compiten contra un 4.6★ fabricado.
- **Rastro:** pintor3 pasó de **4.5★ (4) a 4.6★ (5)**, medido por REST. El admin **no lo ve**:
  `/admin` sólo tiene "Consultas" y "Pintores" (rating agregado), no lista `jobs`/`reviews`
  individuales ni cruza autor↔destinatario.
- **Defensa más barata:** probar "misma persona" es caro para 3 pintores. Lo barato: una
  pestaña en `/admin` con las últimas reseñas (autor, destinatario, texto, fecha) para que un
  humano note patrones — hoy no existe ni para eso.

## 2. Contacto por fuera (nota de cotización y bio)

**Se puede en los dos lugares, sin filtro.** En la nota de una cotización ($200.000) escribí
WhatsApp y mail: se guardó tal cual y el cliente lo ve en `/cotizaciones` **antes de aceptar**.
En la bio de pintor3 agregué el mismo contacto más "cerramos por fuera y ahorrás la comisión":
salió en el perfil público sin aviso; la restauré después (verificado por REST). Ni
`quote-form.tsx` ni `updateProfile` filtran patrones de contacto.

- **Costo:** cero. **Pierde:** la plataforma (su única fuente de ingreso es la comisión que
  esto evita) y el cliente, que pierde la poca intermediación del sitio.
- **Rastro:** ninguno.
- **Defensa más barata:** una regex simple en el servidor (8+ dígitos seguidos, "wsp",
  "whatsapp", dominios de mail) en `cotizar` y `updateProfile`. No hace falta bloquear: alcanza
  con un cartel como el que ya existe para el cliente en `/publicar`, que del lado del pintor
  no tiene equivalente.

## 3. Cotizar $1

**Se puede, sin piso ni aviso.** `montoDesdeTexto` (`packages/dominio/src/montos.ts:77`) sólo
exige `n > 0`. Coticé $1: la pantalla mostró "La comisión del 10% son $0" sin objetar, y el
cliente lo vio como "$1" liso, sin marca de monto sospechoso.

- **Costo:** cero. **Pierde:** la plataforma (comisión $0) y el cliente, si el $1 es para
  "ganar" y renegociar por fuera.
- **Rastro:** ninguno. **Defensa más barata:** avisar cuando el monto está muy por debajo del
  `budget_min` que el cliente ya declaró — ese dato existe, comparar es gratis.

## 4. Tope de 30/hora salteado por la API directa

**Confirmado con una sola inserción.** Con el `access_token` de pintor3 inserté un `job` por
`POST /rest/v1/jobs` sobre un pedido ZZAGENT propio: **HTTP 201**, sin pasar por `cotizar` ni
por `superaElTope()` (`actions.ts:59`). La policy (0018) valida rol, aritmética de comisión y
pedido abierto, pero no cuenta cotizaciones por hora.

- **Costo:** un `curl`. **Pierde:** los clientes (nada los protege de una ráfaga real); además
  no reciben el mail de aviso (`notifyUser` sólo lo dispara la Server Action), así que una
  cotización por API es invisible hasta que entran a mirar.
- **Rastro:** la fila queda igual que cualquier otra. **Defensa más barata:** mover el conteo
  de `superaElTope` a la policy de `jobs` (o un trigger `before insert`) — ya anotado como
  pendiente en la bitácora.

## 5. Retirar y recotizar

**Se puede sin límite.** Sobre un mismo pedido retiré y recoticé 3 veces en ~16 s ($1 →
$300.000 → $50.000 → $999.000). El índice único sólo protege UNA cotización *viva*; cada
retiro deja una fila `cancelled` (terminé con 4 filas de un solo pedido), sin cooldown.

- **Costo:** cero. **Pierde:** el cliente, que ve cambiar el precio a gusto del pintor; con
  mails activos recibiría "se canceló el trabajo y volvió a estar publicado" en cada retiro
  (texto pensado para un ACEPTADO, confuso para una cotización que ni miró). Hoy no sale mail
  real (sin `RESEND_API_KEY`).
- **Rastro:** sólo en la base; ningún panel se lo muestra al admin.
- **Defensa más barata:** nada urgente con este volumen; si molesta, un cooldown corto o
  distinguir el aviso entre "retiraste una cotización" y "se canceló un trabajo en curso".

## Datos ZZAGENT creados

**Pedidos:** A `ZZAGENT autorresena pintor3` `8bd44f26-75a9-40c5-8079-a7e89fcff6c8` · B
`ZZAGENT contacto en nota pintor3` `f6bbe1e8-80e1-440f-980b-e46194bf9415` · C `ZZAGENT cotizar
un peso pintor3` `71a1ea03-3f12-4a13-916e-518a1e712bf0` · D `ZZAGENT api directa pintor3`
`bfe4b52a-2503-4f0a-b6c0-c168273e044d`.

**Trabajos:** A `a771a809-ae14-4d70-967c-24ee8e9f9aa6` (completed $150.000) · B
`193334af-ee50-4a96-b62d-3ceb2345bdd2` (quoted $200.000, nota con contacto) · C
`742dafa1-77c5-42af-b569-dad6b7071cd0` (cancelled $1), `2057eab5-328a-487a-84a6-65f234b25ca7`
(cancelled $300.000), `ecdf95af-c57e-4c74-a2f3-711518183a49` (cancelled $50.000),
`8bf3a55f-9732-4dbf-900c-98189b8da3a3` (quoted $999.000) · D
`844ee9d9-8ab2-48f4-9684-32c67b30a9c2` (quoted $123.456, por REST).

**Reseñas:** `dbd3097e-07df-48ef-bec3-b421c4c3f86d` — 5★, cliente3 sobre pintor3 (job A).

**Rating pintor3:** 4.5★/4 (antes) → **4.6★/5** (después, sólo por la autorreseña del punto 1).

**Bio pintor3:** modificada temporalmente y **restaurada**, verificado por REST:
`"Exteriores, frentes e impermeabilización. Trabajo prolijo y a tiempo."`
