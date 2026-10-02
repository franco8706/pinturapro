# Tipografías del sitio

Inter, Space Grotesk y JetBrains Mono, sólo con el juego de caracteres
latino (cubre el español entero: tildes, ñ, ¿ ¡). Son los mismos archivos que servía Google
Fonts, bajados una vez el 29/9/2026.

**Por qué están en el repo:** con `next/font/google`, cada `next build` las bajaba de
`fonts.gstatic.com`. El 28/9 una compilación falló ahí (`TypeError` dentro del cargador de
`next/font`) y anduvo al reintentar: en Cloud Build eso es una versión que no sale sin haber
cambiado una línea de código. Lo marcaron `nube-google` y `dependencias`.

**Acotadas a lo que se usa (1/10/2026):** las tres pesaban 111 KB en cada página, el 42 % de la
portada. Inter venía con todos los pesos del 100 al 900 y el sitio usa del 400 al 700; JetBrains
Mono venía del 100 al 800 y sólo se usa en 400 (etiquetas chicas). Se recortaron con
`fonttools varLib.instancer` (`wght=400:700` y `wght=400`), sin tocar ningún carácter: Inter
48,4 → 36,1 KB, JetBrains Mono 40,5 → 21,1 KB. Space Grotesk quedó igual (no se ganaba nada).
**Si un día el diseño usa un peso fuera de esos rangos** (un `font-light`, una etiqueta mono en
negrita), el navegador lo va a simular: hay que volver a bajar el archivo completo.

**Licencia:** las tres se distribuyen bajo la SIL Open Font License 1.1, que permite usarlas,
incluirlas en un sitio y redistribuirlas, siempre que se mantenga la licencia y no se vendan
sueltas. Textos completos:

- Inter — © The Inter Project Authors — https://github.com/rsms/inter/blob/master/LICENSE.txt
- Space Grotesk — © The Space Grotesk Project Authors — https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt
- JetBrains Mono — © The JetBrains Mono Project Authors — https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
