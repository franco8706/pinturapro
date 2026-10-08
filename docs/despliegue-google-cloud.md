# Publicar Pintura Pro en Google Cloud

Escrito para el dueño. Es el camino para pasar de "anda en el Codespace" a "anda en internet"
**en Google Cloud**, que es la decisión tomada. Reemplaza a `docs/historico/deploy.md` (escrito
para Vercel) y a `docs/historico/infraestructura.md` (que recomendaba AWS). Empezá por la
sección 0: es lo que no se arregla desde el código.

Todo lo de acá está probado hasta donde se puede sin una cuenta de Google Cloud: la imagen se
construyó, arrancó con los secretos inyectados al correr, respondió bien y el vigilante 24/7
dio verde contra ella (28/9/2026). Lo que sólo se puede hacer en la consola está marcado.

---

## 0. Antes de publicar: lo que no puede salir así

Nada de esto se arregla desde el código. La lista completa y al día está en
`tools/auditoria/BITACORA.md`, sección "Tareas del dueño"; acá va lo que frena la publicación.

- **Los datos son de demostración.** Los 3 pintores, las 20 reseñas y las 3 obras pertenecen a
  cuentas `*@pinturapro.demo`, y las fotos son de stock. Publicar eso es mostrar pintores que
  no existen y reseñas que nadie escribió (Ley 24.240). Hay que elegir: arrancar vacío, o con
  pintores reales que hayan dado su consentimiento y sin reseñas hasta que haya trabajos. Para
  borrar los de demostración (se lleva sus obras, trabajos y reseñas):
  ```sql
  select count(*) from auth.users where email like '%@pinturapro.demo';  -- mirar primero
  delete from auth.users where email like '%@pinturapro.demo';
  ```
  Y al compilar con datos reales, `NEXT_PUBLIC_DATOS_DEMO=false`: es lo que deja que Google
  indexe los perfiles y las obras y los suma al sitemap.
- **"Verificado" no tiene proceso.** `profiles.verified` sólo se escribe a mano por SQL. La
  palabra se sacó del perfil público (28/9), pero el nivel "Master" todavía la exige. Antes de
  marcar a alguien, definir qué se chequea y escribirlo.
- **Supabase:** sacarlo del plan gratuito (se pausa solo a los 7 días sin uso; ya pasó),
  revisar los backups, aplicar las migraciones 0024, 0025 y 0026 en ese orden, configurar un
  servidor de mail propio (el de fábrica manda pocos por hora), captcha en el alta y en
  recuperar, y un tope de intentos de ingreso.
- **Datos legales del responsable:** razón social, CUIT y domicilio en `/privacidad` y
  `/terminos`, inscribir la base de datos ante la AAIP, y la consulta al abogado por el derecho
  de arrepentimiento.
- **Una base nueva desde cero** se arma corriendo `supabase/migrations/` en orden, de la 0001
  a la última. El archivo "todo en uno" que había (`setup-completo.sql`) se retiró el 3/10:
  llegaba hasta la 0015 y recrear la base con él volvía a abrir agujeros ya cerrados.

---

## 1. La región: al lado de la base, no al lado de la gente

La base de Supabase está en **Virginia (us-east-1)**. Cada vez que alguien abre una página,
el servidor hace varias consultas seguidas a la base antes de responder. Si el servidor está
en São Paulo, cada una de esas consultas cruza el continente (~120 ms ida y vuelta); si está
en Virginia, cada una tarda unos pocos milisegundos.

| Servidor en | La persona → el servidor | Servidor → base, × 5 consultas | Total aproximado |
|---|---|---|---|
| São Paulo (`southamerica-east1`) | ~30 ms | ~600 ms | **~630 ms** |
| Virginia (`us-east1`) | ~130 ms | ~10 ms | **~140 ms** |

Son latencias típicas entre esas regiones, no medidas desde acá; lo que no cambia es el orden
de magnitud: cinco cruces de continente pesan más que uno. Por eso: **la web va en `us-east1`**. El vigilante puede quedar en São Paulo (mira el sitio
desde cerca de la gente, que es lo que tiene que medir).

