# ABM de productos y categorías

## Activación

1. Ejecutar `05-catalog.sql` en SQL Editor después de los scripts 01 a 04.
2. Comprobar que `get_catalog(false)` devuelve las categorías y los productos
   actuales con los precios y fotos vigentes. El script solo agrega nombres,
   categorías y orden; no carga de nuevo precios ni imágenes.
3. Activar `VITE_CATALOG=true` en `.env.production` y compilar/publicar.
4. Desde el panel, probar una categoría y un producto nuevos, modificación,
   cambio de categoría, archivo y restauración. Verificar el menú público.

## Uso

- **Nueva categoría**: nombre y orden (los números menores aparecen primero).
- **Nuevo producto**: nombre, categoría, precio, orden y estado. Después de
  crearlo, la lista se filtra por su nombre para cargar una foto con el editor
  existente. Hasta entonces se muestra una imagen de “Foto pendiente”.
- **Editar / archivar producto**: permite renombrar, mover a otra categoría,
  editar el precio y ocultar/restaurar el producto. Se revisa antes de confirmar.
- **Administrar categorías**: permite renombrar, ordenar, archivar y restaurar.
  Una categoría con productos activos no se puede archivar: primero hay que
  mover o archivar esos productos. No se eliminan productos en cascada.
- **Mostrar también productos archivados**: permite encontrar y recuperar bajas.
  Restaurar una categoría no vuelve a activar sus productos automáticamente.

Las bajas son archivos reversibles. Se conservan identificadores, precios,
historial y fotos (incluido su espacio en Storage). Los productos activos de
categorías activas son los únicos publicados. Las categorías vacías no aparecen
en el menú hasta tener productos visibles.

El menú obtiene el catálogo dinámicamente. Antes de enviar a WhatsApp verifica
nombres, precios y disponibilidad: elimina del carrito los productos archivados
y pide revisar el pedido; no envía automáticamente el pedido modificado.
No hay que hacer commits ni despliegues para administrar el catálogo.

## Permisos y concurrencia

Se reutiliza `private.price_admins`, incluidos todos los administradores existentes.
Los visitantes solo pueden consultar `get_catalog(false)`; el catálogo completo
requiere un administrador. No hay escritura directa a tablas desde el navegador.
Las altas crean producto, precio y referencia de foto en una transacción.
Las modificaciones verifican versiones del producto y del precio; los cambios
de precio se registran en `price_history`. Los cambios del catálogo quedan
registrados en `private.catalog_history`. Los nombres duplicados se rechazan,
incluidos los archivados; los productos pueden repetir nombre en otra categoría.
Cada formulario de alta usa una clave única para no duplicar altas por reintentos.

No cambiar `VITE_CATALOG` a false como rollback después de crear productos:
el catálogo estático no contiene los registros nuevos. Corregir hacia adelante
o exportar un catálogo completo antes de volver a una versión anterior.

## Validación

- `npm test`: PostgreSQL local, permisos, preservación de datos, altas idempotentes,
  archivo/restauración, conflictos y reglas del carrito.
- `npm run test:browser`: formularios y menú en Edge con API simulada.
- `npm run lint` y `npm run build`.
- La prueba autenticada en Supabase real requiere que un administrador ingrese
  al panel; no se guardan contraseñas en el repositorio.
