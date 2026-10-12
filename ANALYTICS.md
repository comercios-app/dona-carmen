# Estadísticas de Doña Carmen

El identificador público de producción es `G-ZYCRXEFKRM` y está configurado en
`.env.production`, para conservar la medición en futuras compilaciones.
No agregar otra etiqueta en `index.html`: `src/analytics.js` ya la carga una vez.

La integración está preparada para Google Analytics 4. Solo se activa en una
compilación de producción con un identificador válido; `npm run dev` no registra
visitas. Sin identificador, la página sigue funcionando sin cargar Analytics.

## Activación

1. Crear una propiedad en https://analytics.google.com/ para Doña Carmen, con
   zona horaria de Argentina y moneda ARS.
2. Agregar un flujo de datos Web para https://comercios-app.github.io/dona-carmen/.
3. Copiar el identificador de medición que empieza por `G-`.
4. Copiar `.env.example` a `.env.local` y completar `VITE_GA_MEASUREMENT_ID`.
5. Ejecutar `npm run build`. La variable se incorpora durante la compilación;
   cambiarla requiere volver a compilar. En CI, configurar la misma variable.
6. Publicar con el procedimiento habitual (`npm run deploy`).

## Mediciones y comprobación

- `page_view`: una vista al cargar la página, registrada por la etiqueta de Google.
- `whatsapp_order_click`: clic para abrir WhatsApp con un pedido válido. No confirma
  el envío del mensaje ni una venta. El evento no incluye nombres, direcciones,
  notas, contenido del pedido ni la URL de WhatsApp con el mensaje.
- La configuración desactiva Google Signals y las señales de personalización de anuncios.

Después de publicar, abrir la página y consultar el informe **Tiempo real** de
Analytics. Completar un pedido válido y abrir WhatsApp para comprobar el evento
`whatsapp_order_click`; no hace falta enviar el mensaje. Los bloqueadores pueden
impedir la medición. Los visitantes únicos son una estimación, no un conteo exacto
de personas. Las visitas anteriores a la activación no se recuperan.

Documentación oficial:
- https://support.google.com/analytics/answer/14183469?hl=es
- https://developers.google.com/analytics/devguides/collection/ga4/events
