/**
 * Las lecturas de la base, partidas por tema. Este archivo sólo re-exporta: quien importa
 * `@/lib/queries` no cambió nada.
 *
 * Era un solo archivo de más de 1.500 líneas que mezclaba pintores, obras, pedidos, reseñas,
 * contenido y las métricas del dueño: cualquier cambio tocaba el archivo que usan 27 pantallas.
 * Se partió el 1/10/2026 con el corte que propuso el agente `arquitectura-modular`, moviendo
 * cada función con su comentario, sin reescribir ninguna. Es el paso previo a `packages/datos`
 * (docs/arquitectura.md).
 */
export { ErrorDeLecturaDeDatos, formatARS } from "./base";
export { getPainters, getPainterById, ErrorDeLecturaDePerfil, getOwnProfile, getPainterExtras } from "./pintores";
export type { PainterDetail, OwnProfile } from "./pintores";
export { getProjects, getProjectBySlug, getProjectsByOwner, getOwnedProjectBySlug } from "./obras";
export type { OwnedProjectForm } from "./obras";
export { getReviewsForPainter, getRecentReviews, conNombresDeAutores } from "./resenas";
export type { ReviewView, Testimonial } from "./resenas";
export { getJobsForClient, getJobsForPainter, getOpenServiceRequests, getPedidosYaCotizados, getQuotesForClient, getPedidosDelCliente, getContactoDelTrabajo, getMiTelefono } from "./pedidos";
export type { ClientJobView, JobView, ServiceRequest, QuoteView, PedidoPropio, ContactoContraparte } from "./pedidos";
export { getFaqs, getResources, getNews } from "./contenido";
export {
  getCondicionesDeCobro,
  getMiAcceso,
  getMetricasSuscripciones,
  getCotizacionesParaAdmin,
  getCancelacionesTrasAceptar,
} from "./suscripciones";
export type {
  CondicionesDeCobro,
  MiAcceso,
  MetricasSuscripciones,
  CotizacionAdmin,
  CancelacionTrasAceptar,
} from "./suscripciones";
export type { Faq, ResourceKind, Resource, NewsItem } from "./contenido";
export {
  getLeads,
  getMetricasPlataforma,
  getVolumenMensual,
  getActividadReciente,
  getNumerosReales,
  getResenasParaModerar,
} from "./metricas-admin";
export type {
  LeadView,
  MetricasPlataforma,
  MesVolumen,
  ActividadItem,
  NumerosReales,
  ResenaParaModerar,
} from "./metricas-admin";
