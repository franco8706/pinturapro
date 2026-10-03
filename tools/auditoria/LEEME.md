# Kit de auditoría de Pintura Pro

Todo lo que necesitan los agentes para probar la web de verdad, en un navegador, desde cualquier
sesión y sin que haya que explicarles el contexto cada vez.

| Archivo | Para qué |
|---|---|
| `REGLAS.md` | Lo que cada agente lee primero: qué no tocar, cuentas demo, cómo reportar, trampas. |
| `BITACORA.md` | La memoria: qué se encontró, qué se arregló, qué se descartó midiendo, qué depende del dueño. |
| `regresiones/` | Las pruebas que vigilan cada arreglo. Se corren con `pnpm verificar`. |
| `navegador.cjs` | Chrome propio por agente (Playwright como librería) + `auditar()` estándar. |
| `produccion.sh` | Compila una copia aparte en modo producción y la sirve en :3100, para medir. |
| `vigilancia/` | El vigilante 24/7 que corre en Google Cloud (`docs/vigilancia-google-cloud.md`). |
| `rondas/` | Un reporte por agente en cada ronda grande, el cierre del orquestador y la retroalimentación. |
| `cobertura.mjs` → `COBERTURA.md` | Qué pantalla, acción, tabla o función no mira ninguna prueba ni agente. |
| `escala/` | Carga contra producción (`carga.mjs`) y pruebas de la base con volumen, siempre en rollback. |
| `simulador/` | Cuánto congela la pantalla el primer clic de la varita (`congelamiento.cjs`). |
| `generar.py`, `mascara.py` | Fotos de prueba del simulador y dónde está la pared en cada una (`pnpm fotos-prueba`). |
| `instalar-agentes.sh` | Hace que los agentes se vean desde las sesiones abiertas en la raíz del Codespace. |
| `historico/` | Las sondas de la primera auditoría (septiembre). Historia, no herramientas. |
| `.salida/` | Lo que escriben las corridas largas (`verificar.log`). No va a git. |

## Agentes disponibles

Están definidos en `.claude/agents/` (21 al 3/10/2026) y se llaman por nombre desde cualquier
sesión, sin repetirles las instrucciones. La lista con qué hace cada uno está en `CLAUDE.md`,
sección "Sistema de auditoría". Cada definición termina con "Lo que aprendieron las rondas
anteriores", que actualiza el agente `retroalimentacion` al cerrar cada ronda.

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
