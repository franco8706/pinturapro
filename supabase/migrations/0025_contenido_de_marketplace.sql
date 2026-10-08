-- ═══════════════════════════════════════════════════════════════════════════
-- 0025 · El contenido de la base habla como marketplace, no como empresa que pinta
-- ═══════════════════════════════════════════════════════════════════════════
-- Pintura Pro es un marketplace puro (decisión del dueño, 27/9/2026): conecta, no pinta. Las
-- páginas se reescribieron ese día, pero parte del texto vive en la BASE (sembrado en 0005) y
-- nadie lo miró: lo encontró `contenido-confianza` el 29/9.
--
-- · Las preguntas frecuentes (Aprender → "Antes de pedir" en la app móvil) decían "pintamos",
--   "organizar el equipo" y "trabajamos con primeras marcas": contradicen /terminos ("no
--   ejecuta la obra"). Se reescriben para que respondan lo mismo en segunda persona, pensando
--   en lo que le sirve al pintor que va a cotizar.
-- · Una novedad anunciaba "pintores verificados en Zona Norte": no existe ninguna
--   verificación (0 procesos; `profiles.verified` sólo se escribe a mano). Se despublica.
--
-- Por texto de pregunta y título, que son únicos (0005). Si alguien ya los cambió a mano, el
-- update no encuentra la fila y no pasa nada.

update public.faqs set answer =
  'Aclará si son ambientes internos, frentes o medianeras, o una obra completa. Cambia mucho el material y la preparación, y los pintores cotizan distinto cada caso.'
where question = '¿El trabajo es interior, exterior o ambos?';

update public.faqs set answer =
  'No hace falta exactitud: una estimación por ambiente o total alcanza para que los pintores te acerquen un número. Si no sabés, contá las paredes principales.'
where question = '¿Qué superficie aproximada en m² hay que pintar?';

update public.faqs set answer =
  'Si ya tenés una paleta, ponela en el pedido. Si no, podés probar colores en el simulador antes de decidir, y consultar con el pintor que elijas qué marca y línea recomienda para ese ambiente.'
where question = '¿Ya tenés color y marca, o necesitás asesoramiento?';

update public.faqs set answer =
  'Saber si hay muebles, mascotas o gente viviendo ayuda al pintor a planificar la protección y los tiempos.'
where question = '¿El espacio va a estar habitado o amoblado durante el trabajo?';

update public.faqs set answer =
  'Una fecha objetivo (o si es urgente) le permite al pintor saber si puede tomar el trabajo y darte un plazo realista.'
where question = '¿Para cuándo lo necesitás?';

update public.news set published = false
where title = 'Sumamos pintores verificados en Zona Norte';
