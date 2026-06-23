# Wizart — contacto comercial (listo para enviar)

Wizart es **enterprise**: no hay key self-service. El primer paso es pedir **demo + precio** a
ventas. Mandar desde el mail de la empresa. Contacto: https://wizart.ai/api-visualizer
(botón "Request a demo" / "Contact us") o el form de https://wizart.ai/vision-api.

> ⚠️ NO borrar el backend actual (Replicate) hasta que Wizart esté contratado, integrado y
> probado. Replicate es el puente mientras dura el proceso comercial.

---

## Versión en inglés (recomendada — su equipo de ventas trabaja en inglés)

**Subject:** API demo request — wall paint visualizer (interior + exterior) for a painting platform

Hi Wizart team,

We're **Pintura Pro**, a professional painting platform from Argentina (company portfolio +
a marketplace of verified painters). We want to add a **paint color visualizer**: a customer
uploads a photo of their wall or house facade, picks a color from our catalog, and sees it
applied realistically.

Before moving forward we'd like a demo and pricing. A few specific questions:

1. Do you support **both interior walls and exterior facades**? Our use case includes
   plastered exterior walls / building facades.
2. Is wall/surface detection **fully automatic**, or does the end user need to assist?
3. Can we use **our own exact brand colors** (hex values from Alba, Sherwin Williams,
   Sinteplast, Plavicon), or only colors from your catalog?
4. **Integration model:** do you offer a **REST API** that returns the rendered image (and/or
   the surface mask), or only an embeddable widget? We're on Next.js.
5. **Pricing:** per image / monthly / by volume. A ballpark for ~[X] images/month would help.
6. Is there a **trial or sandbox** so we can evaluate quality **with our own photos** before
   committing?
7. Typical **latency** per image and any **SLA**.

Could we book a short demo using a few of our own facade/interior photos? Thanks!

[Nombre] — Pintura Pro — [email] — [web/repo]

---

## Versión en español (por si el contacto habla español)

**Asunto:** Demo de API — visualizador de pintura (interior + fachadas) para plataforma de pintura

Hola equipo de Wizart,

Somos **Pintura Pro**, una plataforma de pintura profesional de Argentina (portfolio de empresa
+ marketplace de pintores verificados). Queremos sumar un **visualizador de color**: el cliente
sube una foto de su pared o fachada, elige un color de nuestra carta y lo ve aplicado de forma
realista.

Antes de avanzar quisiéramos una demo y precios. Consultas puntuales:

1. ¿Soportan **interior y exterior (fachadas)**? Nuestro caso incluye revoques/fachadas.
2. ¿La detección de la pared es **automática** o el usuario tiene que ayudar?
3. ¿Podemos usar **nuestros colores exactos** (hex de Alba, Sherwin Williams, Sinteplast,
   Plavicon) o solo su catálogo?
4. **Integración:** ¿tienen **REST API** que devuelva la imagen renderizada (y/o la máscara de
   la superficie), o solo un widget embebido? Estamos en Next.js.
5. **Precio:** por imagen / mensual / por volumen. Un rango para ~[X] imágenes/mes nos ayuda.
6. ¿Hay **trial o sandbox** para evaluar la calidad **con nuestras fotos** antes de contratar?
7. **Latencia** típica por imagen y **SLA**.

¿Podemos coordinar una demo corta con algunas fotos nuestras (fachadas/interior)? ¡Gracias!

[Nombre] — Pintura Pro — [email] — [web]

---

## Qué necesito yo de Wizart para integrarlo (pedírselo en la demo)

Para construir la integración voy a necesitar:
- **Documentación de la API** (endpoints, auth, formato de request/response).
- **Credenciales de sandbox/trial** (API key de prueba).
- Si devuelve **imagen renderizada** o **máscara** (define la arquitectura).
- Si acepta **color hex propio** o hay que mapear a su catálogo.
- Límites de **resolución** y **rate limits**.

Con eso, agrego un adapter de Wizart al backend (junto a Replicate) y migramos sin romper nada.
