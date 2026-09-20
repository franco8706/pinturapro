# Kit de auditoría de Pintura Pro

Todo lo que necesitan los agentes para probar la web de verdad, en un navegador, desde cualquier
sesión y sin que haya que explicarles el contexto cada vez.

| Archivo | Para qué |
|---|---|
| `REGLAS.md` | Lo que cada agente lee primero: qué no tocar, cuentas demo, cómo reportar. |
| `navegador.cjs` | Chrome propio por agente (Playwright como librería) + `auditar()` estándar. |
| `generar.py` | Fotos de prueba: pared con luz de ventana, pared plana, pared oscura, y una de 30 MP. |
| `mascara.py` | Dónde está la pared en cada foto, para medir aciertos y errores del simulador. |
| `BITACORA.md` | La memoria: qué se encontró, qué se arregló, qué se descartó midiendo. |
| `regresiones/` | Las pruebas que vigilan cada arreglo. Se corren con `pnpm verificar`. |

## Agentes disponibles

Están definidos en `.claude/agents/` y se llaman por nombre desde cualquier sesión, sin repetirles
las instrucciones:

- **recorrido-web** — recorre pantallas por rol en celular y escritorio.
- **formularios-hostiles** — datos inválidos, textos enormes, clics repetidos.
- **simulador-color** — mide el simulador con números contra máscaras de referencia.
- **seguridad-rls** — revisa que las reglas de la base frenen lo que prometen.
- **regresiones** — corre `pnpm verificar`, decide si falló el producto o la prueba, y escribe
  las pruebas que faltan.
- **accesibilidad** — teclado, contraste, lectores de pantalla, reducir movimiento.

## Cómo crece esto

El círculo es corto y se cierra solo si se respeta:

1. Un agente encuentra algo y lo reporta **medido**, no deducido.
2. Se arregla.
3. **El arreglo deja una prueba** en `regresiones/`, que se confirma rompiéndola a propósito.
4. El hallazgo se anota en `BITACORA.md` con su estado.
5. La ronda siguiente empieza leyendo la bitácora: no repite lo resuelto y sabe qué quedó abierto.

Sin el paso 3 todo esto se vuelve a romper. Sin el paso 4, la ronda siguiente lo redescubre y se
paga dos veces.

## Antes de llamarlos

Tiene que haber **un** servidor corriendo en `http://localhost:3000` (`pnpm dev` desde `apps/web`),
y lo levanta quien coordina, no los agentes. Si la web está en otra dirección:
`PINTURAPRO_URL=https://... node mi-script.cjs`.

## Datos de prueba

Todo lo que crea un agente lleva el prefijo `ZZAGENT` y queda listado en su reporte. Para encontrar
lo que haya quedado:

```sql
select 'projects', id, title from projects where title ilike 'ZZAGENT%'
union all select 'jobs', id, note from jobs where note ilike 'ZZAGENT%'
union all select 'leads', id, name from leads where name ilike 'ZZAGENT%'
union all select 'reviews', id, comment from reviews where comment ilike 'ZZAGENT%';
```
