/**
 * Tipos de la base (espejo de supabase/migrations/0001_init.sql).
 * Cuando la BD esté creada, podés regenerarlos automáticamente con:
 *   npx supabase gen types typescript --project-id <ref> > apps/web/lib/supabase/types.ts
 * Por ahora es una versión escrita a mano para tipar las queries.
 */
export type ProfileType = "company" | "painter" | "client";
export type ProjectType = "portfolio" | "service";
export type ProjectCategory = "Residencial" | "Comercial" | "Industrial";
export type JobStatus =
  | "draft"
  | "published"
  | "quoted"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface Profile {
  id: string;
  type: ProfileType;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  rating: number;
  rating_count: number;
  specialties: string[];
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  type: ProjectType;
  title: string;
  slug: string | null;
  description: string | null;
  cover_url: string | null;
  images: string[];
  location: string | null;
  lat: number | null;
  lng: number | null;
  budget_min: number | null;
  budget_max: number | null;
  category: ProjectCategory;
  accent_color: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  project_id: string | null;
  client_id: string;
  painter_id: string | null;
  status: JobStatus;
  amount: number | null;
  commission_rate: number;
  commission_amount: number | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  author_id: string;
  target_id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
}

type Row<T> = T;
type Insert<T, Opt extends keyof T> = Omit<T, Opt> & Partial<Pick<T, Opt>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Row<Profile>;
        Insert: Insert<Profile, "created_at" | "updated_at" | "verified" | "rating" | "rating_count" | "type">;
        Update: Partial<Profile>;
      };
      projects: {
        Row: Row<Project>;
        Insert: Insert<Project, "id" | "created_at" | "updated_at" | "images" | "published">;
        Update: Partial<Project>;
      };
      jobs: {
        Row: Row<Job>;
        Insert: Insert<Job, "id" | "created_at" | "updated_at" | "status" | "commission_rate">;
        Update: Partial<Job>;
      };
      reviews: {
        Row: Row<Review>;
        Insert: Insert<Review, "id" | "created_at" | "photos">;
        Update: Partial<Review>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      profile_type: ProfileType;
      project_type: ProjectType;
      job_status: JobStatus;
    };
  };
}
