# A.R.E.S.: ficha de la implementación local

Actualizada el 27 de octubre de 2026. Versión local 1.0.0. Este documento registra capacidades comprobadas de esta instalación. La ficha maestra v2.6 conserva el diseño del producto; sus marcas de implementación pertenecen al prototipo original.

## Ampliación: terminal interactiva y referencia beta 4.0

La [beta 4.0 revisada](REFERENCIA-BETA-V4.md) queda fijada a 614bee1 hasta nuevo aviso. Nuestra terminal se inicia con `npm run terminal` o `ares-terminal.cmd` y convive con la beta: verifica la identidad de la API antes de conectarse. Comparte autenticación, permisos y proveedores del backend. Incluye SSE, modo automático optativo, historial por proyecto, lectura/auditoría explícita, DDD estático, scripts preparados antes de confirmar por huella y preview/ZIP. La CLI JSON y MCP conservan su alcance anterior; la REPL añade ejecución confirmada, sin shell arbitrario, aplicación de parches ni push.

La nueva regresión pasó **98 pruebas backend y compilación**. La integración adicional ejecutó un proceso REPL real contra HTTP/PostgreSQL temporal, leyó fuentes, analizó imports, ejecutó tres pruebas de Pedidos en Docker, recuperó una conversación y exportó el prototipo compilado. El modelo de esa integración fue simulado; una llamada independiente de Gemini confirmó streaming real con una consulta sintética sin archivos ni historial persistente. [CLI-Y-MCP.md](CLI-Y-MCP.md) explica comandos y límites. Las cifras de instalación limpia y de imagen en el cierre anterior corresponden a la entrega anterior a esta ampliación; no acreditan por sí solas la REPL nueva. El frontend no cambió en esta ampliación.

## Cierre local del plan comparativo — 27 de octubre

La implementación autorizada está preparada para revisión local antes del push. La aceptación por etapa está en [REVISION-PREVIA-AL-PUSH.md](REVISION-PREVIA-AL-PUSH.md). Las secciones posteriores conservan evidencia histórica; sus cifras no sustituyen esta última validación.

| Bloque | Resultado actual |
| --- | --- |
| Experiencia | Consola compacta, resultados junto al mensaje, paleta Ctrl+K y conservación del borrador/proyecto/fuentes |
| Voz y avatar | ARES/okey, finales acumulados y provisionales separados; interrupción sin reactivar turnos antiguos, TTS coordinado, medidor opcional local y liberación de recursos; el bucle 3D se pausa fuera de vista o con pestaña oculta |
| Prototipos | Fuentes estructuradas HTML/CSS/JS/TS/Vue; compilación real, ejecución explícita en iframe aislado, escritorio/tablet/móvil, logs limitados y ZIP con las mismas fuentes/salida/huellas/licencias |
| Contexto exacto | Discutir un prototipo incorpora las fuentes de su versión compilada; editar exige recompilar, sin reutilizar silenciosamente el código anterior del modelo |
| Contratos y DDD | Tipos comunes de artefactos, ingesta, eventos SSE y ejecuciones; evidencia con comprobantes. Pedidos/Inventario, ADR/diagrama, seis pruebas y mutación de la invariante en copia temporal |
| Integraciones | CLI/MCP por API con proyecto fijo, lectura por defecto, propuestas optativas; PR público con cabecera fija y alcance explícito, sin comentarios automáticos |
| Entrega | Versión coherente, imagen con frontend, configuración persistente sin privilegios y CI ampliado; no se ejecutó CI remoto ni se hizo push en esta continuación |

**Validación consolidada:** 81 pruebas backend, 86 frontend, 45 PostgreSQL y dos de aislamiento Docker aprobadas; seis DDD más fallo esperado al quitar la invariante. Chrome: 34 recorridos generales anteriores más el nuevo caso de POSE final; seis casos de voz/avatar repetidos tras esa corrección. Se conservan los 13 persistentes, uno de acceso y cuatro de producción. Compilaciones backend/frontend aprobadas. El contenedor pasó una comprobación real con PostgreSQL temporal, sesión obligatoria, preview/ZIP y configuración por UID 1000, sin claves ni llamadas IA en esa imagen.

