# Tu primera conversación con A.R.E.S.

1. Abre http://127.0.0.1:5175 y recarga la página. El campo para escribir permanece al pie de la consola; los mensajes se desplazan dentro del chat. En **Proyecto** puedes consultar el historial, elegir un proyecto para una conversación nueva y preparar su memoria. **Nueva conversación** inicia un hilo sin borrar los anteriores.
2. En **Consola táctica**, abre **Voz** y pulsa **Activar voz de A.R.E.S.**. Escucharás una presentación. En **Ajustar voz y velocidad** puedes elegir Pablo, Helena, Laura u otra voz española que ofrezca tu navegador. Si no se oye, comprueba el volumen del equipo y el permiso de sonido de la pestaña; pulsa **Probar voz**. Puedes cerrar el panel para volver al chat.
3. Escribe: **«Explícame qué es una API con un ejemplo sencillo. No he adjuntado archivos.»** Elige Documentación para Gemini o Programación para OpenRouter y pulsa Enviar. La respuesta se irá escribiendo. Al terminar, A.R.E.S. leerá hasta dos frases de resumen en español. El texto completo permanece visible.
4. Para hablar tú, abre **Adjuntar y dictar**, pulsa **Dictar mensaje** y autoriza el micrófono cuando el navegador lo solicite. Revisa el texto reconocido y pulsa Enviar. Cerrar este panel detiene el dictado o cancela su transcripción pendiente. El dictado normal puede usar servicios del navegador. **Dictar con Gemini** envía la grabación a Google y consume su cuota. La aplicación no guarda la grabación. Las imágenes y la búsqueda web también están en este panel.
5. Prueba: **«¿Puedes confirmar que ya revisaste mi repositorio y que sus pruebas pasan?»** Si no aportaste archivos ni resultados, debe aclarar que no dispone de esa evidencia. Una propuesta describe lo que podría hacerse; una simulación usa un ejemplo; una acción realizada necesita un resultado confirmado.
6. Puedes pulsar **Detener voz**, **Silenciar voz automática** o **Escuchar respuesta**. Las respuestas anteriores no se leen automáticamente al recargar. El avatar cambia de postura según la conversación; no necesitas seleccionar poses.

Para cambiar de sección, abre el menú ☰. Sus entradas son módulos de A.R.E.S., no carpetas del equipo. Para revisar código propio, entra después en Repositorio, conecta una carpeta habilitada y lee o adjunta el archivo que quieras analizar. Para comprobar un script, revisa el comando y pulsa su botón. La respuesta del chat por sí sola no ejecuta archivos ni pruebas.

La voz usa Web Speech del navegador y una voz española disponible; no utiliza Gemini Orus ni añade una llamada de IA para crear el resumen hablado. Los diagramas ya permiten zoom, arrastre, ampliación y exportación SVG/PNG. El avatar incluye lluvia Matrix y arcos neón durante refactorizaciones; puedes pausar la animación.

## Revisar resultados junto a la conversación

1. En una respuesta terminada, pulsa **Abrir resultado**. En escritorio se abre junto al chat; en móvil ocupa el espacio de conversación y puedes cerrarlo para volver al mensaje. Las citas de documentos abren el mismo panel. Desde un módulo o un borrador de Biblioteca, usa **Ver junto al chat**.
2. Revisa **Documento**, **Diagramas**, **Código**, **Comparar** y **Origen**, según el contenido disponible. Los diagramas usan el visor Mermaid existente. Comparar usa Monaco y necesita un original: puede venir de un único archivo adjunto, de una refactorización del módulo o del texto que pegues. Un bloque puede ser un fragmento; esta vista no aplica archivos ni ejecuta código.
3. Para conservar una respuesta como documento, pulsa **Guardar nota en Biblioteca**. Requiere una respuesta confirmada en una conversación con proyecto y PostgreSQL. El servidor copia solicitud y respuesta como borrador; no vuelve a consultar al modelo. Las respuestas de sesión se pueden descargar.
4. En un documento guardado puedes editar, guardar una revisión, aprobarla y consultar versiones anteriores. Aprobar el documento no acredita pruebas del código ni modifica archivos del repositorio. Si cierras el panel con una edición pendiente, se conserva mientras sigues en esta pantalla; guarda o cancela antes de cambiar de resultado o sección. Guarda antes de recargar la página.
5. **Usar en mensaje** añade el contenido actual y su referencia al borrador del chat, sin enviarlo. Conserva lo que ya habías escrito y respeta el límite de 16 000 caracteres. Si pertenece a otro proyecto, abre primero una conversación nueva de ese proyecto. Revisa tu pregunta y pulsa Enviar cuando corresponda.

