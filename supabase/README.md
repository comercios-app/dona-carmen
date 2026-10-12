# Activación del panel de precios

El menú sigue usando los precios del código mientras `VITE_LIVE_PRICES=false`.
Cambiar este indicador a `true` únicamente después de completar los pasos siguientes.
El proyecto usa solamente la URL y la clave pública; no requiere claves secretas.

## 1. Crear tablas y cargar precios

En el proyecto Supabase `deelcxaztemzhzfcpvok`, abrir **SQL Editor → New query**.
Pegar y ejecutar el contenido de estos archivos, en orden:

1. `01-schema.sql`: tablas, políticas y funciones de guardado.
2. `02-prices.sql`: las 41 presentaciones del catálogo actual.

Los scripts se pueden volver a ejecutar sin sobrescribir los precios ya guardados.
Las fotos y los nombres siguen en el catálogo de la aplicación.

## 2. Crear al administrador

En **Authentication → Users → Add user → Create new user**, crear
`gaston3x@gmail.com` con una contraseña elegida por el titular (al menos 12 caracteres).
Confirmar el correo del usuario mediante la opción de confirmación del panel.
No compartir ni guardar esa contraseña en el repositorio.

Ejecutar `03-admin.sql` en SQL Editor. El permiso queda asociado al ID del usuario,
no a un correo editable ni a metadatos que el cliente pueda cambiar.
Desactivar nuevos registros públicos en la configuración de Authentication.
Crear una cuenta no concede automáticamente acceso al panel de precios.

## 3. Recuperación de contraseña

En **Authentication → URL Configuration**:

- Site URL: `https://comercios-app.github.io/dona-carmen/`
- Redirect URL permitida: `https://comercios-app.github.io/dona-carmen/?admin=1&recovery=1`

Probar la entrega de recuperación de contraseñas al correo administrador. Para
el usuario inicial, que pertenece al equipo del proyecto, se puede probar el
servicio de correo predeterminado. Tiene límites y entrega sin garantía.
Para un servicio estable y antes de migrar a un correo fuera del equipo,
configurar un proveedor SMTP. Verificar un enlace real de recuperación.

## 4. Verificar y activar

1. `npm test`: prueba PostgreSQL local, permisos y reglas del carrito.
2. `npm run lint` y `npm run build`.
3. Comprobar con clave pública que se leen exactamente 41 precios vigentes.
4. Probar acceso con el administrador y rechazo con otro usuario.
5. Probar edición, revisión, guardado, historial, restauración y conflicto entre dos sesiones.
6. Verificar el correo de recuperación y el cambio de contraseña.
7. Configurar `VITE_LIVE_PRICES=true` en `.env.production` y volver a compilar.
8. Commit/push y `npm run deploy`; verificar menú y `/#/admin` publicados.

Acceso al panel: `https://comercios-app.github.io/dona-carmen/#/admin`.
Los cambios de precio no requieren más despliegues después de esta activación.
Las pestañas abiertas verifican los precios de nuevo antes de ir a WhatsApp;
si cambiaron, muestran el nuevo total y piden volver a enviar.
Si Supabase no responde, la app permite reintentar y no envía precios sin verificar.

## Cambiar al correo del negocio

Si es la misma persona, cambiar el correo del usuario existente en Supabase
conserva su ID y sus permisos. Si es una cuenta nueva, crearla primero y, desde
SQL Editor, agregar su ID a `private.price_admins`; verificar el nuevo acceso
antes de revocar el anterior. Nunca conceder este permiso desde el navegador.

## Recuperación operativa

Usar el historial para restaurar un precio: se registra como un nuevo cambio.
Antes de desactivar el servicio remoto por una incidencia, exportar los precios
vigentes a `src/data/productos.js`; el catálogo estático podría estar desactualizado.
El historial registra un ID de usuario estable y no publica el correo del administrador.

Referencias:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