**Cierre adicional:** npm audit no informó vulnerabilidades conocidas en backend/frontend. Las llamadas reales de texto por API local confirmaron streaming Gemini y OpenRouter, español y declaración de límites de acceso; sin archivos privados ni historial. Google Search volvió a devolver 429. El prompt v1.9 refuerza supuestos/invariantes, pero las respuestas reales conservan afirmaciones discutibles: no se certifica exactitud semántica. El parser admite metadatos POSE completos al final fuera de código, ocultándolos también al hablar. `review:package` genera una entrega de fuentes con hashes/CRC y excluye datos privados; su prueba de instalación limpia se detalla en el informe de revisión.

Los motores de reconocimiento/TTS y los proveedores IA se simularon en la regresión. Chrome, Vue, Monaco, WebGL, compilador, PostgreSQL y Docker fueron reales. La lectura anónima real del PR #1 fijó head `d061b9a1d4b21845ce1d5fb9aeef52d764e4538f`, base `7ac1290c87c249cead5555110fa4179c27d654e8` y cinco cambios; no llamó al modelo ni publicó comentarios. El análisis usa archivos elegidos del head: no acredita comparar toda la base/diff o ejecutar CI.

**Rendimiento observado:** Ryzen 7 7735HS, RTX 4060 Laptop, Windows, Node 24.21, Chrome 155, 1440 × 1100, build de producción. Carga hasta interfaz/avatar: 810 ms; tres compilaciones Vue, mediana 73 ms; apertura de preview, mediana 91 ms. En tres segundos del renderer: heap JS 10,9 MiB, 738 ms de tareas CPU, RAF medio 144 Hz, p95 7 ms y cero intervalos mayores de 50 ms. RAF no mide presentaciones GPU ni heap JS mide RAM total. Son muestras locales, no SLA; comparar bajo las mismas condiciones e investigar regresiones de medianas superiores al 50 %.

**Pendiente con el usuario:** repetir micrófono/altavoz físicos tras estos ajustes; revisar la calidad de respuestas con sus reglas reales de negocio; revisar cambios antes de push y consultar después el primer CI remoto. Chat de ambos proveedores confirmado; Google Search sigue condicionado por cuota. No hay domótica, correo/calendario, Orus ni despliegue público nuevos. La confirmación física anterior de ARES/okey se conserva como evidencia anterior.

| Área | Implementación comprobada |
| --- | --- |
| Consola | Vue 3, TypeScript, avatar Three.js con 16 poses, desplazamiento y movimiento reducido |
| Proveedores | Gemini para documentación; OpenRouter para código, auditoría y arquitectura; claves en backend/.env (Node) o volumen privado ares_settings (Compose) |
| Datos | PostgreSQL 16 y pgvector, migraciones repetibles, conversaciones por proyecto, reintentos sin duplicar turnos |
| Biblioteca | Documentos persistentes con edición, aprobación, revisiones anteriores y eliminación; canónico sincronizado e invalidación de memoria tras editar |
| Memoria | RAG de documentos y hasta 50 archivos de código seleccionados; fragmentación textual, embeddings de 768 dimensiones, citas persistentes y exclusión de código obsoleto o sensible |
| Diagramas | Mermaid local con SVG saneado, zoom, paneo, ampliación y exportación SVG/PNG; límites de texto/aristas y rechazo de configuración, HTML y enlaces activos |
| DDD | Caso de pedidos con prueba completa PostgreSQL/Docker y análisis local de imports JS/TS seleccionados, con hallazgos, límites y exportación |
| Repositorio | Carpetas habilitadas, lectura UTF-8 hasta 64 KB, exclusión de credenciales y enlaces, adjuntos seleccionados y scripts npm con evidencia |
| Edición | Propuestas de un archivo y conjuntos de hasta cinco archivos; parches de existentes hasta 64 KB, creación en carpetas existentes y hasta 128 KB de contexto; diff, huella del conjunto, respaldo, restauración, recuperación de interrupciones y check opcional después de aplicar |
| Continuidad | Copias PostgreSQL verificadas mediante recuperación temporal, SHA-256, comparación de datos y estructura; retención y programación cada 24 horas con el servidor encendido |
| Git | Inicialización local por botón, estado/diffs, commits de archivos seleccionados conservando el índice ajeno, ramas, remoto GitHub y publicación de rama con PR borrador bajo confirmación explícita |
| Sincronización documental | Biblioteca → propuesta local de Markdown/YAML → revisión/aplicación → commit; sin llamada al modelo para copiar un documento guardado |
| Multimodal | Dictado del navegador o grabación de hasta 30 segundos para transcribir con Gemini; lectura con voces del navegador; PNG/JPEG/WebP hasta 4 MB; resultados de investigación revisables antes de insertarlos en el mensaje |
| Conversación | Micrófono por activación explícita, despertar con «ARES», cierre con «okey», transcripción editable, resumen en español y notas opcionales en Biblioteca |
| Respuesta progresiva | Streaming real en el chat con Gemini y OpenRouter, cancelación y confirmación del turno completo; respuestas parciales fuera del historial confirmado |
| Búsqueda web | Gemini con Google Search, fuentes HTTP(S) y sugerencias aisladas; la última prueba real devolvió cuota agotada |
| Acceso | Modo local por defecto; compartido opcional con invitaciones de un uso, sesiones HttpOnly de siete días, roles, revocación y renovación conservando identidad; Bio personal, proyectos comunes |
| Consumo | Reservas SQL por operación, topes diarios del espacio/usuario y concurrencia; bytes de texto/medios de entrada, intentos fallidos incluidos; no estima dinero ni saldo del proveedor |
| Ejecución aislada | Docker sobre copia filtrada, sin red ni carpetas del host al ejecutar; caché pública npm de solo lectura, recursos limitados y cancelación real; ejecutor nativo explícito bloqueado al compartir |
| Bio-Armadura | Desactivada por defecto, preferencias PostgreSQL, foco/pausas, recordatorio de agua, pausa/reanudación, avisos opcionales y acciones confirmadas; sin inferir fatiga ni medir actividad física |

