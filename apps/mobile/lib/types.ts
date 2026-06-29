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
