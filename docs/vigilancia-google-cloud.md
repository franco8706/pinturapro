# El vigilante 24/7, en Google Cloud

Escrito para el dueño. Explica qué vigila, cómo se instala y cuánto cuesta.

---

## Primero, una aclaración honesta

Los agentes con los que trabajamos durante el desarrollo **no pueden quedar corriendo**. Viven
mientras la conversación está abierta y el entorno encendido; cuando se cierra, se apagan. Un
vigilante de verdad tiene que correr en una máquina que no dependa de nadie.

Por eso esto no es un agente: es un **programa chico que corre solo en Google Cloud**, cada
media hora, para siempre, sin que nadie lo encienda. Hace las comprobaciones que un agente
haría, pero sin necesitar que haya alguien del otro lado.

---

## Qué vigila

Dos piezas que se complementan:

### 1. Chequeo de disponibilidad (cada minuto)

Es una función nativa de Google Cloud: pega a `/api/health` desde varias partes del mundo cada
60 segundos. Si el sitio se cae, te enterás en dos minutos, no al otro día.

Se eligió `/api/health` y no la portada a propósito: esa dirección prueba **seis sondas
reales** contra la base —cuatro tablas y dos funciones—. Los dos incidentes que tuvo este
proyecto fueron permisos rotos en UNA tabla, con el sitio entero andando: la portada cargaba
perfecto y los paneles mostraban "no tenés nada" a gente que sí tenía. Mirar sólo la portada
no los habría detectado.

### 2. Revisión completa (cada 30 minutos)

Un trabajo de Cloud Run que corre `tools/auditoria/vigilancia/revisar.mjs` y mira:

| Qué | Por qué |
|---|---|
| La base, por las seis sondas | Ver arriba |
| Que la portada y las páginas públicas respondan | Lo básico |
| Que `/privacidad` y `/terminos` sigan teniendo su contenido | Si se rompen, el sitio sigue andando **sin los textos que la ley exige** y nadie se entera |
| Que los paneles privados pidan sesión | Una fuga de datos que nadie nota es la peor clase de fuga |
| Que `robots.txt` siga bloqueando lo privado | Un cambio distraído y Google indexa el panel de administración |
| Que estén las cabeceras de seguridad | Se pierden con un cambio de configuración; no se nota hasta que pasa algo |
| Que el mapa del sitio no mande a páginas rotas | Google castiga eso, y tarda meses en perdonarlo |

Cuando algo falla, escribe una línea por problema con severidad de error. Google Cloud las
reconoce y de ahí sale el mail.

---

## Instalarlo

Hace falta tener creado el proyecto de Google Cloud y `gcloud` instalado y autenticado.

```bash
export GOOGLE_CLOUD_PROJECT=el-id-de-tu-proyecto
export PINTURAPRO_URL=https://pinturapro.ar          # la dirección real, con https
bash tools/auditoria/vigilancia/desplegar.sh
```

El script habilita los servicios, construye la imagen, crea el trabajo, le pone horario y
arma el chequeo de disponibilidad. Se corre una sola vez.

Para probarlo en el momento:

```bash
gcloud run jobs execute vigilancia --region southamerica-east1 --wait
```

Se eligió la región de **São Paulo** por ser la más cercana a Argentina.

---

## Que te avise

Esta parte va a mano, una sola vez, porque hay que elegir a qué correo llega.

**1. Cargá tu correo como destino**
Consola → *Monitoring* → *Alerting* → *Notification channels* → *Email* → agregá tu dirección.

**2. Alerta de sitio caído**
Consola → *Monitoring* → *Uptime checks* → abrí "Pintura Pro está en pie" → *Create alert
policy*. Elegí el canal del paso 1.

**3. Alerta de revisión fallida**
Consola → *Logging* → *Logs Explorer*, pegá esta consulta:

```
resource.type="cloud_run_job"
resource.labels.job_name="vigilancia"
severity>=ERROR
```

Apretá *Create alert* y elegí el mismo canal. El mail te va a llegar con el texto del
problema — "`/privacidad` perdió contenido", "`robots.txt` dejó de bloquear /admin" — no un
genérico "un trabajo falló".

---

## Cuánto cuesta

Prácticamente nada, y lo más probable es que quede dentro del nivel gratuito:

- **Chequeo de disponibilidad:** el primer millón de ejecuciones por mes es gratis. Uno por
  minuto son unas 43.000.
- **Cloud Run (el trabajo):** se cobra sólo mientras corre. Son ~6 segundos, 48 veces por día:
  unos 5 minutos de cómputo mensuales, contra 180.000 segundos gratis por mes.
- **Cloud Scheduler:** los primeros 3 horarios son gratis. Usamos uno.
- **Cloud Logging:** los primeros 50 GB por mes son gratis. Esto escribe unos pocos kilobytes
  por día.

Igual **poné un presupuesto con aviso** en *Billing → Budgets & alerts*. No por esto, sino
porque es lo primero que hay que hacer en cualquier cuenta de nube.

---

## Qué NO vigila (y qué hacer al respecto)

- **No prueba comprar, publicar ni cotizar.** Eso lo hacen las 13 pruebas de `pnpm verificar`,
  que necesitan un navegador y crean datos: no corresponde que corran solas contra producción.
  Se corren antes de cada publicación.
- **No mira el contenido**: si alguien sube una reseña difamatoria, esto no se entera. Eso es
  moderación, no vigilancia técnica.
- **No revisa la app móvil.**

---

## Si un día migran el sitio a Cloud Run

Cuando la web deje de estar en Vercel y pase a Google Cloud, esto no cambia: el vigilante
apunta a una dirección, no a una plataforma. Lo único que hay que actualizar es
`PINTURAPRO_URL` en el trabajo:

```bash
gcloud run jobs update vigilancia --region southamerica-east1 \
  --set-env-vars PINTURAPRO_URL=https://la-nueva-direccion
```