**Origen** muestra proyecto, proveedor/modelo, identificadores y revisión del documento cuando existen. Al abrir una cita se muestra la revisión actual de Biblioteca; el fragmento recibido al generar la respuesta permanece en el chat y también se conserva como contexto de la cita.

Para comparar un refactor, abre ☰ → Espada Binaria → Refactorización. Pega el código original y el objetivo. Revisa Antes/Después; esta pantalla propone, no modifica el archivo. Para aplicar cambios a archivos conectados, utiliza las propuestas de Repositorio. Para diseño de sistemas, abre Arquitectura: DDD + Hexagonal es el formato inicial.

## Conversar sin pulsar Enviar en cada turno

1. Recarga la consola, abre **Voz** y busca **Hablemos**. Pulsa **Activar conversación** y permite el micrófono. La aplicación no lo activa al abrirse. Cerrar este panel conserva la conversación activada; el estado y el botón para desactivar el micrófono o interrumpir la respuesta permanecen en la barra del chat.
2. Di **«ARES»**. No necesitas decir «Ey». Espera el saludo y el estado **Te escucho**.
3. Di **«Ayúdame a organizar mi día, okey»**. Solo «okey» al final envía el turno; una pausa no lo envía. También puedes corregir la transcripción y pulsar **Enviar turno**.
4. A.R.E.S. lee un resumen en español y vuelve a escucharte. Mientras habla, la captura se pausa para evitar eco. Para cortarlo usa **Interrumpir respuesta**.
5. Di **«cancelar»** para descartar el turno o **«ARES descansa»** para volver a esperar la palabra ARES. **Desactivar micrófono** detiene la escucha. Salir de la pestaña también la detiene.

Si no se despierta, revisa **Escuché**: muestra localmente el texto que reconoció el navegador. No guarda esa escucha ambiental en el historial. El navegador puede procesar audio mediante su servicio en línea. Tras 90 segundos de un turno abierto se pausa para revisar el texto; no lo envía por silencio.

El medidor de nivel es opcional y viene apagado. Solo visualiza el volumen local: no graba ni envía esa captura. Actívalo desde las opciones de voz; detener, cerrar esas opciones, hablar A.R.E.S. o esconder la pestaña libera los recursos del medidor. Cerrar las opciones conserva el reconocimiento de conversación si seguía activado; utiliza **Desactivar micrófono** para detenerlo también.

Para documentar mientras escuchas, selecciona un proyecto y activa **Guardar cada respuesta de voz como borrador en Biblioteca**. Solo se copia una solicitud y respuesta ya confirmadas. Verás el resultado del guardado. Este borrador no modifica el repositorio ni ejecuta lo que diga el modelo.

Puedes pedir ayuda cotidiana. Por ejemplo: «Tengo dos reuniones y quiero reservar tiempo para estudiar, okey». A.R.E.S. puede proponer un horario; no ha leído tu calendario ni puede cambiarlo sin una conexión real. Las lámparas y otros accesorios todavía no están conectados.

## Leer un repositorio público de GitHub

