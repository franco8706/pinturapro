# Simulador de pintura — Evaluación de APIs de pago (Nivel 3)

Resumen de la investigación para llevar el simulador a **precisión tipo PhotoRoom**.
Conclusión probada: **ningún modelo gratuito** (SAM, segmentación semántica, inpainting
generativo) da máscaras de pared automáticas y quirúrgicas de forma fiable. Para ese nivel
hay que pagar. Dos caminos reales:

---

## Opción A — Wizart AI ⭐ (hecha a propósito para pintura)

Visualizador de pintura sobre paredes con IA, **interior y exterior/fachadas**, con
segmentación semántica de superficies. Es el producto más parecido a "PhotoRoom para
pintura".

- Web API: https://wizart.ai/api-visualizer
- Para developers: https://wizart.ai/api-visualizer-for-developers
- Exterior/fachadas: https://wizart.ai/exteriors-visualizer
- AWS Marketplace: https://aws.amazon.com/marketplace/pp/prodview-mz6euuq6qz3bk
- **Precio:** enterprise, por contrato (hablar con ventas). No publican número; pago mensual por uso.

### Qué pedirle a ventas de Wizart (brief listo para enviar)

> Somos **Pintura Pro**, una plataforma web de pintura profesional (empresa + marketplace de
> pintores) en Argentina. Queremos integrar un **visualizador de color sobre foto del cliente**:
> sube una foto de su pared/fachada, elige un color de nuestra carta (marcas Alba, Sherwin
> Williams, Sinteplast, Plavicon) y lo ve aplicado de forma realista.
>
> Necesitamos saber:
> 1. ¿La API soporta **interior y exterior (fachadas)**? (nuestro caso incluye revoques/fachadas)
> 2. ¿Detección **automática** de la pared o requiere intervención del usuario?
> 3. ¿Podemos usar **nuestros propios colores exactos (hex/brand)** o solo su catálogo?
> 4. **Modelo de integración:** REST API directa vs widget/plugin embebido. ¿Tienen REST que
>    devuelva la imagen renderizada o la máscara?
> 5. **Precio:** por imagen / por mes / por volumen. Rango para ~X imágenes/mes.
> 6. ¿Hay **trial / demo** para evaluar calidad con nuestras fotos antes de contratar?
> 7. Latencia típica por imagen y SLA.

---

## Opción B — Bria AI (API pro, precio transparente, la armás vos)

API de edición profesional con modelos licenciados (seguros comercialmente).
**NO es específica de pintura** — da las piezas (máscaras + generative fill) y vos ensamblás
el recoloreo. Ojo: usa los **mismos bloques** que ya probamos gratis (máscaras tipo SAM +
inpainting), así que puede arrastrar el límite de "el inpainting no respeta el color exacto".
El recoloreo exacto conviene hacerlo con **tint + composite** sobre la máscara de Bria
(la máscara de Bria suele ser de mejor calidad que SAM crudo).

- Docs: https://docs.bria.ai/image-editing
- Pricing: https://bria.ai/pricing — **US$0,08/imagen** (self-service) + **1000 acciones gratis**
- Base URL: `https://engine.prod.bria-api.com`
- Auth: header `api_token: <TU_KEY>`
- Endpoints relevantes:
  - `POST /v2/image/edit/gen_fill` — generative fill (image, mask, prompt)
  - `POST /v2/image/edit/remove_background`
  - `/objects/mask_generator` — genera todas las máscaras posibles (tipo SAM)
  - ⚠️ v2 es **asíncrono**: devuelve `request_id` + `status_url` para pollear.

### Cómo probar Bria (1000 acciones gratis)

1. Crear cuenta en https://bria.ai y sacar el **API token** (sección API/Platform).
2. Ponelo en `apps/web/.env.local` como `BRIA_API_TOKEN=...` (NO se commitea).
3. Correr el harness:
   ```bash
   cd apps/web
   node scripts/test-bria-wall.mjs <imagen.jpg|url> <mascara.png|url> "deep navy blue"
   ```
   (la máscara: blanco = pared a repintar, negro = preservar)
4. Mira `bria-result.png`. Comparamos contra el método gratis y decidimos.

---

## Recomendación

- **Wizart** = la apuesta si esto va a ser un producto serio con presupuesto (es el fit exacto;
  interior + fachadas; llave en mano). Requiere demo/contrato.
- **Bria** = test rápido y barato (1000 gratis) para ver cuánto mejora la calidad sobre lo
  gratuito, pero gestiona expectativas: son los mismos bloques mejor terminados.
- El recoloreo de **color exacto** (hex de marca) casi siempre conviene cerrarlo con
  **tint + composite** sobre una buena máscara — eso ya lo tenemos en el cliente.
