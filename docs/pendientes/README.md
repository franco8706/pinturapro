# Pendientes fuera del árbol de rutas

## checkout-maqueta.tsx.txt

Era `app/(marketplace)/checkout/page.tsx`. Se retiró antes de publicar el sitio.

**Por qué:** era una maqueta sin ningún backend de pago — monto y pintor hardcodeados,
`onSubmit` que sólo hacía `setPaid(true)` — pero le mostraba al visitante "¡Pago
confirmado!" y le afirmaba que "el dinero queda retenido en garantía y se libera cuando
confirmes que la obra está terminada". La ruta era pública y sin gate de sesión.

Nadie la enlazaba desde la UI, pero seguía siendo una URL viva en producción que prometía
un escrow inexistente a quien la abriera. Eso es riesgo legal, no deuda técnica.

**Para reactivarla** hace falta primero el cobro real (Mercado Pago o Stripe Connect):
tokenización, webhook de confirmación, y el `job_id` de verdad en vez del monto fijo.
Recién ahí volver a poner el archivo en `app/(marketplace)/checkout/page.tsx`.