1. En la consola, pulsa **Leer GitHub**. Si quieres guardar el informe en Biblioteca, selecciona antes un proyecto desde **Proyecto**.
2. Introduce `https://github.com/organización/repositorio` (también admite `.git`). Puedes indicar una rama, etiqueta o commit. **Inspeccionar** fija un commit y muestra las rutas disponibles; todavía no llama al modelo ni lee el contenido de los archivos.
3. Filtra rutas y elige hasta **8 archivos de texto**, con **64 KiB por archivo y 96 KiB en total**. Combina archivos del dominio, aplicación, adaptadores y pruebas para revisar una arquitectura DDD. La selección es tuya: un README no acredita haber revisado la implementación. **Ver excluidos** explica por qué se omiten credenciales, dependencias, archivos generados, binarios, enlaces y archivos grandes.
4. Pulsa **Leer selección**. Revisa el contenido descargado, sus enlaces al commit y sus SHA-256. Los fallos se muestran por archivo. Si cambias la selección debes volver a leerla. Si GitHub entrega un árbol incompleto, el total del repositorio se declara desconocido.
5. **Analizar con OpenRouter** envía solo los archivos leídos y el registro de cobertura al modelo de programación configurado. Esta acción consume cuota de IA; inspeccionar y leer solo consumen solicitudes públicas de GitHub. El resultado distingue el alcance confirmado por la herramienta del análisis generado por IA, que debes revisar.
6. El informe se abre junto al chat. **Origen** conserva commit, cobertura, fuentes y hashes. **Usar en mensaje** añade el informe y su alcance a tu borrador, sin enviarlo. Si excede el límite de 16 000 caracteres se conserva el borrador y se muestra un aviso.
7. **Guardar informe en Biblioteca** guarda el resultado como borrador en el proyecto elegido, sin otra generación. Puedes editarlo y volver a abrirlo después de recargar. El registro de origen permanece aunque edites el texto. **Descargar** exporta el resultado a Markdown.

Las lecturas temporales caducan a los 15 minutos y se pierden al reiniciar el backend; guarda o descarga el informe antes. Se permiten hasta cuatro lecturas temporales por usuario. Los repositorios privados no están admitidos en esta etapa y no se utiliza la sesión de GitHub CLI. El modelo recibe texto con secretos reconocidos ocultos; revisa la vista previa antes de enviarlo. Una lectura remota no ejecuta pruebas, no modifica archivos ni publica cambios. Puedes cancelar desde el diálogo.

## Preview y ZIP de los mismos archivos

1. Abre **☰ → Preview y ZIP**, o **Abrir resultado → Preview y ZIP** junto al chat. Si la respuesta contiene un único bloque HTML, ese bloque se prepara con el nombre propuesto index.html; revisa y cambia los nombres si hace falta. Abrir el editor no ejecuta código.
2. Añade archivos y elige la entrada HTML. Puedes importar JSON con entry y files desde **Importar o conservar fuentes estructuradas**. Se admiten 24 archivos, 64 KiB por archivo y 256 KiB en total. Los imports deben referirse a archivos incluidos; Vue 3 está preinstalado. No se instalan paquetes, plugins, SSR ni preprocesadores de CSS. Las entradas no compatibles muestran el motivo, sin sustituirlas por otra aplicación.
3. Pulsa **Compilar archivos revisados**. Es una transformación real con esbuild y compilador SFC de Vue; no ejecuta pruebas ni verifica reglas de negocio. El identificador, revisión, huellas y manifiesto muestran qué versión se preparó.
4. **Abrir vista aislada** ejecuta esa salida en un iframe con origen opaco, sin sesión/almacenamiento de A.R.E.S., permisos de dispositivos ni conexiones externas. El editor se pliega para dejar espacio a la vista; vuelve a abrir **Archivos revisados · editar fuentes** cuando quieras cambiar algo. Puedes elegir escritorio, tablet o móvil y consultar hasta cincuenta mensajes de salida del prototipo. Los mensajes no acreditan pruebas.
5. **Descargar ZIP** entrega los fuentes revisados, .ares/preview.html, .ares/manifest.json y las licencias del runtime/herramienta. El HTML compilado tiene la misma huella que la vista de esa versión. Cambiar un archivo detiene la vista y exige volver a compilar antes de abrir o exportar esa nueva versión.
6. **Detener vista** cierra el iframe. También se detiene al ocultar la pestaña, salir de la sección o tras dos minutos. Las versiones del servidor caducan a los treinta minutos y se pierden al reiniciarlo: conserva el ZIP o **Descargar fuentes JSON** para recuperar tu trabajo. **Descartar versión temporal** libera su cupo; **Descartar cambios del editor** recupera la última versión conservada en esta pantalla.

