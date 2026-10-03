# Pintura Pro

Marketplace que conecta a quien tiene algo para pintar con pintores independientes: el
cliente publica su pedido, los pintores cotizan, el cliente elige. Pintura Pro no pinta ni
contrata: cobra un 10 % de comisión al pintor.

## Dónde está cada cosa

```
apps/
  web/              el sitio (Next.js 15). Se publica en Google Cloud Run (apps/web/Dockerfile)
  mobile/           la app para celulares (Expo / React Native)
packages/
  dominio/          las reglas del negocio, compartidas por la web y la app: montos, comisión,
                    topes, quién puede hacer qué, mensajes de error
  color/            el motor del simulador de color (varita mágica y mezcla de colores)
  ui/               reservado; todavía no lo usa nadie
supabase/
  migrations/       la base de datos, en orden: 0001 → la última
tools/
  auditoria/        el sistema que revisa el proyecto: pruebas de regresión, vigilante 24/7,
                    bitácora de hallazgos, reglas para los agentes
docs/               guías (publicar, datos personales, arquitectura…). Lo viejo, en docs/historico/
scripts/            cargar los datos de demostración en la base
.claude/agents/     los agentes de auditoría (se llaman por nombre desde Claude Code)
CLAUDE.md           el contexto completo del proyecto, el que lee Claude al empezar
```

## Para trabajar

```bash
pnpm install
pnpm dev                              # el sitio en http://localhost:3000
pnpm verificar                        # las pruebas de regresión (con `pnpm dev` corriendo)
node packages/dominio/pruebas.ts      # las reglas del negocio, sin levantar nada
bash tools/auditoria/produccion.sh    # una copia compilada para producción, en :3100
```

Las claves van en `apps/web/.env.local` (modelo: `apps/web/.env.example`). Nunca se suben.

## Para publicar

`docs/despliegue-google-cloud.md`. Empezá por la sección 0: lo que no se arregla desde el código.

## Antes de cambiar algo

- `tools/auditoria/BITACORA.md`: qué se rompió, cómo se arregló y qué prueba lo vigila; qué
  sigue abierto, y qué depende del dueño.
- `tools/auditoria/REGLAS.md`: lo que no se hace nunca, y las trampas que ya costaron tiempo.
- La regla del proyecto: **un arreglo sin prueba se vuelve a romper**.
