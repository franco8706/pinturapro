"""Fotos sintéticas pero realistas para medir el simulador de color.

Reproducen lo que de verdad rompe un flood fill: degradado de luz de ventana,
textura de revoque, zócalo y moldura claros contra pared de color, y un mueble
oscuro que toca la pared con su sombra.
"""
from PIL import Image, ImageDraw, ImageFilter
import random
import sys

W, H = 1200, 800
DEST = "/workspaces/codespaces-blank/.auditoria/fotos"
random.seed(7)


def ruido(img, fuerza):
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            n = random.randint(-fuerza, fuerza)
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)))
    return img


def habitacion(nombre, base=(178, 170, 158), luz=1.0, mueble=True, textura=10):
    img = Image.new("RGB", (W, H), base)
    d = ImageDraw.Draw(img)

    for y in range(0, H, 2):
        fy = y / H
        for x in range(0, W, 4):
            fx = x / W
            k = 1 + luz * (0.34 * (1 - fx) + 0.22 * (1 - fy))
            c = tuple(max(0, min(255, int(v * k))) for v in base)
            d.rectangle([x, y, x + 4, y + 2], fill=c)

    d.rectangle([0, 0, W, 90], fill=(236, 234, 229))          # techo
    d.rectangle([0, H - 70, W, H], fill=(238, 236, 231))      # zócalo
    d.line([0, H - 70, W, H - 70], fill=(120, 118, 112), width=2)
    d.rectangle([0, H - 40, W, H], fill=(146, 116, 86))       # piso

    if mueble:
        sombra = Image.new("RGB", (W, H), (0, 0, 0))
        m = Image.new("L", (W, H), 0)
        ImageDraw.Draw(m).rectangle([700, 400, 1160, H - 60], fill=90)
        m = m.filter(ImageFilter.GaussianBlur(40))
        img = Image.composite(sombra, img, m)
        d = ImageDraw.Draw(img)
        d.rectangle([760, 420, 1120, H - 70], fill=(72, 58, 46))

    d.rectangle([70, 120, 96, H - 70], fill=(240, 238, 233))  # moldura clara

    img = ruido(img, textura)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    ruta = f"{DEST}/{nombre}.jpg"
    img.save(ruta, quality=88)
    print(ruta)


if __name__ == "__main__":
    habitacion("01-living-luz", base=(178, 170, 158), luz=1.0)
    habitacion("02-pared-plana", base=(196, 190, 180), luz=0.15, mueble=False, textura=4)
    habitacion("03-pared-oscura", base=(96, 104, 118), luz=0.8)
    if "--grande" in sys.argv:
        # 30 megapíxeles: para probar el rechazo por tamaño.
        Image.new("RGB", (6000, 5000), (200, 195, 185)).save(f"{DEST}/99-gigante.jpg", quality=70)
        print(f"{DEST}/99-gigante.jpg")
