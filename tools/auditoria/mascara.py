"""Mascara de referencia: que pixeles son PARED en las fotos de prueba.

Sirve para medir el simulador con numeros y no con impresiones: cuanta pared
agarro (recall), cuanto se fue a otra cosa (precision) y el acuerdo global (IoU).
La geometria es la misma que usa generar.py.
"""
from PIL import Image, ImageDraw
import json
import os

W, H = 1200, 800
DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".fotos-prueba")
os.makedirs(DEST, exist_ok=True)


def mascara_pared(con_mueble=True):
    m = Image.new("L", (W, H), 255)              # todo pared...
    d = ImageDraw.Draw(m)
    d.rectangle([0, 0, W, 90], fill=0)           # techo
    d.rectangle([0, H - 72, W, H], fill=0)       # zocalo + piso
    d.rectangle([68, 118, 98, H - 70], fill=0)   # moldura
    if con_mueble:
        d.rectangle([758, 418, 1122, H - 70], fill=0)  # mueble
    return m


def grilla(img, gx=120, gy=80):
    """Reduce a una grilla; cada celda es la fraccion (0..1) marcada."""
    chico = img.resize((gx, gy), Image.BOX)
    return [v / 255 for v in chico.getdata()]


if __name__ == "__main__":
    for nombre, mueble in [("01-living-luz", True), ("02-pared-plana", False), ("03-pared-oscura", True)]:
        m = mascara_pared(mueble)
        m.save(f"{DEST}/{nombre}-pared.png")
        g = grilla(m)
        json.dump(g, open(f"{DEST}/{nombre}-pared.json", "w"))
        print(nombre, "pared:", round(sum(g) / (120 * 80) * 100, 1), "% de la foto")
