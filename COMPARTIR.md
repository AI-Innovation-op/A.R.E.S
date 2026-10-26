# Preparación para compartir

La guía vigente está en README.md, secciones «Compartir un espacio» y «Repositorio y ejecución».

La instalación actual sigue en modo local. No se publicó un dominio ni se activaron invitaciones reales. El control de acceso se comprobó con identidades temporales en ares_test.

Antes de abrir el servicio a un equipo: elegir dominio y proxy HTTPS, configurar los orígenes exactos, activar acceso compartido desde la consola, guardar recuperación y habilitar raíces externas a la instalación de A.R.E.S. Los proyectos son compartidos entre los miembros del espacio.

La imagen Compose sirve la interfaz compilada y exige acceso; no tiene socket Docker ni ejecutor de contenedores anidados. La instalación Node del host sí puede usar el ejecutor con Docker Desktop. El transporte GitHub ya se comprobó con un ejemplo sintético en el repositorio elegido por el propietario. Publicar el código en GitHub no aloja el backend ni la base de datos; el despliegue externo sigue siendo una etapa aparte.
