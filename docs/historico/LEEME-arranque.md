# Pintura Pro — Setup para Claude Code + GitHub Codespaces

## ¿Qué es esto?

Este paquete contiene toda la configuración necesaria para que Claude Code (la CLI de Anthropic) pueda leer, entender y armar el proyecto completo de **Pintura Pro** dentro de un GitHub Codespace.

## Archivos incluidos

| Archivo | Propósito |
|---------|-----------|
| `CLAUDE.md` | Documento maestro con la visión, stack, estructura y reglas del proyecto. Claude Code lo lee automáticamente. |
| `.claude/settings.json` | Permisos y hooks de Claude Code (formateo automático con Prettier). |
| `.devcontainer/devcontainer.json` | Configuración del entorno de desarrollo en GitHub Codespaces (Node 22, extensiones VS Code, puertos). |
| `package.json` | Raíz del monorepo Turborepo. |
| `turbo.json` | Pipeline de build de Turborepo. |
| `pnpm-workspace.yaml` | Definición de workspaces. |
| `apps/web/` | Aplicación Next.js 15 con archivos base ya configurados. |
| `packages/ui/` | Package compartido de UI para futura extracción. |
| `setup.sh` | Script que genera las páginas y componentes restantes. |

## Instrucciones paso a paso

### 1. Crear el repositorio en GitHub

```bash
# En tu máquina local, crear el repo
git init pinturapro
cd pinturapro

# Copiar todos los archivos de este paquete al repo
cp -r /ruta/del/paquete/* .

# Commit inicial
git add .
git commit -m "feat: setup inicial con Claude Code config"

# Subir a GitHub
git remote add origin https://github.com/TU_USUARIO/pinturapro.git
git push -u origin main
```

### 2. Abrir en GitHub Codespaces

1. Andá a tu repo en GitHub.
2. Click en **Code** → **Codespaces** → **Create codespace on main**.
3. Esperá que se provisione el entorno (tarda ~2 minutos).

### 3. Instalar Claude Code CLI

```bash
# En el terminal del Codespace
npm install -g @anthropic-ai/claude-code
```

### 4. Iniciar Claude Code

```bash
claude
```

Claude Code va a:
1. Leer automáticamente `CLAUDE.md`.
2. Entender la estructura completa del proyecto.
3. Tener permisos para crear, editar y ejecutar archivos.

### 5. Pedirle a Claude que arme el proyecto

Una vez dentro de Claude Code, decile:

```
Armá todas las páginas y componentes que faltan según CLAUDE.md. 
Empezá por los componentes compartidos (features/) y después 
las páginas de Fase 1, Fase 2 y Fase 3.
```

O si querés ir por partes:

```
Creá los componentes de features/ que faltan: hero-fluid, 
color-wipe, magnetic-button, navbar, footer, project-card, 
painter-card, before-after-slider, color-swatch, level-badge, 
process-step, multi-step-form, review-system, states.
```

Y después:

```
Creá todas las páginas de Fase 1: obras, obras/[slug], 
simulador, cotizar, nosotros, contacto.
```

### 6. Ejecutar el proyecto

```bash
pnpm install
pnpm dev
```

El servidor va a estar disponible en el puerto 3000 (forwarded automáticamente por Codespaces).

## Comandos útiles de Claude Code

| Comando | Descripción |
|---------|-------------|
| `/help` | Ver todos los comandos disponibles |
| `/cost` | Ver costo acumulado de la sesión |
| `/compact` | Compactar el contexto de la conversación |
| `/clear` | Limpiar el historial |

## Tips

- **CLAUDE.md se lee automáticamente** cada vez que iniciás Claude Code en el directorio. No hace falta pasárselo manualmente.
- Los **hooks de `.claude/settings.json`** formatean automáticamente cada archivo que Claude edita con Prettier.
- El **`.devcontainer/devcontainer.json`** instala pnpm, dependencias y hace build automático al crear el codespace.
- Si Claude Code se pierde en el contexto, usá `/compact` para resumir la conversación sin perder el hilo.

## Estructura final esperada

```
pinturapro/
├── .claude/
│   └── settings.json
├── .devcontainer/
│   └── devcontainer.json
├── apps/
│   └── web/
│       ├── app/
│       │   ├── page.tsx                    # Home
│       │   ├── (marketing)/
│       │   │   ├── obras/page.tsx          # Portfolio
│       │   │   ├── obras/[slug]/page.tsx   # Proyecto individual
│       │   │   ├── simulador/page.tsx      # Simulador
│       │   │   ├── cotizar/page.tsx        # Cotización
│       │   │   ├── nosotros/page.tsx       # Nosotros
│       │   │   └── contacto/page.tsx       # Contacto
│       │   ├── (pro)/
│       │   │   ├── pintores/page.tsx       # Directorio
│       │   │   ├── pintor/[id]/page.tsx    # Perfil
│       │   │   ├── registro/page.tsx       # Onboarding
│       │   │   ├── mapa/page.tsx          # Mapa
│       │   │   └── dashboard/page.tsx      # Dashboard pintor
│       │   └── (marketplace)/
│       │       ├── publicar/page.tsx       # Publicar trabajo
│       │       ├── trabajos/page.tsx       # Trabajos disponibles
│       │       ├── cotizaciones/page.tsx   # Ofertas
│       │       ├── checkout/page.tsx       # Pago
│       │       ├── dashboard/page.tsx      # Analítico
│       │       └── admin/page.tsx          # Panel admin
│       ├── components/
│       │   ├── features/                   # 14 componentes
│       │   └── providers/
│       ├── lib/
│       ├── types/
│       └── public/
├── packages/
│   └── ui/
├── CLAUDE.md
├── turbo.json
└── package.json
```
