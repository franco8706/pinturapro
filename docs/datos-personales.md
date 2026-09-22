# Qué datos pedir, y de qué nos hacemos cargo

Escrito para el dueño, no para programadores. Es un resumen práctico, no un dictamen legal:
la Ley 25.326 y su reglamentación las tiene que revisar un abogado antes de publicar.

---

## 1. Qué pide el sitio hoy

| Momento | Qué se pide | Dónde queda |
|---|---|---|
| Crear cuenta (cliente o pintor) | Nombre y apellido, email, contraseña | `auth.users` + `profiles` |
| Elegir rol | Cliente / pintor / empresa | `profiles.type` |
| Perfil del pintor | Zona, teléfono, descripción, especialidades, foto | `profiles` |
| Postularse como pintor (`/registro`) | Nombre, email, teléfono, zona, años de experiencia, especialidades | `leads` |
| Publicar un pedido | Título, tipo, superficie, zona, presupuesto | `projects` |
| Al adjudicar un trabajo | Teléfono, sólo si no lo tenía | `profiles.phone` |
| Pedir presupuesto sin cuenta | Nombre, email, teléfono, tipo, superficie, ambientes | `leads` |
| Simulador con IA | La foto del ambiente viaja a un servicio externo | No se guarda |

La contraseña no la vemos nunca: la guarda Supabase con hash. Nosotros no podemos leerla.

---

## 2. Qué pedirle al CLIENTE

**Al registrarse — sólo esto:**

- Nombre y apellido
- Email
- Contraseña

**Cuando publica un pedido:** zona o barrio (no la dirección), tipo de trabajo, superficie
aproximada, presupuesto estimado.

**Recién cuando acepta una cotización:** el teléfono. Así funciona hoy y conviene dejarlo así:
el teléfono sirve para coordinar con el pintor, y hasta que no hay un pintor con quien
coordinar, no hace falta.

**Qué NO pedirle nunca:**

- **La dirección exacta.** Que se la pase al pintor cuando ya eligió. Guardarla significa tener
  en una base el domicilio de gente que no está en la casa a cierta hora. Ya tuvimos que sacar
  las coordenadas de los clientes de la vista pública una vez (migración 0013).
- **El DNI.** Un cliente que contrata a un pintor no necesita identificarse. Pedirlo sólo suma
  riesgo: si esa base se filtra, se filtran identidades.
- **Fecha de nacimiento**, salvo que quieras hacer la verificación de mayoría de edad. Alcanza
  con una casilla de "soy mayor de 18".
- **Datos de tarjeta o CBU.** El día que haya pagos, los pide el procesador (Mercado Pago,
  Stripe) en su propia pantalla. Que el dato bancario nunca toque nuestros servidores.

**La regla:** cada campo que pedís de más es un campo menos que llenan y un riesgo más que
guardás. Pedí lo mínimo para el paso que la persona está haciendo.

---

## 3. Qué pedirle al PINTOR

Acá sí hace falta más, porque el pintor entra a la casa de alguien.

**Al registrarse:**

- Nombre y apellido
- Email
- Contraseña
- Teléfono
- Zona de trabajo
- Especialidades

**Para el perfil público:** descripción, fotos de trabajos anteriores, años de experiencia.

**Sólo si querés ofrecer la etiqueta "verificado":**

- CUIT o constancia de monotributo
- Foto del DNI (frente y dorso) o una verificación de identidad
- Seguro de responsabilidad civil, si trabaja en edificios

Pensalo dos veces antes de sumar esto. Hoy la columna `verified` existe en la base y **no la
escribe ningún código**: se pone a mano. Si mostrás "verificado" en el sitio, estás afirmando
algo, y tenés que poder demostrar qué verificaste y cómo. Eso no es sólo protección de datos:
es la Ley 24.240 de Defensa del Consumidor. Guardar una foto de DNI, además, sube mucho la
apuesta: pasa a ser el tipo de dato que hay que cifrar, limitar en el tiempo y borrar apenas
cumplió su función.

**Recomendación:** salir sin "verificado". Las reseñas de trabajos reales dan más confianza que
una etiqueta que nadie sabe qué significa. Y si más adelante lo agregás, que sea un proceso
aparte, opcional, con su propio texto explicando qué se pide, para qué y hasta cuándo se guarda.

