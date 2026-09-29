# Tipografías del sitio

Inter, Space Grotesk y JetBrains Mono, en su versión variable y sólo con el juego de caracteres
latino (cubre el español entero: tildes, ñ, ¿ ¡). Son los mismos archivos que servía Google
Fonts, bajados una vez el 29/9/2026.

**Por qué están en el repo:** con `next/font/google`, cada `next build` las bajaba de
`fonts.gstatic.com`. El 28/9 una compilación falló ahí (`TypeError` dentro del cargador de
`next/font`) y anduvo al reintentar: en Cloud Build eso es una versión que no sale sin haber
cambiado una línea de código. Lo marcaron `nube-google` y `dependencias`.

**Licencia:** las tres se distribuyen bajo la SIL Open Font License 1.1, que permite usarlas,
incluirlas en un sitio y redistribuirlas, siempre que se mantenga la licencia y no se vendan
sueltas. Textos completos:

- Inter — © The Inter Project Authors — https://github.com/rsms/inter/blob/master/LICENSE.txt
- Space Grotesk — © The Space Grotesk Project Authors — https://github.com/floriankarsten/space-grotesk/blob/master/OFL.txt
- JetBrains Mono — © The JetBrains Mono Project Authors — https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt
