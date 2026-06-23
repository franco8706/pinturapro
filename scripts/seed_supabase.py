#!/usr/bin/env python3
"""
Siembra datos de demo NORMALIZADOS en Supabase.
Requiere que ya estén corridas las migraciones 0001 y 0002.

- Crea usuarios de Auth → el trigger crea los profiles.
- Completa profiles (incluye specialties) y projects (incluye category + accent_color).
- Genera VARIAS reseñas por pintor: el trigger de 0002 recalcula rating/rating_count solo.
- Idempotente: limpia jobs/reviews de los pintores demo antes de recrearlos.

Uso:  SUPABASE_URL=... SUPABASE_SECRET=... python3 scripts/seed_supabase.py
"""
import os, json, urllib.request, urllib.error
from datetime import datetime, timedelta, timezone

URL = os.environ["SUPABASE_URL"].rstrip("/")
SEC = os.environ["SUPABASE_SECRET"]
H = {"apikey": SEC, "Authorization": f"Bearer {SEC}", "Content-Type": "application/json"}


def req(method, path, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(URL + path, data=data, method=method, headers={**H, **(headers or {})})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def ensure_user(email, password, full_name, ptype):
    st, body = req("POST", "/auth/v1/admin/users", {
        "email": email, "password": password, "email_confirm": True,
        "user_metadata": {"full_name": full_name, "type": ptype},
    })
    if st in (200, 201):
        return body["id"]
    st, body = req("GET", "/auth/v1/admin/users?per_page=200")
    users = body.get("users", body) if isinstance(body, dict) else body
    for u in users:
        if u.get("email") == email:
            return u["id"]
    raise RuntimeError(f"No pude crear/encontrar {email}: {st} {body}")


def patch_profile(uid, fields):
    st, body = req("PATCH", f"/rest/v1/profiles?id=eq.{uid}", fields, {"Prefer": "return=minimal"})
    if st not in (200, 204):
        print("   ⚠ profile patch", uid[:8], st, body)


def upsert(table, rows, on_conflict=None):
    path = f"/rest/v1/{table}" + (f"?on_conflict={on_conflict}" if on_conflict else "")
    st, body = req("POST", path, rows, {"Prefer": "resolution=merge-duplicates,return=representation"})
    if st not in (200, 201):
        print(f"   ⚠ {table} insert", st, body)
        return []
    return body or []


def iso_months_ago(m):
    return (datetime.now(timezone.utc) - timedelta(days=30 * m)).isoformat()


# ───────────────── 1) Usuarios + perfiles (con specialties) ─────────────────
print("1) Usuarios y perfiles…")
PEOPLE = [
    ("empresa@pinturapro.demo", "Pintura Pro", "company", {
        "bio": "Pintura profesional de obra. Más de 200 proyectos entregados en CABA y GBA.",
        "location": "CABA", "lat": -34.6037, "lng": -58.3816, "verified": True,
        "specialties": ["Obra nueva", "Comercial", "Residencial"]}),
    ("martin.rojas@pinturapro.demo", "Martín Rojas", "painter", {
        "bio": "Especialista en residencial, esmaltes y texturas. Acabados premium.",
        "location": "Palermo, CABA", "lat": -34.5889, "lng": -58.4306, "verified": True,
        "specialties": ["Residencial", "Esmaltes", "Texturas"]}),
    ("lucia.fernandez@pinturapro.demo", "Lucía Fernández", "painter", {
        "bio": "Comercial e interiores con mirada de diseño. Locales y oficinas.",
        "location": "San Isidro, Zona Norte", "lat": -34.4708, "lng": -58.5126, "verified": True,
        "specialties": ["Comercial", "Interiores", "Diseño"]}),
    ("diego.sosa@pinturapro.demo", "Diego Sosa", "painter", {
        "bio": "Exteriores, frentes e impermeabilización. Trabajo prolijo y a tiempo.",
        "location": "Morón, Zona Oeste", "lat": -34.6534, "lng": -58.6198, "verified": False,
        "specialties": ["Exteriores", "Frentes", "Impermeabilización"]}),
    ("carolina.ruiz@pinturapro.demo", "Carolina Ruiz", "client", {"location": "Barracas, CABA"}),
    ("javier.mendez@pinturapro.demo", "Javier Méndez", "client", {"location": "Nordelta, Tigre"}),
    ("sofia.luna@pinturapro.demo", "Sofía Luna", "client", {"location": "Caballito, CABA"}),
    ("pablo.gimenez@pinturapro.demo", "Pablo Giménez", "client", {"location": "Vicente López"}),
    ("estudio.verde@pinturapro.demo", "Estudio Verde Arq.", "client", {"location": "Recoleta, CABA"}),
    ("marina.acosta@pinturapro.demo", "Marina Acosta", "client", {"location": "Tigre"}),
]
ids = {}
for email, name, ptype, extra in PEOPLE:
    uid = ensure_user(email, "Demo1234!", name, ptype)
    ids[email] = uid
    patch_profile(uid, extra)
    print(f"   ✓ {name} ({ptype})")

company = ids["empresa@pinturapro.demo"]
martin = ids["martin.rojas@pinturapro.demo"]
lucia = ids["lucia.fernandez@pinturapro.demo"]
diego = ids["diego.sosa@pinturapro.demo"]
clients = [ids[e] for e in ("carolina.ruiz@pinturapro.demo", "javier.mendez@pinturapro.demo",
           "sofia.luna@pinturapro.demo", "pablo.gimenez@pinturapro.demo",
           "estudio.verde@pinturapro.demo", "marina.acosta@pinturapro.demo")]

# ───────────────── 2) Obras (con category + accent_color) ─────────────────
print("2) Obras (portfolio)…")
IMG = "https://images.unsplash.com/"
projects = [
    {"owner_id": company, "type": "portfolio", "title": "Casa Barracas", "slug": "casa-barracas",
     "category": "Residencial", "accent_color": "#C41E3A",
     "description": "Renovación completa de interior con paleta cálida: terracota profundo, blanco hueso y negro mate.",
     "cover_url": IMG + "photo-1618221195710-dd6b41faaea6?w=1200", "images": [IMG + "photo-1618221195710-dd6b41faaea6?w=1200"],
     "location": "Barracas, CABA", "lat": -34.6395, "lng": -58.3795, "budget_min": 800000, "budget_max": 1500000, "published": True},
    {"owner_id": lucia, "type": "portfolio", "title": "Loft Palermo", "slug": "loft-palermo",
     "category": "Comercial", "accent_color": "#1E3A8A",
     "description": "Coworking con identidad corporativa: azul institucional, gris cemento y detalles en cobre.",
     "cover_url": IMG + "photo-1604014237800-1c9102c219da?w=1200", "images": [IMG + "photo-1604014237800-1c9102c219da?w=1200"],
     "location": "Palermo, CABA", "lat": -34.5889, "lng": -58.4306, "budget_min": 1200000, "budget_max": 2200000, "published": True},
    {"owner_id": martin, "type": "portfolio", "title": "Estudio Nordelta", "slug": "estudio-nordelta",
     "category": "Residencial", "accent_color": "#2D5A3D",
     "description": "Casa unifamiliar con integración paisajística: verdes oscuros, madera natural y blanco puro.",
     "cover_url": IMG + "photo-1600585154340-be6161a56a0c?w=1200", "images": [IMG + "photo-1600585154340-be6161a56a0c?w=1200"],
     "location": "Nordelta, Tigre", "lat": -34.4036, "lng": -58.6437, "budget_min": 1500000, "budget_max": 3000000, "published": True},
]
prows = upsert("projects", projects, on_conflict="slug")
print(f"   ✓ {len(prows)} obras")
proj_by_owner = {p["owner_id"]: p["id"] for p in prows}

# ───────────────── 3) Limpiar jobs/reviews demo (idempotencia) ─────────────────
print("3) Limpiando trabajos/reseñas previos de los pintores demo…")
painters_in = f"({martin},{lucia},{diego})"
req("DELETE", f"/rest/v1/jobs?painter_id=in.{painters_in}", headers={"Prefer": "return=minimal"})  # cascade borra reviews

# ───────────────── 4) Trabajos + reseñas (rating se calcula solo) ─────────────────
print("4) Trabajos + reseñas…")
COMMENTS = [
    "Impecable. Respetó los tiempos y el acabado quedó perfecto.",
    "Muy prolijo y responsable. Lo volvería a contratar sin dudar.",
    "Excelente trabajo, dejó todo limpio. Recomendado.",
    "Gran profesional, asesoró muy bien con los colores.",
    "Cumplió en tiempo y forma. Resultado de primera.",
    "Trabajo de calidad, atento a cada detalle.",
    "Súper recomendable, terminación impecable.",
    "Buen trabajo en general; un detalle menor pero quedamos conformes.",
    "Rápido y prolijo. Quedó todo como esperábamos.",
]
# (painter, [ratings...]) → genera un job + review por cada rating
PLAN = [
    (martin, [5, 5, 5, 5, 5, 4, 5, 5, 5]),  # avg 4.9
    (lucia,  [5, 5, 4, 5, 5, 4, 5]),         # avg 4.7
    (diego,  [5, 4, 5, 4]),                  # avg 4.5
]
total_reviews = 0
ci = 0
for painter, ratings in PLAN:
    for k, rating in enumerate(ratings):
        client = clients[ci % len(clients)]; ci += 1
        jr = upsert("jobs", [{
            "project_id": proj_by_owner.get(painter), "client_id": client, "painter_id": painter,
            "status": "completed", "amount": 900000 + k * 150000,
            "commission_rate": 0.100, "commission_amount": 90000 + k * 15000,
        }])
        if not jr:
            continue
        upsert("reviews", [{
            "job_id": jr[0]["id"], "author_id": client, "target_id": painter,
            "rating": rating, "comment": COMMENTS[(ci + k) % len(COMMENTS)],
            "created_at": iso_months_ago(k + 1),
        }], on_conflict="job_id,author_id")
        total_reviews += 1
print(f"   ✓ {total_reviews} reseñas (el trigger recalcula los ratings)")

# ───────────────── 5) Verificación ─────────────────
print("5) Ratings resultantes (calculados por el trigger):")
st, body = req("GET", "/rest/v1/profiles?select=full_name,rating,rating_count&type=eq.painter&order=rating.desc")
for p in (body or []):
    print(f"   ★ {p['rating']}  ({p['rating_count']} reseñas)  {p['full_name']}")

print("\n✅ Seed normalizado completo.")
