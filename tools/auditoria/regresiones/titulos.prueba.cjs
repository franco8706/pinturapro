/**
 * Vigila que cada pantalla tenga su propio título, y que lo privado no se indexe.
 *
 * El título de la pestaña es lo que Google muestra en el resultado y lo que se lee al
 * cambiar de pestaña. Varias pantallas heredaban el general del sitio, "Transformamos
 * espacios con color": /recuperar, /nueva-contrasena, las del panel del pintor, y la página
 * de error, que así parecía una página que existe. Lo midió el sub-agente visitante de
 * `recorrido-web` leyendo el <title> de cada pantalla. Una página nueva que se olvida el
 * título vuelve a caer en eso sin que nadie lo note: no rompe nada visible.
 */
// El título por defecto del sitio (el de la portada). Cambió el 27/9 al pasar a marketplace
// puro; el viejo se sigue buscando por si vuelve.
const GENERICO = /Transformamos espacios con color|Encontrá pintor y compará cotizaciones/;

const PUBLICAS = [
  "/obras", "/pintores", "/simulador", "/colores", "/contacto", "/nosotros",
  "/aprender", "/asesoramiento", "/novedades", "/privacidad", "/terminos", "/ingresar",
  "/crear-cuenta", "/recuperar", "/nueva-contrasena", "/registro", "/mapa", "/trabajos",
];
// Estas no tienen que aparecer en Google: son de una persona, o no existen.
const FUERA_DEL_INDICE = ["/recuperar", "/nueva-contrasena", "/obras/zzagent-no-existe"];

module.exports = {
  nombre: "títulos · cada pantalla tiene el suyo y lo privado no se indexa",

  async correr(t, { k }) {
    const leer = async (ruta) => {
      const r = await fetch(k.BASE + ruta, { signal: AbortSignal.timeout(60000) });
      const html = await r.text();
      return {
        titulo: (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "",
        noindex: /<meta[^>]+name="robots"[^>]+noindex/i.test(html),
      };
    };

    const sinTitulo = [];
    for (const ruta of PUBLICAS) {
      const { titulo } = await leer(ruta);
      if (!titulo || GENERICO.test(titulo)) sinTitulo.push(ruta);
    }
    t.cierto(sinTitulo.length === 0, `pantallas con el título genérico del sitio -> ${sinTitulo.join(", ")}`);

    const error = await leer("/obras/zzagent-no-existe");
    t.cierto(!GENERICO.test(error.titulo), `la página de error se titula como si existiera: "${error.titulo}"`);

    const indexadas = [];
    for (const ruta of FUERA_DEL_INDICE) if (!(await leer(ruta)).noindex) indexadas.push(ruta);
    t.cierto(indexadas.length === 0, `pantallas que Google podría guardar y no debería -> ${indexadas.join(", ")}`);
  },
};
