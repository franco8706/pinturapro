export interface Project {
  id: string;
  slug: string;
  title: string;
  location: string;
  category: "Residencial" | "Comercial" | "Industrial";
  accentColor: string;
  year: number;
  description: string;
  images: string[];
  beforeAfter?: { before: string; after: string };
}

export interface Painter {
  id: string;
  name: string;
  level: "Silver" | "Gold" | "Master";
  rating: number;
  reviews: number;
  specialty: string[];
  zone: string;
  image: string;
  portfolio: string[];
}

export interface QuoteRequest {
  id: string;
  type: "interior" | "exterior" | "ambos";
  surface: number;
  rooms: string[];
  photos: string[];
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  status: "pending" | "quoted" | "accepted" | "completed";
}

export const mockProjects: Project[] = [
  {
    id: "1",
    slug: "casa-barracas",
    title: "Casa Barracas",
    location: "Barracas, CABA",
    category: "Residencial",
    accentColor: "#C41E3A",
    year: 2025,
    description: "Renovación completa de interior con paleta cálida. Paredes en tono terracota profundo, cielorraso en blanco hueso y detalles en negro mate.",
    images: ["casa-barracas-1.jpg", "casa-barracas-2.jpg", "casa-barracas-3.jpg"],
    beforeAfter: { before: "casa-barracas-before.jpg", after: "casa-barracas-after.jpg" },
  },
  {
    id: "2",
    slug: "loft-palermo",
    title: "Loft Palermo",
    location: "Palermo, CABA",
    category: "Comercial",
    accentColor: "#1E3A8A",
    year: 2025,
    description: "Espacio de coworking con identidad corporativa. Azul institucional combinado con gris cemento y toques de cobre en detalles.",
    images: ["loft-palermo-1.jpg", "loft-palermo-2.jpg"],
  },
  {
    id: "3",
    slug: "estudio-nordelta",
    title: "Estudio Nordelta",
    location: "Nordelta, Tigre",
    category: "Residencial",
    accentColor: "#2D5A3D",
    year: 2024,
    description: "Casa unifamiliar con integración paisajística. Verdes oscuros, madera natural y blanco puro para un resultado orgánico.",
    images: ["estudio-nordelta-1.jpg", "estudio-nordelta-2.jpg", "estudio-nordelta-3.jpg"],
    beforeAfter: { before: "estudio-before.jpg", after: "estudio-after.jpg" },
  },
];

export interface Job {
  id: string;
  title: string;
  type: "interior" | "exterior" | "ambos";
  surface: number;
  zone: string;
  budget: string;
  postedAt: string;
  quotes: number;
  status: "abierto" | "cotizando" | "adjudicado";
}

export interface Review {
  id: string;
  painterId: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
  project?: string;
}

export const mockPainters: Painter[] = [
  {
    id: "p1",
    name: "Martín Rojas",
    level: "Master",
    rating: 4.9,
    reviews: 47,
    specialty: ["Residencial", "Esmaltes", "Texturas"],
    zone: "CABA",
    image: "painter-martin.jpg",
    portfolio: ["obra-martin-1.jpg", "obra-martin-2.jpg"],
  },
  {
    id: "p2",
    name: "Lucía Fernández",
    level: "Gold",
    rating: 4.7,
    reviews: 32,
    specialty: ["Comercial", "Interiores", "Diseño"],
    zone: "Zona Norte",
    image: "painter-lucia.jpg",
    portfolio: ["obra-lucia-1.jpg", "obra-lucia-2.jpg"],
  },
  {
    id: "p3",
    name: "Diego Sosa",
    level: "Silver",
    rating: 4.5,
    reviews: 18,
    specialty: ["Exteriores", "Frentes", "Impermeabilización"],
    zone: "Zona Oeste",
    image: "painter-diego.jpg",
    portfolio: ["obra-diego-1.jpg", "obra-diego-2.jpg"],
  },
];

export const mockReviews: Review[] = [
  {
    id: "r1",
    painterId: "p1",
    author: "Carolina M.",
    rating: 5,
    date: "Mar 2026",
    comment: "Impecable. Martín cuidó cada detalle, respetó los tiempos y el acabado de los esmaltes quedó perfecto.",
    project: "Living + comedor, Caballito",
  },
  {
    id: "r2",
    painterId: "p1",
    author: "Estudio Verde Arq.",
    rating: 5,
    date: "Feb 2026",
    comment: "Trabajamos con el equipo en tres obras. Profesionalismo total y muy buena lectura de la paleta del proyecto.",
    project: "Dúplex Villa Crespo",
  },
  {
    id: "r3",
    painterId: "p1",
    author: "Hernán T.",
    rating: 4,
    date: "Ene 2026",
    comment: "Muy buen resultado. Una demora menor por el clima, pero comunicó todo a tiempo.",
    project: "Frente y medianera",
  },
];

export const mockJobs: Job[] = [
  {
    id: "j1",
    title: "Pintura interior departamento 2 ambientes",
    type: "interior",
    surface: 55,
    zone: "Palermo, CABA",
    budget: "$280.000 – $360.000",
    postedAt: "Hace 2 horas",
    quotes: 3,
    status: "cotizando",
  },
  {
    id: "j2",
    title: "Frente de casa + medianera",
    type: "exterior",
    surface: 90,
    zone: "San Isidro, Zona Norte",
    budget: "$450.000 – $600.000",
    postedAt: "Hace 1 día",
    quotes: 5,
    status: "cotizando",
  },
  {
    id: "j3",
    title: "Local comercial completo",
    type: "ambos",
    surface: 120,
    zone: "Microcentro, CABA",
    budget: "$700.000 – $900.000",
    postedAt: "Hace 3 días",
    quotes: 0,
    status: "abierto",
  },
];
