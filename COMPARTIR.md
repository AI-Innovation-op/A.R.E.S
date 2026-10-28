# Preparación para compartir

La guía vigente está en README.md, secciones «Compartir un espacio» y «Repositorio y ejecución».

La instalación actual sigue en modo local. No se publicó un dominio ni se activaron invitaciones reales. El control de acceso se comprobó con identidades temporales en ares_test.

Antes de abrir el servicio a un equipo: elegir dominio y proxy HTTPS, configurar los orígenes exactos, activar acceso compartido desde la consola, guardar recuperación y habilitar raíces externas a la instalación de A.R.E.S. Los proyectos son compartidos entre los miembros del espacio.

La imagen Compose sirve la interfaz compilada y exige acceso; no tiene socket Docker ni ejecutor de contenedores anidados. La instalación Node del host sí puede usar el ejecutor con Docker Desktop. El transporte GitHub ya se comprobó con un ejemplo sintético en el repositorio elegido por el propietario. Publicar el código en GitHub no aloja el backend ni la base de datos; el despliegue externo sigue siendo una etapa aparte.

## Configuración persistente en Compose

La imagen se ejecuta como el usuario `node`. `ARES_SETTINGS_FILE` apunta a `/app/.local-setup/settings/providers.env`, dentro del volumen `ares_settings`; permite guardar cambios de proveedor sin escribir en los archivos de la imagen. Los valores guardados de Gemini/OpenRouter y modo de acceso prevalecen sobre los iniciales. La conexión a PostgreSQL y los orígenes siguen procediendo del entorno de Compose.

Conserva por separado los volúmenes `ares_postgres` (datos), `ares_backups` (respaldos) y `ares_settings` (configuración privada). El respaldo de PostgreSQL no incluye las claves de proveedores. No subas ese volumen ni `backend/.env` a GitHub. Cambiar o recrear la imagen conserva los ajustes mientras se conserve el volumen; eliminarlo los pierde. Un volumen nombrado persiste datos, no los cifra.

La imagen local 1.0.0 se comprobó con PostgreSQL temporal, acceso compartido y Chrome: sesión obligatoria, compilación/ejecución aislada del valor 999, huella del HTML, ZIP y escritura de configuración por UID 1000, sin claves ni llamadas IA. Esta prueba no activa un espacio real compartido ni acredita un despliegue público o la ejecución Docker desde dentro de la imagen.
