"""Fotos REALES para medir el simulador, y las variantes de archivo que lo rompen.

Las tres fotos de `tools/auditoria/generar.py` son sintéticas: paredes con un degradé y ruido
parejo. Sirven para medir con exactitud (se sabe qué píxel es pared), pero ninguna tiene lo que
trae una foto de verdad: luz que cambia de color, cuadros, enchufes, techo casi del mismo tono
que la pared, ladrillo, piedra, el cielo detrás de una fachada.

    python3 tools/auditoria/simulador/fotos-reales.py

Deja en `.fotos-prueba/` (fuera de git):

  reales/     18 fotos de Unsplash (licencia Unsplash: uso libre, también para probar),
              siempre las mismas, a 1600 px. Las descarga una sola vez.
  formatos/   la misma foto en todo lo que una persona puede subir desde el celular o la
              compu: girada por EXIF (así guardan los celulares la foto vertical), PNG con
              transparencia, WebP, AVIF, GIF, BMP, TIFF, SVG, CMYK, blanco y negro, JPEG
              progresivo, diminuta, panorámica, justo en el tope de megapíxeles y pasada,
              y un archivo roto.

Qué se espera de cada una está en `formatos/LEEME.txt`.
"""
from PIL import Image, ImageDraw
import io
import os
import urllib.request

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".fotos-prueba")
REALES = os.path.join(RAIZ, "reales")
FORMATOS = os.path.join(RAIZ, "formatos")
os.makedirs(REALES, exist_ok=True)
os.makedirs(FORMATOS, exist_ok=True)

# nombre → id de Unsplash. El nombre dice qué tiene de difícil.
FOTOS = {
    "r01-living-pared-gris-cuadro": "1505691938895-1758d7feb511",
    "r02-cuarto-claro-puerta-abierta": "1513694203232-719a280e022f",
    "r03-cocina-comedor-paredes-blancas": "1522708323590-d24dbb6b0267",
    "r04-dormitorio-cuadro-rojo": "1540518614846-7eded433c457",
    "r05-living-calido-macrame": "1556228453-efd6c1ff04f6",
    "r06-panel-oscuro-junto-a-pared-clara": "1586023492125-27b2c045efd7",
    "r07-dormitorio-pared-y-techo-grises": "1595526114035-0d45ed16cfbf",
    "r08-pared-verde-con-cuadros": "1615873968403-89e068629265",
    "r09-dormitorio-pared-negra": "1616594039964-ae9021a400a0",
    "r10-living-amplio-beige": "1618221195710-dd6b41faaea6",
    "r11-pared-lisa-reloj": "1533090161767-e6ffed986c88",
    "r12-pared-blanca-cuadro-amarillo": "1558882224-dda166733046",
    "r13-vertical-dormitorio-blanco": "1531835551805-16d864c8d311",
    "f01-casa-blanca-tejas-gris": "1570129477492-45c003edd2be",
    "f02-casa-ladrillo": "1449844908441-8829872d2607",
    "f03-casa-madera-blanca": "1572120360610-d971b9d7767c",
    "f04-casa-piedra": "1605276374104-dee2a0ed3cd6",
    "f05-casa-blanca-pileta-palmera": "1564013799919-ab600027ffc6",
}


def bajar():
    for nombre, ident in FOTOS.items():
        ruta = os.path.join(REALES, f"{nombre}.jpg")
        if os.path.exists(ruta) and os.path.getsize(ruta) > 10_000:
            continue
        url = f"https://images.unsplash.com/photo-{ident}?w=1600&q=85"
        with urllib.request.urlopen(url, timeout=30) as r, open(ruta, "wb") as f:
            f.write(r.read())
        print("bajada", ruta)


def guardar(img, nombre, **kw):
    ruta = os.path.join(FORMATOS, nombre)
    try:
        img.save(ruta, **kw)
        print("hecha", ruta)
    except Exception as e:  # p. ej. AVIF sin soporte en este Pillow
        print("NO se pudo", nombre, e)


def exif_con_orientacion(valor):
    exif = Image.Exif()
    exif[0x0112] = valor
    return exif


