# Infraestructura y escalado — Pintura Pro

Decisión de arquitectura para escalar web + app móvil (Android/iOS).

## Principio: web y móvil comparten un solo backend

```
   Web (Next.js / Vercel) ─┐
                           ├──►  Supabase (Postgres + Auth + Storage)  ← escala solo
   App móvil (Expo) ───────┘            ▲
                                        │
        Servicios propios en contenedores (solo cuando hagan falta):
        IA del simulador · matching de pintores · workers en segundo plano
```

- **Supabase** ya es el backend escalable (corre sobre AWS, con pooling de conexiones,
  réplicas y storage). La **app móvil usa el mismo Supabase** vía su SDK oficial. No se
  reconstruye infraestructura para el móvil.
- Los **contenedores** se necesitan para **servicios propios puntuales**, no para "toda la app".

## Proveedor de nube (para contenedores)

| Proveedor | Para nuestro caso | Veredicto |
|---|---|---|
| **AWS** | Supabase ya vive en AWS → co-locar contenedores en la **misma región** baja latencia con la DB. **Fargate** = contenedores sin manejar servidores ni Kubernetes. Región São Paulo. | **Recomendado** |
| **Google Cloud** | **Cloud Run**: subís un contenedor y escala solo (incluso a cero). Lo más simple/barato al arrancar. | Alternativa fuerte |
| **Azure** | Mejor en entornos Microsoft/.NET/empresa. No aporta ventaja para este stack JS + Supabase. | No para este perfil |

**Elección:** **AWS + Fargate**, misma región que el proyecto Supabase (verificar en
Supabase → Settings → General). Co-locación con la base + techo de escala alto + sin Kubernetes.
Si se prioriza simplicidad/costo: **Google Cloud Run**.

## Plan por fases (para no sobre-invertir)

1. **Hoy:** Web en **Vercel** + Supabase. Móvil → Supabase. **Cero contenedores.** Aguanta miles de usuarios.
2. **Cuando aparezca un servicio propio pesado** (IA del simulador, matching): un contenedor en
   **Fargate** (AWS) o **Cloud Run** (GCP).
3. **Kubernetes (EKS/AKS/GKE): todavía no.** Overkill para equipo chico; se justifica con varios
   servicios y equipo de DevOps.

> Un contenedor Docker bien hecho se mueve entre AWS/GCP en un día. Lo que ata es la base de datos,
> y esa ya está en Supabase. No hace falta casarse con un proveedor de entrada.

## Pagos (cross-plataforma)

**Stripe** funciona igual para web y móvil. Ojo: en iOS/Android, vender **bienes digitales** obliga
a usar la compra in-app de Apple/Google (comisión ~15-30%); pero el cobro de **servicios del mundo
real** (como contratar a un pintor) va por Stripe normal. La comisión del marketplace se cobra con
**Stripe Connect**.
