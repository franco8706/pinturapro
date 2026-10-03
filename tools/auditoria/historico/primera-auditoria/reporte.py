import json, sys
FOTOS = "/workspaces/codespaces-blank/.auditoria/fotos"
SALIDA = "/workspaces/codespaces-blank/.auditoria/out"
foto, etiqueta = sys.argv[1], sys.argv[2]
d = json.load(open(f"{SALIDA}/{foto}-{etiqueta}.json"))
if d.get("error"):
    print("ERROR:", d["error"]); sys.exit(1)
pared = json.load(open(f"{FOTOS}/{foto}-pared.json"))
print(f"{foto} [{etiqueta}]  carga {d['cargaMs']} ms · clic {d['clicMs']} ms")
print(f"{'sens':>5} {'ms':>6} {'cobertura':>10} {'recall':>8} {'precision':>10} {'IoU':>7}   se escapa a")
for m in d["medidas"]:
    g = m["grilla"]
    inter = sum(min(a, b) for a, b in zip(g, pared))
    pint = sum(g); ref = sum(pared)
    union = sum(max(a, b) for a, b in zip(g, pared))
    fuera = sum(max(0, a - b) for a, b in zip(g, pared))
    # ¿dónde se escapa? techo = filas 0..8 (y<90/800), zócalo/piso = filas 72..79
    techo = sum(max(0, g[i] - pared[i]) for i in range(0, 9 * 120))
    piso = sum(max(0, g[i] - pared[i]) for i in range(72 * 120, 80 * 120))
    resto = fuera - techo - piso
    print(f"{m['sensibilidad']:>5} {m['ms']:>6} {pint/9600*100:>9.1f}% {inter/ref*100:>7.1f}% {inter/pint*100 if pint else 0:>9.1f}% {inter/union*100:>6.1f}%"
          f"   techo {techo/9600*100:.1f}% · piso/zócalo {piso/9600*100:.1f}% · mueble/moldura {resto/9600*100:.1f}%")
