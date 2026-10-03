# Documentos y archivos que quedaron atrás

Lo que está en esta carpeta **ya no describe cómo es el proyecto hoy**. Se guarda porque
explica decisiones que se tomaron. Para trabajar, usá los documentos de `docs/` y el
`README.md` de la raíz.

| Archivo | Qué era | Lo reemplaza |
|---|---|---|
| `deploy.md` | Cómo publicar en Vercel. Desde el 27/9/2026 el destino es Google Cloud. | `docs/despliegue-google-cloud.md` (su sección 0 trae, al día, lo que todavía valía de acá) |
| `infraestructura.md` | El análisis de opciones de nube (recomendaba AWS) antes de decidir. | `docs/despliegue-google-cloud.md` |
| `LEEME-arranque.md` | El README de agosto: cómo arrancar el proyecto desde cero con Claude Code y `setup.sh`. Nombra rutas que ya no existen (`/cotizar`, `/checkout`). | `README.md` de la raíz |

## Lo que se sacó del todo (3/10/2026)

Estos tres no se archivaron acá porque usarlos hoy rompería algo. Siguen en el historial de
git. Para ver uno (cambiando `setup.sh` por el que quieras):

```bash
git show $(git log --diff-filter=D --format=%h -1 -- setup.sh)^:setup.sh
```

- **`setup.sh`** — el script que armó la estructura del proyecto en agosto. Correrlo hoy
  volvería a crear páginas que se eliminaron a propósito (`/cotizar`, el checkout falso).
- **`vercel.json`** — la configuración para Vercel. El sitio se publica en Google Cloud Run
  (`apps/web/Dockerfile`); en Vercel este archivo no tiene a quién configurar.
- **`supabase/setup-completo.sql`** — "la base entera en un solo archivo". Llegaba sólo hasta
  la migración 0015: recrear la base con él volvía a abrir los agujeros que cerraron de la 0016
  a la 0023 (por ejemplo, que cualquier cuenta pudiera cotizar haciéndose pasar por pintor, o
  que la ubicación de los pintores se viera con precisión de metros). Una base nueva se arma
  corriendo `supabase/migrations/` en orden.
