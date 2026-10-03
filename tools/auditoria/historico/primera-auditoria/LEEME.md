# Sondas de la primera auditoría (19-20/9/2026)

Los scripts con los que se hizo la primera auditoría con navegador, separados por papel:
`visitante/`, `pintor/`, `navegacion/`, `formularios/`, y sueltos en esta carpeta (los del
simulador y los cerrojos contra el doble envío).

**Son historia, no herramientas.** Lo que hay que usar hoy está un nivel más arriba:

- Las reglas vigentes: `tools/auditoria/REGLAS.md` (el `REGLAS.md` de acá es la versión de esa
  primera vez).
- El kit de navegador vigente: `tools/auditoria/navegador.cjs` (el `navegador.cjs` de acá es el
  original; las sondas lo cargan por ruta relativa).
- Lo que se encontró y se arregló: `tools/auditoria/BITACORA.md`.

Para qué sirven: el agente `recorrido-web` las mira antes de recorrer, para no repetir lo que
ya se probó y para ver si algo de eso volvió a romperse.

Vivían fuera del repositorio, en `/workspaces/codespaces-blank/.auditoria/kit/`, y se movieron
acá el 3/10/2026: lo que está fuera del repo se pierde si el Codespace se recrea. Las 37
capturas de pantalla que las acompañaban (18 MB) no se trajeron: mostraban pantallas que ya
cambiaron, y lo que encontraron está escrito en la BITÁCORA.