## Continuidad y recuperación

La consola incluye **Respaldos**. En Windows los archivos se guardan por defecto en `.local-setup/backups`; en Docker, en el volumen `ares_backups`. Cada copia tiene un archivo `.dump` y un manifiesto `.json`. Ambos son necesarios. Contienen información del proyecto y deben guardarse con acceso restringido. El respaldo no incluye backend/.env ni las carpetas de código originales: guarda esos archivos por separado.

`npm run backup:create` crea y verifica una copia; `npm run backup:list` muestra el estado; `npm run backup:verify -- UUID` repite la recuperación temporal. `npm run backup:recover -- UUID` crea una base nueva y devuelve su nombre. Tras revisarla, se puede apuntar DATABASE_URL a esa base y reiniciar. Estos comandos conservan la base activa. No hay importación de archivos SQL arbitrarios desde el navegador.

Configuración: ARES_BACKUP_ENABLED, ARES_BACKUP_INTERVAL_HOURS, ARES_BACKUP_KEEP, ARES_BACKUP_DIR y ARES_PG_BIN. La planificación se ejecuta dentro del servidor y comprueba al arrancar si falta una copia reciente; no funciona cuando A.R.E.S. está apagado. Retención predeterminada: siete copias. Una copia en el mismo disco no cubre la pérdida física del equipo.

## Validación del punto 1

39 pruebas del backend, 29 de PostgreSQL y 47 del frontend aprobadas. Recuperación real de la base activa en Windows y Docker, sin reemplazarla. Prueba Chrome: crear, verificar, recargar y revisar móvil sin desbordamiento ni errores del navegador. La prueba SQL comprueba retención, recuperación en una base nueva y rechazo de una copia alterada. El esquema se compara por columnas, restricciones e índices estructurales; los datos, por huellas de todas las filas. PostgreSQL aplica el DDL del archivo mediante pg_restore con salida ante errores.

## Validación de la etapa inicial y límites

171 pruebas aprobadas: 54 del backend, 41 PostgreSQL, 51 frontend, 13 Chrome generales, nueve Chrome persistentes, una Chrome de acceso y dos de Docker real. Ambas compilaciones pasan. La consola real en 5175 se comprobó en escritorio/móvil, con modo local, Bio desactivada y ausencia de claves configuradas en los assets compilados. No se activó acceso compartido ni se publicó esta instalación.

El punto 7 comprobó sesión, roles, origen, caducidad, invitación de un uso, revocación y renovación de identidad. La reserva de consumo impide exceder topes mediante solicitudes simultáneas. Docker real confirmó ausencia de .env y claves, bloqueo de red, original intacto, cancelación y caché de dependencias de solo lectura sin hooks. El ejecutor Windows utiliza un Job Object para terminar descendientes incluso al cancelar durante el arranque. Se corrigió una carrera de interfaz que permitía conectar una carpeta mientras cambiaba el proyecto.

