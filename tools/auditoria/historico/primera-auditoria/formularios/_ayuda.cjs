/** Helpers compartidos para los scripts de formularios hostiles. */

/** Cuenta requests POST (a cualquier destino) mientras dura la prueba. */
function contarPosts(page) {
  const posts = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(req.url().slice(0, 200));
  });
  return posts;
}

/** Saca required/maxlength/pattern/min/max de todos los inputs/textarea de la página,
 *  y cambia type=email/number/tel a type=text, para que el navegador no bloquee el envío. */
async function sacarRestricciones(page) {
  await page.evaluate(() => {
    document.querySelectorAll("input,textarea").forEach((el) => {
      el.removeAttribute("required");
      el.removeAttribute("maxlength");
      el.removeAttribute("pattern");
      el.removeAttribute("min");
      el.removeAttribute("max");
      if (el.tagName === "INPUT" && ["email", "number", "tel", "url"].includes(el.type)) {
        el.type = "text";
      }
    });
    // Importante: si el input es controlado por React con `type={"email"}` fijo en el prop,
    // React vuelve a pisar nuestro `el.type = "text"` en el próximo re-render (p.ej. al
    // disparar el evento `input` de un fill). Por eso la defensa real contra la validación
    // HTML5 es `noValidate` en el <form>: evita que el navegador bloquee el submit sin
    // depender de mutar cada input (que React puede revertir).
    document.querySelectorAll("form").forEach((f) => (f.noValidate = true));
    // Habilita cualquier botón deshabilitado (gates de React vía `disabled`).
    document.querySelectorAll("button[disabled]").forEach((b) => b.removeAttribute("disabled"));
  });
}

async function clicTriple(page, selector) {
  const el = await page.$(selector);
  if (!el) return false;
  await Promise.all([el.click(), el.click(), el.click()]);
  return true;
}

function textoLargo(n) {
  return "X".repeat(n);
}

const XSS = "<script>alert(1)</script>";
const SQLI = "' OR 1=1 --";

module.exports = { contarPosts, sacarRestricciones, clicTriple, textoLargo, XSS, SQLI };
