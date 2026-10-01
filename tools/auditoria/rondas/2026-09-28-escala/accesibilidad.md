# Accesibilidad — ronda 2026-09-28-escala

Medido con el kit (Chrome propio), producción :3100 para lo sensible al modo dev. Sin bloqueantes nuevos.

## IMPORTANTE

**Foco perdido al terminar /publicar y /registro (medido).** Al enviar el último paso, el padre
reemplaza `<MultiStepForm>` por la pantalla "listo" sin mover el foco: queda en `<body>`. Un
lector de pantalla no se entera de que el envío funcionó ni lee "¡Bienvenido, ZZAGENT!" / "Tu
trabajo está publicado". Mismo problema ya resuelto para "Continuar" (`pasoRef` en
`multi-step-form.tsx`), pero no cubre este swap porque pasa por fuera del componente. Arreglo:
`ref` + `tabIndex={-1}` en el `<h1>` de "listo" con `useEffect(() => ref.current?.focus(), [done])`,
en `publicar-form.tsx:172` y `registro/page.tsx:170`.

**Iniciales de pintor sin foto, 2,02:1 (piso 3:1), visto en los 3 perfiles demo.**
`pintor/[id]/page.tsx:105` usa `text-concrete/50` sobre `bg-mist` (`rgba(104,104,104,.5)` sobre
`rgb(245,244,240)`, `getComputedStyle`). La misma pieza en `painter-card.tsx:31` ya se arregló a
`text-ink/70` (6,55:1): el fix no llegó al perfil individual, que ninguna prueba abre. Cambiar
la clase ahí también.

**"Completá los datos de este paso" no dice cuál (re-medido, sigue abierto).** En `/publicar`,
con título Y tipo vacíos, o sólo el título vacío, el mensaje es idéntico; el foco va al
contenedor del paso, no al campo. Arreglo: en `multi-step-form.tsx` cambiar
`FormStep.isValid?: boolean` por `missing?: string[]`, armar
`Para seguir, completá: ${step.missing.join(", ")}.`, y en cada paso de `publicar-form.tsx`/
`registro/page.tsx` devolver el nombre de cada campo vacío en vez de un booleano.

## MENOR (molesta, no bloquea)

- **Intensidad: 7 a 14 Shift+Tab** según el color elegido (medido con foto real: 7 con el primer
  color, 14 con el último). Confirma lo abierto. Arreglo: sacar el slider de
  `photo-simulator.tsx:948-959` y renderizarlo en `simulador/page.tsx` bajo la grilla de colores
  (subir `strength` como estado del padre).
- **Enlaces de 17 px sin la corrección pareja.** Footer en `/pintor/<id>`, `/` y `/simulador`:
  "Privacidad" 78×17, "Términos" 62×17 (`footer.tsx:81-86`, sin el `inline-block py-1` que sí
  tienen los otros enlaces del pie). `/ingresar`: "Olvidé mi contraseña" 140×17, "Creá una" 60×17.
- **`review-system.tsx:108`, "Proyecto: X" en `text-concrete/70`, 2,70:1** — deducido: ninguna
  reseña demo trae `project`, no se vio en pantalla, pero el defecto está en el código.

## Confirmado sin regresión (medido)

Reducir movimiento sigue respetado: carruseles y Lenis, 0 cambio en 6,5 s con la preferencia
activa; scroll salta sin transición. "Verificado" no aparece en ningún perfil. El aviso "tu
pedido es público" en `/publicar` se lee en el orden correcto (h1 → aviso → formulario) y el
`aria-describedby` de la zona apunta a un nodo real. Labels de `/ingresar` bien asociadas.
Escape cierra el menú móvil. El simulador se completa entero con teclado. **Para próximas
rondas:** `concrete`/`plaster` da 4,47:1 por hex nominal pero **4,68:1 con el color realmente
renderizado** — medir siempre con `getComputedStyle`, no con el hex de `globals.css`.

## Creado (para borrar)

- Lead vía `/registro`: "ZZAGENT Prueba Accesibilidad",
  `zzagent-prueba-accesibilidad@example.com`, tel 1122334455, zona CABA.
- Pedido vía `/publicar` (cuenta `sofia.luna`/cliente3): "ZZAGENT prueba accesibilidad foco-envio".

No toqué perfiles demo existentes.