**Para pagos (cuando existan):** CBU o CVU y CUIT. Igual que con el cliente: que los pida el
procesador de pagos, no nosotros.

---

## 4. De qué nos hacemos cargo

Al guardar datos de personas, Pintura Pro es **responsable de la base de datos** ante la Ley
25.326. En criollo, esto es lo que eso significa:

**1. Decir quiénes somos.** Razón social, CUIT y domicilio legal tienen que estar publicados.
Hoy faltan: la página de privacidad avisa que faltan, pero es un pendiente real y es de los
primeros que mira la autoridad si hay un reclamo.

**2. Usar los datos sólo para lo que se dijo.** El teléfono se pidió para coordinar un trabajo:
no se puede usar para mandar promociones. Si más adelante querés mandar novedades, hay que
pedir permiso aparte, y que se pueda desactivar.

**3. Pedir consentimiento informado.** La persona tiene que saber qué se guarda, para qué y con
quién se comparte, **antes** de darlo. Por eso importa que la política de privacidad diga la
verdad — ya corregimos dos cosas que no decía: que el mapa manda la IP a OpenStreetMap, y que
el simulador con IA manda la foto del ambiente a un servicio en Estados Unidos.

**4. Contestar cuando alguien pregunta.** Cualquiera puede pedir ver sus datos, corregirlos o
borrarlos. La ley da **10 días corridos** para contestar un pedido de acceso y **5 días
hábiles** para corregir o borrar. No es opcional y no depende de que nos parezca razonable.

**5. Cuidarlos.** Hay que tomar medidas de seguridad y mantener el secreto. Hoy: cada persona
sólo ve lo suyo por reglas en la base, las contraseñas están hasheadas, el teléfono se
comparte únicamente entre las dos partes de un trabajo ya adjudicado, y las coordenadas de los
clientes no son visibles. Eso ya es bastante más que lo que hace la mayoría.

**6. Avisar que los datos salen del país.** Supabase y Replicate tienen los servidores en
Estados Unidos. La ley pide que la persona lo sepa y lo acepte; la política de privacidad hoy
lo dice.

**7. Inscribir la base.** La Agencia de Acceso a la Información Pública tiene un registro de
bases de datos personales. Es un trámite, es gratis, y es de las primeras cosas que se miran
ante una denuncia. **Confirmalo con el abogado**: es el punto donde más seguido se equivoca
todo el mundo.

### Lo que NO es obligación hoy pero conviene

- **Avisar si hay una filtración.** La ley actual no lo exige de forma explícita; los proyectos
  de ley nueva sí. Si algún día pasa, avisar rápido y bien es lo que separa un problema de un
  escándalo.
- **Borrar lo que ya no sirve.** Hoy no hay ningún plazo definido. Conviene fijarlos: las
  consultas sin respuesta a los 12 o 24 meses, las cuentas inactivas después de avisar.

---

## 5. Los tres huecos que tenemos hoy

**1. No hay forma de borrar la cuenta desde el sitio.** La política dice "escribinos y lo
hacemos", lo cual cumple, pero significa que alguien tiene que atender ese pedido a mano y
dentro de los 5 días hábiles. Un botón de "eliminar mi cuenta" evita depender de que alguien
lea el correo a tiempo.

**2. Tampoco hay forma de descargar los propios datos.** Mismo caso: hoy se resuelve a mano.

**3. Faltan los datos legales del responsable.** Razón social, CUIT y domicilio.

Los tres se pueden resolver antes de publicar. El primero y el segundo son código; el tercero
es un dato que tenés que darme vos.

---

## 6. Lo mínimo para salir

1. Razón social, CUIT y domicilio en la política de privacidad.
2. Un abogado que revise `/privacidad` y `/terminos` (media hora de lectura).
3. Consultar la inscripción de la base ante la AAIP.
4. Decidir si sale con "verificado" o sin. **Recomendación: sin.**
5. Fijar plazos de borrado, aunque sea en un documento interno.

Lo que **no** hace falta para salir: pedirle el DNI a nadie, guardar direcciones exactas, ni
tocar datos bancarios.
