export type Level = "Silver" | "Gold" | "Master";

export interface Painter {
  id: string;
  name: string;
  level: Level;
  rating: number;
  reviews: number;
  zone: string;
  specialty: string[];
  image: string;
}

export interface PainterDetail extends Painter {
  bio: string;
  pros: string[];
  cons: string[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  location: string;
  cover: string;
}

export interface ServiceRequest {
  id: string;
  title: string;
  description: string;
  location: string;
  budgetMin: number | null;
  budgetMax: number | null;
  ownerId: string;
  ownerName: string;
}

export type JobStatus = "quoted" | "accepted" | "completed" | "cancelled";

/** Una cotización recibida por el cliente (job en estado quoted/accepted/completed). */
export interface Quote {
  id: string;
  projectId: string;
  projectTitle: string;
  status: JobStatus;
  amount: number | null;
  note: string;
  painterId: string;
  painterName: string;
  painterImage: string;
  painterRating: number;
  reviewed: boolean;
}

/** Un trabajo desde la mirada del pintor (sus cotizaciones y trabajos en curso). */
export interface PainterJob {
  id: string;
  projectId: string;
  projectTitle: string;
  status: JobStatus;
  amount: number | null;
  note: string;
  clientId: string;
  clientName: string;
}

export type ResourceKind = "guide" | "video" | "course" | "advice";

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  body: string;
  mediaUrl: string;
  level: string;
  duration: string;
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  publishedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

/** Perfil propio editable (pintor / empresa). */
export interface MyProfile {
  id: string;
  fullName: string;
  bio: string;
  location: string;
  specialties: string[];
  pros: string[];
  cons: string[];
  avatarUrl: string;
}