**Usar fuentes compiladas en mensaje** añade las fuentes exactas de esa versión y sus huellas al borrador, sin enviarlo. Por ejemplo, si cambiaste 17 por 999, compila de nuevo antes de discutir el resultado: el chat recibirá el archivo con 999. Se conservan el borrador anterior y el límite de 16 000 caracteres; si el conjunto no cabe, descarga su JSON y selecciona un fragmento explícito.

El aislamiento descrito corresponde a la vista dentro de A.R.E.S. El HTML exportado sigue siendo código ejecutable cuando lo abres fuera de la aplicación. Una vista de login no acredita un backend de autenticación. La compilación de TypeScript elimina tipos; no sustituye una comprobación completa de tipos ni una suite de pruebas.

## Conversar desde la terminal

Mantén la consola y Docker abiertos. En otra terminal, desde la raíz de A.R.E.S., ejecuta `npm run terminal` o abre `ares-terminal.cmd` en Windows. Primero escribe `status`, después `mode auto` y una pregunta como «Documenta en una frase un botón que suma una unidad». `route tu consulta` muestra la selección sin llamar al modelo. Las preguntas sí consumen cuota. No necesitas copiar claves a esta terminal.

Empiezas sin proyecto y con contexto en memoria. Usa `projects` y `project UUID` si quieres guardar conversaciones del proyecto; `conversations` y `resume UUID` permiten recuperarlas. `new` comienza otra conversación sin borrar la anterior. `cancel` interrumpe la operación activa; `retry` recupera un turno pendiente conservando su identificador. `clear` limpia únicamente la pantalla.

Para código, conecta antes una carpeta desde Repositorio en la web. Prueba `read ruta/archivo.ts`, `ddd ruta/archivo.ts` o `audit ruta/archivo.ts`; la última envía el archivo elegido a OpenRouter. `ddd` analiza imports, sin ejecutar reglas de negocio. `run test` prepara y muestra el script; revisa su comando/aislamiento y escribe `confirm HUELLA` solo si quieres ejecutarlo. El resultado informa estado y salida reales.

Para probar compilación sin IA, usa `preview examples/terminal-preview/sources.json`. Abre voluntariamente el enlace temporal para ver el contador y descarga esa versión con `zip ID .local-setup/mi-prueba.zip`, reemplazando ID. Se rechaza un destino existente. El [manual de terminal y adaptadores](CLI-Y-MCP.md) explica el resto de órdenes y la sesión en modo compartido. La terminal no hace push.

## Acciones sin buscar entre secciones

Pulsa **Ctrl+K**, **⌘+K** o el botón de acciones de la cabecera. Busca una tarea y pulsa Enter. La paleta abre controles de A.R.E.S.; por ejemplo, Opciones de voz abre el panel sin activar el micrófono. No es una terminal y no ejecuta comandos del sistema. Respeta borradores pendientes y permisos.

En **Leer GitHub** también puedes pegar un enlace público de PR. Se fija su cabecera aunque provenga de un fork y se listan hasta cien cambios. El análisis posterior usa los archivos de cabecera que elijas; no acredita leer la base, comprobar todo el diff ni ejecutar CI. No publica comentarios.

## Comprobar dependencias DDD

En **Repositorio**, conecta tu carpeta, lee un archivo JavaScript/TypeScript y pulsa **Añadir archivo a revisión DDD**. Repite para los archivos que quieras revisar, ajusta el alias si usas uno y pulsa **Comprobar reglas DDD**.

Por ejemplo, un archivo `orders/domain/order.ts` que importa `pg` recibirá una advertencia: la persistencia debe entrar mediante un puerto y un adaptador exterior. Se analizan importaciones explícitas, con archivo y línea. No se verifican automáticamente las invariantes del negocio ni todo el repositorio. El informe indica sus límites y puede descargarse.

El ejemplo de práctica está en `examples/ddd-orders`. Contiene un fallo intencional: admite añadir líneas a un pedido confirmado. Sus pruebas muestran el fallo antes de corregirlo. La integración automatizada comprobó propuesta, diff, aplicación, tres pruebas aprobadas y restauración en una copia temporal.
