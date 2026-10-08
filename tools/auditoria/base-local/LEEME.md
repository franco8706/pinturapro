# Base local de Supabase

Una copia de Supabase en Docker (base, autenticación, API REST y almacenamiento) con las
migraciones del repo y los datos demo. Sirve para probar una migración, y la web contra ella,
**sin tocar la base en vivo** y sin la contraseña de nadie.

```bash
bash tools/auditoria/base-local/levantar.sh          # todas las migraciones del repo
bash tools/auditoria/base-local/levantar.sh 0026     # hasta la 0026: para ver fallar lo nuevo
```

- La primera vez baja unos 2 GB de imágenes. Después tarda alrededor de un minuto, y cada corrida
  **borra la base local y la arma de cero** (semilla incluida).
- La base queda en `postgresql://postgres:postgres@127.0.0.1:54322/postgres` y la API en
  `http://127.0.0.1:54321`. Las claves son las de desarrollo que Supabase usa en todas las
  instalaciones locales: no son secretos.
- Los contenedores sobreviven al reinicio del Codespace (vuelven solos).
- `tools/auditoria/.salida/base-local/web.env` trae las variables para correr la web contra
  esta base en lugar de la de verdad.

## Para qué se armó (6/10/2026)

Para probar la 0027 (suscripción). En el camino encontró que **la 0024, escrita el 3/10 y nunca
aplicada, rompía todas las cotizaciones** ("infinite recursion detected in policy for relation
jobs"). Los ensayos anteriores corrían contra la base en vivo adentro de una transacción, sólo
esperaban errores, aceptaban cualquiera, y nunca probaron una cotización que tenía que entrar.
Los ensayos de migraciones (`tools/auditoria/escala/probar-*.sql`) se corren acá primero.
