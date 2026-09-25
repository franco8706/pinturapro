# Imagen del vigilante. Chica a propósito: no tiene dependencias, sólo `fetch` de Node.
#
# Corre como un trabajo de Cloud Run: arranca, revisa, escribe en Cloud Logging y termina.
# No es un servidor: no queda nada encendido entre corrida y corrida, así que no cuesta nada
# mientras no se ejecuta.
FROM node:22-alpine

# Un usuario sin privilegios: el vigilante sólo hace pedidos HTTP hacia afuera.
RUN addgroup -S vigia && adduser -S vigia -G vigia
WORKDIR /app
COPY revisar.mjs ./
USER vigia

ENV LOG_JSON=1
ENTRYPOINT ["node", "revisar.mjs"]
