# Rondas de auditoría

Una carpeta por ronda grande, con nombre `AAAA-MM-DD-tema`. Adentro:

- **Un reporte por agente o sub-agente** (`<agente>.md` o `<agente>-<papel>.md`), escrito por el
  propio agente al terminar (REGLAS §4). Es lo que dijo, no lo que resultó cierto.
- **`cierre.md`**, del orquestador: qué verificó de cada reporte, qué corrigió (con commit y
  prueba), qué resultó falso y por qué. Cuando un reporte y el cierre no coinciden, vale el cierre.
- **`retroalimentacion.md`**, del agente `retroalimentacion`: qué cambió en cada agente, trampas
  nuevas, huecos de cobertura y la tabla de números para comparar con la ronda siguiente.

Existe porque hasta el 28/9 los reportes vivían sólo en el contexto del orquestador, y cada vez
que la conversación se compactaba se perdían los detalles: quedaba la conclusión, no la evidencia.
