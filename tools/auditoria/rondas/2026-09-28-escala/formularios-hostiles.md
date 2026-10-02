# Formularios hostiles — ronda 2026-09-28-escala

Probado contra `:3000` con el kit, cuentas `cliente2` (javier.mendez) y `pintor3` (diego.sosa).
Scripts en `/tmp/auditoria/formularios-hostiles/` (no en el repo).

## IMPORTANTE

**"Superficie" en /publicar acepta `Infinity` y cualquier magnitud; el servidor no la valida
porque nunca viaja como número.** `faltan` compara `Number(surface) > 0`
(`publicar-form.tsx:116`); `Number("Infinity")`, `Number("1e9")` y `Number("99999999999")` dan
`> 0`, el paso deja avanzar. El valor se pega como texto en `description`
(`Tipo: X · Superficie: ${surface} m²`, línea 61) y `publicarTrabajo`
(`app/(marketplace)/actions.ts`) sólo chequea el LARGO total, nunca que sea razonable.
**Medido:** publiqué `ZZAGENT superficie infinita` con superficie `Infinity` y quedó en
`/trabajos`, para cualquier visitante, como *"Tipo: interior · Superficie: Infinity m²"*.
`-50`/`0`/texto/emoji sí quedan bloqueados (aria-disabled + "completá la superficie").
**Deducido** (mismo código, no ejecutado): mismo patrón en /registro → "años de experiencia"
(`registro/page.tsx:66`), guardado como texto libre sin validar en
`(marketing)/actions.ts:244`; ahí sólo es un dato interno de `leads`, no público.

## MENOR / comportamiento correcto

- **Zona de /publicar es texto 100% libre y público, sin filtro.** Medido: publiqué
  `ZZAGENT zona hostil` con zona `ZZAGENT Av. Corrientes 1234 5J +54 11 5555-1234 <b>x</b>
  http://evil.com` y se ve en `/trabajos` **escapada correctamente** (el `<b>` sale como texto
  literal, no se ejecuta). El único freno es el aviso visual ya existente ("Poné el barrio, no
  la dirección"); el servidor no impide dirección/teléfono/enlace. Correcto en XSS; confirma
  el ítem ya abierto sobre lo público del pedido.
- Un título de 5.000 caracteres pasa el paso 1 (sólo chequea no-vacío) y el servidor lo
  rechaza recién al final: `"El título no puede superar los 120 caracteres."`, cerca del
  formulario. Correcto en seguridad; UX floja (se completan los 3 pasos para enterarse).
- Vacío/espacios como título: bloqueados por `faltan`. `<script>alert(1)</script>` y
  `' OR 1=1 --` pasarían el paso (no vacíos) pero se guardan como texto plano y se muestran
  escapados — deducido por el mismo patrón de escape verificado en la zona.
- Triple clic sintético en "Publicar trabajo" y en "Enviar cotización": un solo pedido y una
  sola cotización. Nada roto, coincide con lo ya resuelto.

## Cantidad (punto 2)

- `cliente2` publicó **8/8** pedidos `ZZAGENT` seguidos, sin tope, sin lentitud, sin errores.
- `pintor3` cotizó **8/8** pedidos `ZZAGENT` distintos de `cliente2` (confirmado releyendo
  `/trabajos`: los 8 pasaron a "Ya cotizaste este pedido").
- No hay control de volumen en `publicarTrabajo` ni en `cotizar`. A diferencia de los leads
  (`/registro`, `/contacto`), que tienen `rateLimited` (5/hora por IP), publicar y cotizar no
  tienen tope. Reportado; la defensa la decide el orquestador.

## Funciona bien

Los avisos de "falta completar" son claros, en español y cerca del campo; Enter+foco navegan
bien con teclado sobre el botón `aria-disabled`.

## ZZAGENT creado (para borrar)

**Proyectos** (`cliente2`): `ZZAGENT superficie infinita`, `ZZAGENT zona hostil`,
`ZZAGENT triple clic publicar`, `ZZAGENT cantidad 4` a `ZZAGENT cantidad 8` (8 en total; el de
5.000 caracteres NO se publicó).

**Cotizaciones** (`pintor3`) sobre esos 8: notas `ZZAGENT cotización 1` a `8`, montos
$50.000–$57.000.

No toqué los `ZZAGENT pedido navegacion atras-reload(...)` que vi en `/trabajos`: son de otro
agente en paralelo.