Si algún día se muda la base de Supabase a São Paulo, se muda también la web.

## 2. Una sola vez: preparar el proyecto (consola o `gcloud`)

```bash
export PROYECTO=el-id-de-tu-proyecto
export REGION=us-east1
gcloud config set project $PROYECTO
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# Dónde se guardan las imágenes
gcloud artifacts repositories create pinturapro --repository-format=docker --location=$REGION
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# La cuenta con la que corre la web: sólo puede leer SUS secretos
gcloud iam service-accounts create pinturapro-web --display-name="Web de Pintura Pro"
```

**Poné un presupuesto con alerta** en *Billing → Budgets & alerts* antes de seguir.

## 3. Los secretos van a Secret Manager, nunca a la imagen

Una clave dentro de una imagen queda para siempre en su historial, aunque después se borre.
Por eso la imagen se construye SIN secretos (verificado: la clave de servicio no aparece en
ningún archivo ni capa) y se le inyectan al correr.

```bash
# Cada secreto, una vez. `printf '%s'` para que no se cuele un salto de línea.
printf '%s' 'LA-CLAVE' | gcloud secrets create supabase-service-role --data-file=-
printf '%s' 'LA-CLAVE' | gcloud secrets create resend-api-key --data-file=-
printf '%s' 'EL-TOKEN' | gcloud secrets create replicate-api-token --data-file=-

for s in supabase-service-role resend-api-key replicate-api-token; do
  gcloud secrets add-iam-policy-binding $s \
    --member="serviceAccount:pinturapro-web@${PROYECTO}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

La **clave de servicio de Supabase** es la más peligrosa del sistema: saltea todas las reglas
de seguridad de la base. Ya se pegó en el chat alguna vez: **rotala** (Supabase → Settings →
API) antes de cargarla acá.

### Qué variable va dónde

| Variable | Dónde | Por qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DATOS_DEMO` | Argumento de compilación (sólo) | Se hornean en el código al compilar: cambiarlas es recompilar la imagen |
| `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `REPLICATE_API_TOKEN`, `SAM_BACKEND_TOKEN`, `COTIZACION_TOKEN` | Secret Manager | Secretas |
| `RESEND_FROM`, `LEADS_NOTIFY_EMAIL`, `REPLICATE_VERSION`, `REPLICATE_DEPLOYMENT`, `REPLICATE_POINTS_PER_SIDE`, `REPLICATE_PRED_IOU_THRESH`, `REPLICATE_STABILITY_THRESH`, `SAM_BACKEND_URL` | Variable de entorno | Configuración, no secreta |

## 4. Construir y subir la imagen

La compilación no baja nada de internet salvo las dependencias de npm: las tipografías viven en
el repo (`apps/web/app/fonts/`) desde el 29/9. Antes se bajaban de Google en cada build, y una
compilación llegó a fallar ahí sin que cambiara una línea de código.

Desde la raíz del repositorio (no desde `apps/web`):

```bash
VERSION=$(git rev-parse --short HEAD)
IMAGEN=${REGION}-docker.pkg.dev/${PROYECTO}/pinturapro/web:${VERSION}

# --platform: desde una Mac con chip Apple, Docker arma para ARM por defecto y Cloud Run
# corre en x86. Sin esto la imagen se sube bien y después no arranca.
docker build --platform linux/amd64 -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://ojdtixmysrfywgvowqie.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=LA-ANON-KEY \
  --build-arg NEXT_PUBLIC_SITE_URL=https://el-dominio \
  --build-arg NEXT_PUBLIC_DATOS_DEMO=true \
  -t $IMAGEN .
