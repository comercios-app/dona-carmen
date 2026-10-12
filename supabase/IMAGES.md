# Edición de fotos

1. Ejecutar `04-images.sql` en SQL Editor del proyecto actual. Crea el bucket
   público `product-images`, las referencias por producto y los permisos de administrador.
   No modifica precios y mantiene las fotos originales hasta reemplazarlas.
2. Verificar lectura pública de las 41 filas de `product_images`, bloqueo de
   escritura anónima y configuración del bucket: WebP, máximo 307200 bytes.
3. Configurar `VITE_PRODUCT_IMAGES=true` en `.env.production`, compilar y publicar.
4. En el panel, elegir un producto, seleccionar una foto, revisar la vista previa
   y pulsar **Guardar foto**. Los precios se guardan por separado.
5. Verificar en el menú y probar **Volver a la foto original**.

Se admiten JPG, PNG y WebP de hasta 20 MB. HEIC y GIF no se admiten en esta versión.
La foto se decodifica y se vuelve a generar en el navegador como WebP antes de
enviarla: máximo 1200 píxeles en el lado mayor y 300 KB. Conserva proporciones,
no amplía imágenes pequeñas y reduce más dimensiones/calidad si hace falta.
No se sube el archivo original ni se usan las transformaciones pagas de Storage.

Las rutas son únicas por subida y usan caché de un año. Cada producto tiene su
foto independiente; reemplazar la foto de una presentación no cambia las demás.
La imagen de categoría sigue siendo la del primer producto de esa categoría.
El menú carga las imágenes cuando se aproximan a la zona visible.

Solo el administrador puede subir y asociar fotos. La asociación usa una versión
independiente del precio para detectar conflictos. No se permite sobrescribir
archivos existentes ni borrar imágenes que están activas.

Después de un guardado confirmado, se elimina la foto subida anteriormente.
La opción de volver al original usa el archivo del sitio, sin ocupar Storage.
Si falla la eliminación, se avisa; se puede borrar la foto sin uso desde Storage.
Si se pierde la respuesta del guardado, la app conserva el archivo nuevo y pide
recargar: podría haberse guardado correctamente. Puede quedar un archivo sin uso
en estos casos o si se cierra la pestaña entre la subida y el guardado. Revisar
`product_images.image_path` antes de limpiar archivos desde el Dashboard.
No borrar filas de `storage.objects` por SQL: eliminar archivos mediante Storage.

Verificación local: `npm test`, `npm run test:browser`, `npm run lint`, `npm run build`.
Las pruebas de navegador simulan Storage y prueban compresión real en canvas;
no suben imágenes a producción. La prueba final de subida real requiere iniciar
sesión con el administrador desde el panel publicado.
