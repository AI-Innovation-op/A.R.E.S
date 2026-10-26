# Tu primera conversación con A.R.E.S.

1. Abre http://127.0.0.1:5175 y recarga la página. El historial de las comprobaciones anteriores fue limpiado; el proyecto y las conexiones IA se conservan.
2. En **Consola táctica**, pulsa **Activar voz de A.R.E.S.**. Escucharás una presentación. En **Ajustar voz y velocidad** puedes elegir Pablo, Helena, Laura u otra voz española que ofrezca tu navegador. Si no se oye, comprueba el volumen del equipo y el permiso de sonido de la pestaña; pulsa **Probar voz**.
3. Escribe: **«Explícame qué es una API con un ejemplo sencillo. No he adjuntado archivos.»** Elige Documentación para Gemini o Programación para OpenRouter y pulsa Enviar. La respuesta se irá escribiendo. Al terminar, A.R.E.S. leerá hasta dos frases de resumen en español. El texto completo permanece visible.
4. Para hablar tú, pulsa **Dictar mensaje** y autoriza el micrófono cuando el navegador lo solicite. Revisa el texto reconocido y pulsa Enviar. El dictado normal puede usar servicios del navegador. **Dictar con Gemini** envía la grabación a Google y consume su cuota. La aplicación no guarda la grabación.
5. Prueba: **«¿Puedes confirmar que ya revisaste mi repositorio y que sus pruebas pasan?»** Si no aportaste archivos ni resultados, debe aclarar que no dispone de esa evidencia. Una propuesta describe lo que podría hacerse; una simulación usa un ejemplo; una acción realizada necesita un resultado confirmado.
6. Puedes pulsar **Detener voz**, **Silenciar voz automática** o **Escuchar respuesta**. Las respuestas anteriores no se leen automáticamente al recargar. El avatar cambia de postura según la conversación; no necesitas seleccionar poses.

Para cambiar de sección, abre el menú ☰. Sus entradas son módulos de A.R.E.S., no carpetas del equipo. Para revisar código propio, entra después en Repositorio, conecta una carpeta habilitada y lee o adjunta el archivo que quieras analizar. Para comprobar un script, revisa el comando y pulsa su botón. La respuesta del chat por sí sola no ejecuta archivos ni pruebas.

La voz usa Web Speech del navegador y una voz española disponible; no utiliza Gemini Orus ni añade una llamada de IA para crear el resumen hablado. Los diagramas ya permiten zoom, arrastre, ampliación y exportación SVG/PNG. El avatar incluye lluvia Matrix y arcos neón durante refactorizaciones; puedes pausar la animación.

Para comparar un refactor, abre ☰ → Espada Binaria → Refactorización. Pega el código original y el objetivo. Revisa Antes/Después; esta pantalla propone, no modifica el archivo. Para aplicar cambios a archivos conectados, utiliza las propuestas de Repositorio. Para diseño de sistemas, abre Arquitectura: DDD + Hexagonal es el formato inicial.

## Conversar sin pulsar Enviar en cada turno

1. Recarga la consola y busca **Hablemos**. Pulsa **Activar conversación** y permite el micrófono. La aplicación no lo activa al abrirse.
2. Di **«ARES»**. No necesitas decir «Ey». Espera el saludo y el estado **Te escucho**.
3. Di **«Ayúdame a organizar mi día, okey»**. Solo «okey» al final envía el turno; una pausa no lo envía. También puedes corregir la transcripción y pulsar **Enviar turno**.
4. A.R.E.S. lee un resumen en español y vuelve a escucharte. Mientras habla, la captura se pausa para evitar eco. Para cortarlo usa **Interrumpir respuesta**.
5. Di **«cancelar»** para descartar el turno o **«ARES descansa»** para volver a esperar la palabra ARES. **Desactivar micrófono** detiene la escucha. Salir de la pestaña también la detiene.

Si no se despierta, revisa **Escuché**: muestra localmente el texto que reconoció el navegador. No guarda esa escucha ambiental en el historial. El navegador puede procesar audio mediante su servicio en línea. Tras 90 segundos de un turno abierto se pausa para revisar el texto; no lo envía por silencio.

Para documentar mientras escuchas, selecciona un proyecto y activa **Guardar cada respuesta de voz como borrador en Biblioteca**. Solo se copia una solicitud y respuesta ya confirmadas. Verás el resultado del guardado. Este borrador no modifica el repositorio ni ejecuta lo que diga el modelo.

Puedes pedir ayuda cotidiana. Por ejemplo: «Tengo dos reuniones y quiero reservar tiempo para estudiar, okey». A.R.E.S. puede proponer un horario; no ha leído tu calendario ni puede cambiarlo sin una conexión real. Las lámparas y otros accesorios todavía no están conectados.

## Comprobar dependencias DDD

En **Repositorio**, conecta tu carpeta, lee un archivo JavaScript/TypeScript y pulsa **Añadir archivo a revisión DDD**. Repite para los archivos que quieras revisar, ajusta el alias si usas uno y pulsa **Comprobar reglas DDD**.

Por ejemplo, un archivo `orders/domain/order.ts` que importa `pg` recibirá una advertencia: la persistencia debe entrar mediante un puerto y un adaptador exterior. Se analizan importaciones explícitas, con archivo y línea. No se verifican automáticamente las invariantes del negocio ni todo el repositorio. El informe indica sus límites y puede descargarse.

El ejemplo de práctica está en `examples/ddd-orders`. Contiene un fallo intencional: admite añadir líneas a un pedido confirmado. Sus pruebas muestran el fallo antes de corregirlo. La integración automatizada comprobó propuesta, diff, aplicación, tres pruebas aprobadas y restauración en una copia temporal.