docker push $IMAGEN
```

La imagen pesa ~355 MB. Sin el modo `standalone` hubiera tenido que llevar el `node_modules`
entero del monorepo (~980 MB).

## 5. Desplegar

```bash
gcloud run deploy pinturapro-web \
  --image=$IMAGEN --region=$REGION \
  --service-account=pinturapro-web@${PROYECTO}.iam.gserviceaccount.com \
  --allow-unauthenticated --port=8080 \
  --memory=1Gi --cpu=1 --concurrency=40 \
  --min-instances=0 --max-instances=4 \
  --session-affinity \
  --set-secrets=SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest,RESEND_API_KEY=resend-api-key:latest,REPLICATE_API_TOKEN=replicate-api-token:latest \
  --set-env-vars=REPLICATE_VERSION=fe97b453a6455861e3bac769b441ca1f1086110da7466dbb65cf1eecfd60dc83,REPLICATE_POINTS_PER_SIDE=16,RESEND_FROM="Pintura Pro <hola@el-dominio>",LEADS_NOTIFY_EMAIL=tu-casilla@el-dominio
```

Por qué cada número:

- **`REPLICATE_VERSION`** (o `REPLICATE_DEPLOYMENT`, si creás un deployment para que no
  arranque en frío): sin ninguna de las dos, el simulador con IA contesta 503 aunque el token
  esté cargado, y cae al pincel manual. El sitio "anda", así que es fácil no notarlo. Lo marcó
  el agente `listo-para-publicar`.
- **`REPLICATE_POINTS_PER_SIDE=16`**: el código usa 32 si no se lo dice, y cada análisis
  cuesta el doble. 16 alcanza (ver `.env.example`).
- **Las `NEXT_PUBLIC_*` NO van acá**: se hornean al compilar (paso 4), y cargarlas en la
  ejecución no cambia nada — sólo hace creer que alcanza con cambiarlas ahí.

- **`--max-instances=4`**: el tope de gasto real. Dos cuotas viven en la memoria de cada
  instancia —el simulador con IA (12 por hora por persona) y el anti-spam de los formularios
  (5 por hora)—, así que con N instancias el tope es N veces eso. Sin este límite, Cloud Run
  levanta las que quiera y el simulador con IA se paga por uso.
- **`--session-affinity`**: las páginas públicas (portada, pintores, obras, perfiles) leen sus
  datos de una caché de 60 segundos que vive EN CADA INSTANCIA (`lib/cache-publico.ts`). Cuando
  un pintor guarda su perfil, la instancia que lo atendió limpia su caché al instante — las
  otras no se enteran y pueden mostrar lo viejo hasta un minuto. Con afinidad, Cloud Run manda a
  la misma persona a la misma instancia mientras exista, así que quien hizo el cambio lo ve
  enseguida; el resto lo ve, como mucho, un minuto después. Si algún día hace falta que sea
  instantáneo para todos, el camino es un `cacheHandler` compartido (Redis/Memorystore), que
  cuesta plata todo el mes: no vale la pena antes de tener tráfico.
- **`--min-instances=0`**: no se paga nada mientras nadie entra. La primera visita después de
  un rato tarda unos segundos más en arrancar. Si eso molesta, `1` la deja siempre encendida
  (se paga las 24 h).
- **`--memory=1Gi`**: el optimizador de imágenes de Next procesa las fotos dentro del
  contenedor. Con menos, una foto grande puede tumbar la instancia.

## 6. El dominio y las direcciones que tiene que conocer cada servicio (consola)

1. **Verificar que el dominio es tuyo en Google Search Console** (search.google.com/search-console):
   Cloud Run no acepta mapear un dominio que no verificaste, y es lo que más traba este paso
   la primera vez.
2. **Cloud Run → Manage custom domains**: mapear `el-dominio` al servicio.
3. **Supabase → Authentication → URL Configuration** — imprescindible, medido el 28/9: hoy la
   "Site URL" es la del Codespace, y el mail de "olvidé mi contraseña" manda a la gente AHÍ, a
   una dirección muerta. Poner la Site URL del dominio real y agregar en "Redirect URLs":
   `https://el-dominio/auth/callback` y `https://el-dominio/nueva-contrasena`.