def formatos():
    base = Image.open(os.path.join(REALES, "r11-pared-lisa-reloj.jpg")).convert("RGB")

    # Girada por EXIF. Los píxeles se guardan acostados y el EXIF dice cómo enderezarlos: es lo
    # que hace la cámara de casi cualquier celular con una foto vertical. Bien leída, se tiene
    # que ver IGUAL que la original. Mal leída, sale de costado o cabeza abajo.
    #   6 = el visor la gira 90° a la derecha · 3 = 180° · 8 = 90° a la izquierda
    vertical = Image.open(os.path.join(REALES, "r13-vertical-dormitorio-blanco.jpg")).convert("RGB")
    for valor, giro in ((6, Image.Transpose.ROTATE_90), (3, Image.Transpose.ROTATE_180), (8, Image.Transpose.ROTATE_270)):
        guardar(vertical.transpose(giro), f"exif-{valor}-vertical.jpg", quality=90, exif=exif_con_orientacion(valor))

    # PNG con transparencia: la mitad derecha transparente, con un degradé de alfa en el medio.
    rgba = base.copy().convert("RGBA")
    alfa = Image.new("L", rgba.size, 255)
    d = ImageDraw.Draw(alfa)
    w, h = rgba.size
    for x in range(w // 2, w):
        d.line([(x, 0), (x, h)], fill=max(0, 255 - int((x - w // 2) / (w / 2) * 255 * 1.5)))
    rgba.putalpha(alfa)
    guardar(rgba, "png-con-transparencia.png")

    guardar(base, "webp.webp", quality=88)
    guardar(base, "avif.avif", quality=70)
    guardar(base.convert("P", palette=Image.Palette.ADAPTIVE, colors=256), "gif.gif")
    guardar(base, "bmp.bmp")
    guardar(base, "tiff.tiff")
    guardar(base.convert("CMYK"), "cmyk.jpg", quality=90)
    guardar(base.convert("L"), "blanco-y-negro.jpg", quality=90)
    guardar(base, "progresiva.jpg", quality=88, progressive=True)
    guardar(base.resize((40, 27)), "diminuta-40x27.jpg", quality=90)
    guardar(base.resize((6000, 600)), "panoramica-6000x600.jpg", quality=85)
    # El tope del simulador es 24 megapíxeles (MAX_MEGAPIXELES): 6000×4000 = 24,0 entra justo;
    # 6000×4100 = 24,6 se rechaza con un aviso.
    guardar(base.resize((6000, 4000)), "justo-24mp-6000x4000.jpg", quality=80)
    guardar(base.resize((6000, 4100)), "pasada-24-6mp-6000x4100.jpg", quality=80)

    with open(os.path.join(FORMATOS, "svg.svg"), "w") as f:
        f.write('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">'
                '<rect width="800" height="600" fill="#d8d2c4"/><rect x="0" y="480" width="800" height="120" fill="#7a5a3a"/></svg>')
    print("hecha", os.path.join(FORMATOS, "svg.svg"))

    # Un JPEG cortado a la mitad (una descarga interrumpida) y un texto con extensión .jpg.
    datos = io.BytesIO()
    base.save(datos, "JPEG", quality=88)
    with open(os.path.join(FORMATOS, "rota-cortada.jpg"), "wb") as f:
        f.write(datos.getvalue()[: len(datos.getvalue()) // 2])
    with open(os.path.join(FORMATOS, "no-es-imagen.jpg"), "w") as f:
        f.write("esto no es una foto\n")
    print("hechas las rotas")

    with open(os.path.join(FORMATOS, "LEEME.txt"), "w") as f:
        f.write(
            "Qué tiene que pasar con cada archivo en /simulador\n\n"
            "exif-6/3/8-vertical.jpg   se ve DERECHA, igual que reales/r13 (ni de costado ni al revés)\n"
            "png-con-transparencia.png se puede pintar; lo transparente no aparece negro ni rompe nada\n"
            "webp, avif, gif, bmp      se cargan (Chrome los decodifica) y se pintan\n"
            "tiff                      Chrome no lo decodifica: aviso claro y se puede elegir otra\n"
            "svg                       aviso claro o se carga; nunca una pantalla rota\n"
            "cmyk, blanco-y-negro      se cargan con los colores bien\n"
            "progresiva                se carga\n"
            "diminuta-40x27            no rompe; se puede pintar o hay un aviso\n"
            "panoramica-6000x600       se carga entera, sin deformarse\n"
            "justo-24mp                se carga (es el tope)\n"
            "pasada-24-6mp             aviso de 'demasiado grande' y se puede elegir otra\n"
            "rota-cortada, no-es-imagen aviso claro y se puede elegir otra\n"
        )


if __name__ == "__main__":
    bajar()
    formatos()