La interfaz compilada se incluye en la imagen del backend; la ficha se obtiene de una API protegida y no se incrusta en los assets públicos. Compose exige acceso y sigue publicado solo en loopback. La imagen no monta socket Docker ni código del host; para ejecutar comprobaciones Docker se utiliza Node en el host con Docker Desktop. Consulta README.md y COMPARTIR.md para el funcionamiento, recuperación y límites.

## Evidencia por etapa

El punto 6 se verificó en PostgreSQL, con reloj simulado y en Chrome. Los temporizadores se recuperan al recargar; la aplicación debe estar abierta para avisar. Los valores iniciales son ajustes configurables del producto, no una evaluación de salud. Las notificaciones del sistema requieren un permiso que el usuario solicita desde su botón. Se puede silenciar la pestaña sin cambiar los datos guardados. Solo se registran acciones confirmadas del temporizador, no cámara, teclado ni supuestos niveles de hidratación o fatiga.

El punto 5 incorpora ocho pruebas del backend, una comprobación SQL de interrupción/cancelación y dos recorridos Chrome de dictado/voz simulados, streaming HTTP, imágenes y búsqueda. Se comprobó contra APIs reales con consultas públicas: OpenRouter transmitió ocho fragmentos; Gemini transmitió y analizó una imagen sintética. Google Search devolvió GEMINI_QUOTA: su manejo de fuentes está probado con transporte simulado y debe revalidarse cuando haya cuota. No se capturó el micrófono real. El usuario autoriza el micrófono y revisa el texto antes de enviarlo. La aplicación no guarda audio ni imágenes; insertar un análisis sí conserva su texto en la conversación. Las voces y el dictado del navegador dependen de su compatibilidad y pueden usar servicios en línea. El dictado alternativo envía audio a Gemini. [Audio de Gemini](https://ai.google.dev/gemini-api/docs/audio), [streaming de OpenRouter](https://openrouter.ai/docs/api_reference/streaming).

El punto 4 pasó 44 pruebas del backend, 37 SQL y 47 del frontend, además de Chrome para edición/aprobación/eliminación, memoria de código, citas tras recarga y diagramas. Indexar código envía únicamente el archivo seleccionado a Gemini para embeddings. No se analiza su AST. Si cambia el archivo o la carpeta conectada, sus fragmentos se excluyen hasta reindexar. Editar un documento crea una revisión y lo devuelve a borrador; eliminarlo retira sus versiones y embeddings, mientras las conversaciones conservan las citas históricas ya recibidas. [Configuración de Mermaid](https://mermaid.js.org/config/usage.html).

El punto 3 se verificó inicialmente con cinco pruebas de repositorios Git temporales y Chrome: iniciar Git, seleccionar archivos, commit, rama de trabajo y sincronización documental con diff. La publicación se probó primero mediante transporte simulado y después con el ejemplo sintético real descrito al final de esta ficha. La consola muestra y exige confirmar destino, rama, historial y descripción. Git trabaja con una carpeta .git propia; worktrees enlazados y operaciones de merge/rebase pendientes deben gestionarse con Git externo.

El commit se prepara con un índice temporal y se confirma mediante comparación de la referencia anterior; conserva cambios preparados de otros archivos. Referencias técnicas: [git commit-tree](https://git-scm.com/docs/git-commit-tree), [git update-index](https://git-scm.com/docs/git-update-index) y [GitHub CLI API](https://cli.github.com/manual/gh_api).

El punto 2 incorpora cinco pruebas SQL nuevas y un recorrido Chrome con dos archivos: revisión, aplicación, creación de notas, check real y restauración. La aplicación de un conjunto se realiza archivo por archivo; ante un fallo queda pendiente y permite completarla o restaurarla. No se presenta como una transacción atómica del sistema de archivos. Un cambio posterior bloquea la operación para conservarlo.

El orden de la etapa inicial se registra en PLAN-DE-TRABAJO.md; la continuación, en PLAN-EXPERIENCIA.md. El despliegue público no forma parte de la instalación activada. La búsqueda web necesita cuota; la publicación GitHub ya se comprobó en el repositorio elegido por el usuario.

## Experiencia de voz y comienzo limpio (26 de octubre)

Voz automática opcional mediante Web Speech y voces españolas disponibles, con selección y velocidad. Resume hasta dos frases de respuestas nuevas confirmadas, evita código/metadatos, permite detener y silenciar, y no relee conversaciones al recargar. Se verificó voz nativa Microsoft Pablo es-ES con eventos reales de inicio/fin. La matriz visible se retiró: las 16 poses se alimentan de las respuestas, incluso durante SSE.

El prompt v1.7 incorporó español claro, ejemplos y evidencia de acceso/ejecución; la versión actual es v1.8. Dos comprobaciones públicas reales, con Gemini y OpenRouter, indicaron falta de archivos y pruebas y explicaron propuesta/simulación/acción realizada. No se enviaron archivos privados. Se borraron tres conversaciones de comprobación y seis mensajes; el historial quedó vacío en ese momento. Se conserva el proyecto y la configuración. Guía inicial: GUIA-DESDE-CERO.md. La etapa posterior añadió Mermaid interactivo y efectos Matrix.

Validación de esta mejora: 58 pruebas frontend, 14 recorridos Chrome generales y nueve persistentes aprobados, además de compilación frontend. Los recorridos incluyen las 16 poses elegidas desde respuestas, cabecera SSE parcial oculta, voz solo tras confirmación y ausencia de lectura automática del historial recuperado. La síntesis española también se comprobó con el motor nativo de Chrome, sin simulación de voz.

## Navegación, comparación y DDD (26 de octubre)

Menú ☰ cerrado por defecto, panel con cierre por Escape/selección, foco controlado y desplazamiento del tema. Sus entradas son secciones de la consola. Se retiró la barra lateral permanente.

Comparador Monaco 0.57 con original/propuesta de solo lectura, rojo/verde, líneas, navegación entre cambios, ampliación y vista paralela/unificada; carga y worker locales bajo demanda. Disponible en propuestas de Repositorio y en Refactorización de Espada Binaria al proporcionar original y recibir un único bloque de código completo. Los conjuntos muestran el archivo seleccionado. Se conserva el parche textual y las mismas verificaciones del servidor para aplicar/restaurar.

DDD + Hexagonal es la opción inicial de Arquitectura, con formatos para contextos delimitados y modelo de dominio. El prompt prioriza reglas del negocio, agregados e invariantes antes de carpetas; no impone microservicios. La migración 012 modifica solo el valor inicial de los proyectos nuevos.

Validación de navegación/diff/DDD: 58 pruebas frontend, 16 Chrome generales y nueve persistentes aprobados; prueba de dominio DDD y prueba PostgreSQL de valor inicial/guardado aprobadas. Ambas compilaciones pasan. npm audit tras consolidar DOMPurify no informó vulnerabilidades. La consola real confirmó menú cerrado, diseño móvil, DDD inicial y cero conversaciones, sin errores de página. Los diffs se comprobaron con proveedores de prueba y Monaco real; no se enviaron archivos privados para estas comprobaciones.

## Conversación, diagramas y DDD: continuación del 26 de octubre

**Voz confirmada por el usuario:** tras sustituir «Ey ARES» por **«ARES»**, El usuario confirmó que se activa y responde en español usando su micrófono físico. La interfaz conserva la opción de saludo anterior, pero no la exige. Muestra lo reconocido mientras espera, permite cerrar con «okey», corregir el texto, cancelar, descansar y detener. El silencio no envía; tras 90 segundos pide revisión. Se suspende la captura durante la síntesis y se detiene al ocultar la pestaña. No funciona con la aplicación cerrada. El reconocimiento depende del navegador y puede usar servicios en línea. [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

La voz continúa con Web Speech. Orus se evaluó como alternativa de Gemini TTS que requeriría otro flujo de generación de audio y cuota; no está integrado ni se afirma haberlo probado. El prompt v1.8 permite asistencia personal cotidiana sin afirmar acceso a calendario, correo o dispositivos. Las pruebas reales de texto con ambos proveedores respondieron a este alcance. Los accesorios inteligentes quedan para otra etapa.

La documentación opcional copia cada solicitud y respuesta de voz confirmadas a una Nota de conversación en Biblioteca. Comprueba proyecto, propietario, origen e idempotencia. Se guarda mientras habla; no ejecuta órdenes ni modifica archivos. Las pruebas SQL y Chrome comprobaron almacenamiento real con respuestas y motores de voz simulados.

**DDD:** el ejemplo de pedidos recorrió documentación, propuesta, diff, aplicación y restauración. PostgreSQL y Docker reales confirmaron fallo inicial, tres pruebas aprobadas tras corregir y fallo esperado al restaurar. El proveedor fue simulado. El analizador local usa AST JS/TS para imports de hasta 50 archivos seleccionados, 64 KB cada uno y 512 KB en total. Comprueba huellas y detecta dependencias exteriores del dominio, paquetes técnicos, adaptadores desde aplicación y acceso a otro dominio. Expone incertidumbres; no valida invariantes ni certifica la arquitectura completa.

**Mermaid y avatar:** Chrome comprobó diagramas de secuencia, ER y C4 con zoom, paneo, ampliación y exportación SVG/PNG real, conservando el saneamiento. La lluvia Matrix es procedural y los arcos neón se disparan al refactorizar; pausa y movimiento reducido desactivan efectos. La matriz de poses sigue oculta.

**GitHub real:** README inicial en main autorizado explícitamente, commit `7ac1290c87c249cead5555110fa4179c27d654e8`. El servicio de publicación de A.R.E.S. publicó cinco archivos sintéticos en `test/ares-ddd-validation-20261026`, tras tres pruebas aprobadas en Docker. [PR borrador #1](https://github.com/AI-Innovation-op/A.R.E.S/pull/1), commit `d061b9a1d4b21845ce1d5fb9aeef52d764e4538f`. Inicialmente se verificó como borrador; una consulta posterior confirmó que el PR #1 ya fue fusionado por el propietario. No contiene código privado, credenciales ni historial de la aplicación.

**Límite externo pendiente:** la nueva consulta real a Google Search volvió a responder HTTP 429 `GEMINI_QUOTA`. El chat normal sí respondió en las comprobaciones. No se declara operativa la búsqueda real hasta una prueba satisfactoria con cuota disponible.

Se corrigió además la apertura de una cita mientras la lista de proyectos todavía carga tras recargar: espera esa inicialización antes de leer el documento. Chrome comprobó la carrera con una respuesta de proyectos demorada intencionalmente. Las pruebas nuevas utilizan `ares_test` y no eliminan conversaciones creadas por el usuario.

Validación de esta continuación: 59 pruebas unitarias backend y 64 frontend aprobadas; integración DDD con Docker y notas de conversación con PostgreSQL aprobadas. Pasaron los 19 recorridos Chrome generales, los 11 persistentes y el de acceso compartido, que rechaza notas/análisis DDD desde una sesión lectora. Tras cambiar la activación a ARES se repitieron los cinco recorridos de voz/avatar; tras corregir la carrera de carga se repitieron los 11 persistentes. Ambas compilaciones pasan. Vite mantiene el aviso de tamaño de los módulos grandes de Monaco/Mermaid/Three, cargados bajo demanda. Se inspeccionó también la presentación móvil sin desbordamiento.

## Preparación de publicación

Licencia MIT elegida por el propietario. La selección incluye fuentes, migraciones, pruebas, documentación, plantilla de entorno sin claves y configuración de CI. Excluye credenciales, respaldos, conversaciones, dependencias instaladas y preparaciones locales. Se revisaron los archivos preparados para Git contra las claves configuradas y patrones de credenciales, sin coincidencias.

Una copia independiente instaló dependencias con `npm ci`, pasó 59 pruebas backend y 64 frontend y compiló ambos proyectos. Arrancó sin claves IA con PostgreSQL temporal en una base vacía; Chrome creó un proyecto desde la interfaz y lo recuperó después de recargar, sin errores ni desbordamiento móvil. Esa comprobación no utiliza datos del usuario.

CI configura unitarias/compilaciones en Windows y Linux, más PostgreSQL, Docker y Chrome en Linux con proveedores simulados y permisos de lectura del repositorio. Su primera ejecución remota debe consultarse en los checks del PR; la configuración por sí sola no acredita un resultado satisfactorio. Publicar el repositorio no despliega la aplicación como servicio público.

## Consola compacta — 27 de octubre de 2026

Primera etapa de simplificación de la experiencia. El chat ocupa el alto disponible: el historial se desplaza dentro de su panel y el campo de mensaje permanece al pie. Voz/conversación, proyecto/historial/memoria y adjuntos/dictado se abren bajo demanda. Los paneles cierran con Escape, su botón, clic fuera o al mover el foco a otro control; el cierre explícito devuelve el foco al desplegable.

La conversación continua conserva un estado visible y botones para interrumpir o desactivar el micrófono al cerrar sus opciones. El dictado puntual se detiene al cerrar Adjuntar y dictar, incluyendo cancelación de una transcripción pendiente. Cerrar estas opciones conserva los resultados de investigación. La salida automática de voz sigue siendo opcional.

El avatar es compacto en móvil, con nombre/estado y botón Ajustar avatar para recuperar controles 3D, animación y compañero flotante. El movimiento reducido conserva su aviso y desactiva los controles correspondientes. En ventanas bajas se prioriza el espacio de conversación. Las otras secciones mantienen su navegación.

La respuesta nueva respeta la lectura de mensajes anteriores y ofrece Volver al último mensaje. La carga de mensajes anteriores conserva su posición. No se añadió una nueva capacidad de IA ni un cambio de proveedor en esta etapa.

Validación: 64 pruebas frontend aprobadas, comprobación de tipos y compilación frontend aprobadas. Se comprobaron por grupos los 23 recorridos Chrome generales (cuatro nuevos), y los 11 recorridos persistentes con PostgreSQL ares_test; incluyen notas de voz, recuperación de historial, memoria, documentos, repositorio y Git. Las pruebas de voz y proveedores usan simulaciones; no se repitió una prueba física de micrófono ni llamadas a los modelos reales. Chrome comprobó entrada/envío dentro de la ventana a 1440 × 1000, 390 × 844, 390 × 600 y 390 × 420. La consola real en 5175 se inspeccionó sin enviar mensajes ni modificar el historial del usuario. Vite conserva el aviso existente sobre módulos grandes cargados bajo demanda.

## Resultados junto al chat — 27 de octubre de 2026

Se integró un panel contextual para abrir respuestas confirmadas, documentos citados y borradores de módulos/Biblioteca. En escritorio comparte el espacio con el chat; en móvil funciona como diálogo con foco contenido y vuelve al control de origen al cerrar. El borrador del chat se conserva al abrir un resultado desde un módulo. Abrirlo no realiza una inferencia adicional.

El panel reutiliza Markdown saneado, Mermaid y Monaco. Ofrece documento, diagramas, bloques de código, comparación y origen. La comparación necesita una base aportada por el usuario o recibida con el resultado; informa si esa base era parcial/redactada. No aplica archivos ni ejecuta los bloques. El origen conserva conversación/mensaje, proyecto, proveedor/modelo, fuentes y, cuando corresponde, documento y revisión. Las citas muestran el documento actual sin reemplazar el fragmento histórico del mensaje.

Guardar nota en Biblioteca reutiliza la ruta de respuestas confirmadas: copia solicitud/respuesta del servidor, conserva atribución y devuelve un borrador sin otra llamada IA. Una nota ya editada o aprobada se recupera por su origen sin sobrescribirla ni duplicarla. La edición y aprobación reutilizan el gestor de documentos y sus controles de revisión. Cerrar conserva la edición en esta pantalla; cambiar de resultado/sección exige guardar o cancelar. No persiste una edición pendiente al recargar.

Usar en mensaje incorpora el contenido y la referencia al borrador, sin enviarlo, conservando el texto existente. Rechaza exceso de longitud y contexto de otro proyecto. La sesión lectora no ofrece estas acciones ni edición. El panel enlaza explícitamente a Biblioteca para continuar con la sincronización revisable del repositorio existente.

Validación: 59 pruebas backend y 73 frontend aprobadas; compilaciones y tipos de ambos proyectos aprobados. Pasaron 25 recorridos Chrome generales, 12 persistentes con PostgreSQL ares_test y uno de acceso compartido, además de la prueba SQL de notas, ampliada para recuperar una nota editada. Las nuevas comprobaciones cubren Mermaid, Monaco, incorporación al borrador sin otra generación, límites/proyecto, lectura tardía descartada, edición pendiente, cancelación y reapertura tras editar/aprobar sin duplicar. Proveedores y voz se simulan; los datos SQL de prueba están separados de los del usuario. Se observaron escritorio/móvil y ausencia de desbordamiento con servicios interceptados sobre 5175. Vite mantiene el aviso de módulos grandes cargados bajo demanda.

Esta entrega cubre la revisión contextual de resultados. La continuación de lectura remota se registra a continuación.

## Lectura pública GitHub con evidencia — 27 de octubre de 2026

La consola incorpora **Leer GitHub** como diálogo bajo demanda. Admite URL HTTPS exacta de un repositorio público y una rama, etiqueta o commit opcional. La inspección resuelve la revisión a un commit y árbol inmutables antes de listar archivos; una URL sola no inicia una lectura ni una inferencia. No usa tokens GitHub ni credenciales de GitHub CLI, no clona y no ejecuta código.

La selección es explícita: hasta ocho archivos UTF-8, 64 KiB por archivo y 96 KiB combinados. El inventario indica exclusiones, búsqueda y paginación; los límites del árbol o la marca truncated producen inventario parcial con total desconocido. Cada descarga se realiza por SHA de blob, comprueba tamaño y huella Git y calcula SHA-256. Los fallos se muestran por archivo. El contenido con secretos reconocidos se entrega redactado y se identifica como tal; el SHA-256 corresponde al original. No se presenta como una revisión completa del repositorio.

Analizar con OpenRouter es una acción separada y explícita. Usa el modelo de programación configurado y el contador de consumo existente, solo con archivos confirmados y su manifiesto. El informe muestra primero alcance confirmado por la herramienta y después análisis generado por IA, con instrucciones de separar evidencia, inferencias y propuestas DDD + Hexagonal. No acredita ejecución ni resultados de pruebas. Las lecturas son privadas por actor, caducan a los 15 minutos, tienen límites de cantidad/memoria, descarga y tiempo, admiten cancelación y rechazan selecciones antiguas. Reintentar un análisis confirmado con el mismo identificador reutiliza el resultado.

El resultado se abre junto al chat con fuentes fijadas al commit. Puede descargarse o incorporarse completo al borrador, respetando proyecto y longitud. Guardar informe en Biblioteca persiste el borrador, fuentes y registro de alcance sin otra generación. La revisión humana puede editar el texto y título; el contexto original se conserva y se incluye al discutirlo desde Biblioteca. Los roles lectores no disponen de las acciones de generación o guardado; se mantiene la protección del servidor.

Validación: 68 pruebas backend y 74 frontend aprobadas; tipos y compilaciones de ambos proyectos aprobados. Pasaron los 27 recorridos generales de Chrome. Los 12 recorridos persistentes anteriores pasaron; el nuevo recorrido GitHub pasó tras corregir dos omisiones de navegación del propio test (abrir Biblioteca y seleccionar el documento después de recargar). La prueba SQL específica también pasó con ares_test: informe, fuentes, guardado idempotente y reapertura de una edición con título cambiado. Se comprobaron escritorio/móvil, cobertura de cinco archivos elegidos entre 100 rutas, límites antes de descarga, árbol parcial, 404/cuota, integridad, redacción, caducidad, separación por actor y cancelación. Los análisis automatizados usan un modelo simulado; no se envió código del usuario a un proveedor de IA para estas pruebas. Vite mantiene el aviso existente de tamaño de módulos.

Comprobación real por la nueva API contra AI-Innovation-op/ARES: commit `93ce76b58c164c7bfff265c910cd7e2c4f6006f5`, 127 rutas listadas, inventario completo; se eligieron y leyeron únicamente README.md (24 191 bytes) y backend/src/app.ts (9 638 bytes), sin fallos ni llamada al modelo. Esta comprobación valida el transporte público y las huellas, no constituye una nueva auditoría de la beta. Chrome abrió también el diálogo en la consola real 5175 sin errores de ejecución ni envío de mensajes. El historial del usuario se conserva.

El recorrido de acceso compartido también pasó: el rol lector no ve el botón de ingesta y el servidor rechaza inspección, lectura, análisis y guardado desde esa sesión.

Límites de esta etapa: repositorios públicos y muestras seleccionadas, sin ingesta completa, repositorios privados, búsqueda semántica remota ni ejecución de pruebas GitHub. No se repitieron pruebas físicas de micrófono ni llamadas reales a los modelos. Los cambios de esta continuación permanecen locales.