4. **Supabase → Authentication → Email → "Secure password change"**: activarla.
5. **Google, Microsoft y Facebook** (las apps de login social): agregar el dominio nuevo a sus
   direcciones de redirección permitidas. Ver `docs/auth-oauth.md`.
6. **Resend**: verificar el dominio para poder mandar desde `hola@el-dominio`.

### La tarea del dólar (suscripción del pintor, etapa 2)

La suscripción cuesta US$5 y se cobra en pesos al dólar oficial del Banco Nación del día. La web
no adivina el dólar: lo lee una tarea que dispara **Cloud Scheduler 3 veces por día hábil**
llamando a `POST /api/cotizacion/actualizar` con un token propio (ver
`apps/web/lib/pagos/cotizacion.ts`). Sin token configurado la ruta responde 503 y el precio en
pesos no aparece.

```bash
# El token: largo y al azar. Va a Secret Manager (para la web) y al trabajo de Scheduler.
TOKEN=$(openssl rand -hex 32)
printf '%s' "$TOKEN" | gcloud secrets create cotizacion-token --data-file=-
gcloud secrets add-iam-policy-binding cotizacion-token \
  --member="serviceAccount:pinturapro-web@${PROYECTO}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# En el `gcloud run deploy` de la sección 5, sumar: --set-secrets=COTIZACION_TOKEN=cotizacion-token:latest

# 10:30, 13:00 y 16:00, de lunes a viernes, hora argentina.
for h in "30 10" "0 13" "0 16"; do
  gcloud scheduler jobs create http "cotizacion-dolar-${h// /-}" --location=${REGION} \
    --schedule="${h} * * 1-5" --time-zone="America/Argentina/Buenos_Aires" \
    --http-method=POST --uri="https://el-dominio/api/cotizacion/actualizar" \
    --headers="Authorization=Bearer ${TOKEN}" --attempt-deadline=60s
done
```

Si la lectura salta más de 10 % o las fuentes no coinciden, la tarea escribe un ERROR en el log
(dispara la alerta por logs) y el salto se confirma a mano en **/admin → Cobro**. El vigilante
avisa si pasan 48 h sin una lectura nueva.

## 7. El vigilante 24/7

Ya está armado para Google: `docs/vigilancia-google-cloud.md`. Apuntalo al dominio real:

```bash
PINTURAPRO_URL=https://el-dominio bash tools/auditoria/vigilancia/desplegar.sh
```

## 8. Cada publicación nueva

```bash
pnpm verificar                                   # las pruebas de regresión, contra desarrollo
bash tools/auditoria/produccion.sh               # compila producción aparte y la sirve en :3100
PINTURAPRO_URL=http://localhost:3100 node tools/auditoria/vigilancia/revisar.mjs
# si todo da verde: los pasos 4 y 5 con la VERSION nueva
```

Volver atrás es desplegar la imagen anterior: `gcloud run services update-traffic
pinturapro-web --region=$REGION --to-revisions=LA-REVISION-ANTERIOR=100`.

## Cuánto cuesta, más o menos

Estimado por el agente `nube-google` (29/9, precios de lista de us-east1, sin verificar en la
consola): a **1.000 visitas por día**, centavos; a **10.000**, alrededor de un dólar por mes; a
**100.000**, unos US$ 50 por mes de cómputo si cada visita consultara la base, y menos de US$ 1
con la caché de las páginas públicas (que ya está). A ese volumen pesa más la salida de datos
(~US$ 115 por mes sin un CDN delante) que el cómputo. Detalle y supuestos en
`tools/auditoria/rondas/2026-09-28-escala/nube-google.md`.

Con poco tráfico, casi todo entra en el nivel gratuito de Cloud Run (se cobra sólo mientras
atiende pedidos). Lo que puede crecer: el simulador con IA (Replicate, por uso — poné un tope
de gasto también ahí) y, si se usa `--min-instances=1`, la instancia encendida todo el día.
