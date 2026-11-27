# Recuperación de contraseña del panel

El restablecimiento usa enlaces de un solo uso con vencimiento a los 30 minutos. El token original solo se envía por email; la API guarda su hash.

## Configuración en producción

En las variables de entorno del servicio de API, configurar:

- `RESEND_API_KEY`: clave de API del proveedor Resend.
- `PASSWORD_RESET_FROM`: remitente perteneciente a un dominio verificado en Resend, por ejemplo `Loongis <no-reply@loongis.com>`.
- `PASSWORD_RESET_BASE_URL`: origen público del frontend, por ejemplo `https://www.loongis.com`, sin barra final.

Después de guardar las variables, volver a desplegar la API. La pantalla de recuperación muestra un aviso si falta alguna variable.

## Prueba manual

1. Abrir `/admin/login` y elegir “¿Olvidaste tu contraseña?”.
2. Ingresar el email de un administrador activo.
3. Abrir el enlace del correo antes de que pasen 30 minutos.
4. Guardar una clave de al menos 10 caracteres y comprobar el inicio de sesión.
5. Confirmar que el enlace ya no puede usarse por segunda vez.

La respuesta a una solicitud no indica si el email corresponde a una cuenta, para evitar enumerar administradores. Se limita a un envío por cuenta cada 60 segundos.
