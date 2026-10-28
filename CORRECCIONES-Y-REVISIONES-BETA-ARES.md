# Correcciones, mejoras y revisiones de A.R.E.S. beta

**Fecha:** 27 de octubre de 2026, Lima.

**Repositorio:** [AI-Innovation-op/ARES](https://github.com/AI-Innovation-op/ARES).

**Base examinada:** v3.0.0, commit [`5aff5b5`](https://github.com/AI-Innovation-op/ARES/tree/5aff5b54ccbef79489cbdc5919aa7287092f629a).

**Estado:** lista de trabajo pendiente. Este documento no implementa correcciones.

## Propósito y límites

Este documento reúne los problemas, riesgos y mejoras identificados en las dos revisiones de la beta. Está pensado para convertirlos en tareas de desarrollo y comprobar después si quedaron resueltos. Es independiente del plan de evolución de la otra versión de A.R.E.S.

«Todo» significa aquí **todos los hallazgos identificados y las revisiones pendientes documentadas**, no una garantía de haber encontrado cada error del repositorio. Si el código cambia después del commit indicado, hay que comprobar qué hallazgos siguen vigentes.

La beta pasó comprobación de tipos de frontend/backend y compilación frontend. Su dictado, modal GitHub, modos y exportación sí tienen implementación. No corresponde describirlos como inexistentes; corresponde corregir sus límites y comprobar los flujos completos.

### Cómo leer las tareas

| Marca | Significado |
| --- | --- |
| **O — Observado** | Visto en navegador o en una lectura real de datos públicos |
| **C — Controlado** | Reproducido ejecutando el código con datos, eventos o red simulados |
| **E — Estático** | Deducido del código; no ejecutado de extremo a extremo |
| **R — Revisar** | Comprobación o mejora propuesta; no implica un fallo demostrado |

| Prioridad | Cuándo atenderla |
| --- | --- |
| **P0** | Antes de exponer servicios sensibles o ejecutar código no confiable en un despliegue compartido. La urgencia depende de esa exposición |
| **P1** | Antes de presentar la función afectada como fiable o completa |
| **P2** | Para consolidar experiencia, mantenimiento y entrega |
| **P3** | Evolución posterior, sin prometerla como capacidad actual |

Todas las casillas están abiertas. Cerrarlas requiere evidencia de la corrección, no únicamente una modificación de código o una respuesta del modelo.

## A. Vista previa, proyectos y ZIP

Fuentes: [compilador de previews](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/preview-compiler.service.ts), [visor](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/common/LivePreviewModal.vue), [ZIP](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/zip.service.ts).

### A01 — Eliminar la sustitución silenciosa del proyecto por plantillas

**P1 · C/E · `preview-compiler.service.ts`**

- [ ] **Problema:** las palabras café/coffee/espresso/auth/jwt/token pueden activar plantillas que reciben solo el título, no los archivos. Dos archivos de café con precios 17 y 999 produjeron el mismo HTML. Un archivo de tokens de diseño activó la plantilla auth.
- **Corrección:** generar la vista previa a partir del artefacto concreto. Separar las demostraciones de café/auth en una galería explícita, sin activarlas por coincidencias vagas.
- **Aceptación:** cambiar una regla o precio visible cambia la ejecución; los tokens de diseño no abren una pantalla de login. Un formato no soportado muestra su límite, no otra aplicación.

### A02 — Sustituir el ensamblador Vue por compilación real

**P1 · C/E · `preview-compiler.service.ts`**

- [ ] **Problema:** el procesamiento con expresiones regulares elimina `export default` antes de comprobarlo. Un componente Options API mínimo produjo `Unexpected token '{'`. El camino nuevo dejó de recorrer subcomponentes y scripts de dominio como el anterior.
- **Corrección:** usar el compilador apropiado para SFC/TypeScript y resolver explícitamente módulos/dependencias dentro del alcance soportado. No ampliar indefinidamente las expresiones regulares.
- **Aceptación:** ejemplos Options API, `<script setup>`, componentes importados, estilos e imports de dominio compilan y funcionan. Errores reales se muestran con archivo y causa; no se ocultan tras una demo.

### A03 — Aislar el código ejecutado en previews

**P0 condicionado a ejecución de código no confiable · E · `LivePreviewModal.vue`, `ChatMessage.vue`**

- [ ] **Problema:** `srcdoc` combina `allow-scripts` y `allow-same-origin`; también habilita formularios/modales. No es una frontera adecuada para ejecutar contenido no confiable en el origen de la consola.
- **Corrección:** diseñar aislamiento por origen o contexto opaco, permisos mínimos, política de red y ausencia de credenciales de A.R.E.S. No asumir que quitar un atributo resuelve todas las capacidades del entorno.
- **Aceptación:** pruebas confirman que el preview no lee/modifica DOM, almacenamiento ni sesión de la consola; no realiza peticiones no autorizadas ni abre capacidades no habilitadas.
- **Límite de evidencia:** no se ejecutó una explotación. [Referencia de MDN sobre sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).

### A04 — Validar y limitar mensajes y logs del preview

**P1 · E · `LivePreviewModal.vue`, `preview-compiler.service.ts`**

- [ ] **Problema:** el receptor acepta mensajes de logs por su estructura sin validar la ventana emisora. El emisor reenvía el historial acumulado.
- **Corrección:** validar `event.source`, el origen cuando corresponda, un canal de sesión y el esquema del mensaje. Limitar cantidad/tamaño de logs y enviar incrementos. Para origen opaco, no confiar solo en que `origin` sea `null`.
- **Aceptación:** mensajes ajenos se ignoran; una ráfaga de logs no hace crecer memoria sin límite; recargar/detener invalida el canal anterior.

### A05 — Corregir las afirmaciones de autenticación en la demo JWT

**P1 · E · `sintetizarAuthJwtApp`**

- [ ] **Problema:** aunque el encabezado dice «Live Demo», el botón anuncia JWT firmado y la UI sesión autenticada. La firma es ficticia y no se valida la contraseña.
- **Corrección:** identificar claramente «simulación, sin autenticación real». Si se pretende probar autenticación, ejecutar y verificar el backend real del proyecto, sin usar secretos de producción.
- **Aceptación:** una demostración nunca acredita login ni firma válida; en una implementación real, contraseña incorrecta y token manipulado son rechazados por el servidor.

### A06 — Garantizar correspondencia entre preview, archivos y ZIP

**P1 · C/E/R · `ProjectZipForge.vue`, `zip.service.ts`**

- [ ] **Problema:** la sustitución de previews permite que el ZIP contenga un proyecto distinto al que se ve. Inyectar archivos de scaffold no demuestra que el paquete sea «100% funcional».
- **Corrección:** usar un manifiesto común con rutas, revisión y huellas; identificar archivos generados automáticamente y estado de validación. Revisar rechazo de `..`, rutas absolutas, duplicados, tamaños excesivos y secretos antes de empaquetar.
- **Aceptación:** extraer el ZIP reproduce los archivos revisados; sus huellas corresponden a la versión ejecutada. Se informa qué comando se comprobó y qué sigue sin comprobar.

## B. Voz, audio y conversación

Fuentes: [servicio de voz](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/voice.service.ts), [visualizador](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/hud/AudioWaveformVisualizer.vue), [terminal](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/hud/TacticalTerminal.vue).

### B01 — Acumular correctamente los segmentos de voz

**P1 · C · `VoiceService.onresult`**

- [ ] **Problema:** los resultados nuevos reemplazan la transcripción anterior. «Revisa el dominio de pedidos» seguido de «y genera un ADR» quedó solo en la segunda frase.
- **Corrección:** conservar segmentos finales por turno y mantener los provisionales aparte; reiniciar únicamente al enviar o cancelar el turno correspondiente.
- **Aceptación:** varias frases/pause/reanudación forman un único mensaje completo, sin duplicación ni pérdida.

### B02 — No despachar resultados provisionales

**P1 · C · `VoiceService.onresult`**

- [ ] **Problema:** una transcripción provisional con «ARES enviar» desencadenó el envío antes de confirmarse.
- **Corrección:** evaluar la intención de finalizar sobre resultados finales, con estado de turno e idempotencia. Separar hablar sobre una orden de ejecutarla.
- **Aceptación:** una hipótesis provisional revisada por el navegador no envía nada; repetir un evento final no duplica el mensaje.

### B03 — Normalizar puntuación y definir un protocolo de conversación

**P1 · C/R · `voice.service.ts`**

- [ ] **Problema:** «Analiza inventario, enviar orden.» no activó esa variante por el punto final. La beta no implementa el protocolo ARES/okey solicitado para la experiencia definitiva.
- **Corrección:** normalizar puntuación y variantes de reconocimiento sin borrar contenido útil. Si se adopta el requisito del usuario, distinguir espera de «ARES», captura de turno y cierre con «okey»; documentar comandos alternativos.
- **Aceptación:** pruebas de punto/coma, mayúsculas, pausas, palabra de cierre y frases que mencionan esos términos sin dar una orden. La transcripción sigue siendo editable.

### B04 — Liberar recursos en errores, cancelación y salida

**P1 · C/E · `voice.service.ts`**

- [ ] **Problema:** error de red seguido de `onend` dejó estado inactivo sin detener el track independiente del analizador. El stop explícito sí lo libera.
- **Corrección:** centralizar limpieza de reconocimiento, tracks, AudioContext y frames; cubrir fallo de permisos, arranque incompleto, navegación y pestaña oculta. Proteger contra un `getUserMedia` que resuelva después de cancelar.
- **Aceptación:** cada ruta termina sin micrófono, bucle o contexto sobrante; un recurso que llega tarde se descarta y libera.

### B05 — Resolver la carrera del visualizador de audio

**P1 · C · `iniciarAnalizadorAudio`**

- [ ] **Problema:** si el primer frame ocurre antes de `recognition.onstart`, el bucle sale sin programar el siguiente.
- **Corrección:** iniciar el bucle cuando el estado esté preparado o coordinar explícitamente analizador y reconocimiento; evitar bucles duplicados al reiniciar.
- **Aceptación:** orden de eventos temprano/tardío produce barras activas cuando hay audio y cero actividad después de detener. Las pruebas deben cubrir ambos órdenes.

### B06 — Hacer idempotentes los comandos de voz

**P1 · E · `TacticalTerminal.vue`**

- [ ] **Problema:** `voice off` cuando ya está inactivo puede caer en la rama que alterna el estado e iniciar escucha.
- **Corrección:** distinguir `on`, `off` y `toggle`; activar/desactivar no debe invertir el resultado deseado ni anunciar éxito antes de confirmarlo.
- **Aceptación:** repetir `off` nunca inicia captura y repetir `on` no abre dos sesiones. Permiso denegado no produce «activado».

### B07 — Coordinar TTS, escucha e interrupciones

**P1 · E/R · voz, TTS y store de chat**

- [ ] **Problema:** no se encontró coordinación equivalente entre salida hablada y captura; riesgo de autoescucha. No se probó este efecto con micrófono físico.
- **Corrección:** máquina de estados única para escuchar/transcribir/responder/hablar/pausar/error; detener o pausar captura durante TTS según el comportamiento elegido. Añadir controles de interrupción y selección española fiable.
- **Aceptación:** el asistente no se envía su propia voz; cancelar conserva el estado correcto. Después de tests simulados, realizar prueba física de micrófono/altavoz y documentar navegador, voz y resultado.

## C. GitHub, auditoría y continuidad del contexto

Fuentes: [ingesta](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/github-audit.service.ts), [modal](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/audit/GithubAuditModal.vue), [chat](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/chat.service.ts).

### C01 — Mostrar cobertura real de la auditoría

**P1 · O/C/E**

- [ ] **Problema:** al revisar la propia beta se encontraron 111 rutas, pero se leyeron solo cinco manifiestos/documentos; no se leyeron sus servicios TypeScript. La UI presenta el total como «archivos analizados».
- **Corrección:** separar rutas encontradas, archivos descargados, fragmentos incorporados, archivos realmente analizados y comprobaciones ejecutadas.
- **Aceptación:** «111 rutas / 5 archivos leídos» aparece con la lista exacta, recortes y omisiones. No se afirma análisis del código que no se leyó.

### C02 — Elegir archivos relevantes y fijar una revisión

**P1 · E/R**

- [ ] **Problema:** se toman los primeros cinco nombres coincidentes, hasta 4000 caracteres cada uno, primeras 60 rutas en el prompt y 100 en la respuesta. Se usa una rama mutable y no se comunica `truncated` del árbol.
- **Corrección:** fijar SHA para todas las lecturas, seleccionar por alcance y relevancia, permitir selección del usuario, informar recortes y árbol incompleto. No es necesario descargar todo el repositorio para resolverlo.
- **Aceptación:** repositorio grande/monorepo y rama que cambia no mezclan revisiones. Una selección limitada conserva fuentes suficientes y declara sus límites.

### C03 — Acotar peticiones y validar URLs completas

**P1 · E/R**

- [ ] **Problema:** no hay timeout/cancelación en los `fetch` revisados; el texto se recorta después de descargarlo completo. La regex encuentra GitHub dentro de un texto, sin validar la URL completa.
- **Corrección:** validar esquema/hostname y owner/repo, manejar redirecciones explícitamente, establecer límites de bytes, tiempo y concurrencia, cancelar trabajo abandonado y tratar 403/404/cuota sin ocultarlos.
- **Aceptación:** respuestas gigantes, lentas, fallidas y URLs inválidas se rechazan de forma controlada. Las peticiones actuales usan hosts fijos: este hallazgo no demuestra SSRF arbitrario.

### C04 — Transmitir el informe al discutirlo

**P1 · C/E · `GithubAuditModal.vue`**

- [ ] **Problema:** «Discutir en Consola» manda una frase con la URL, pero no el informe ni un ID recuperable. Se confirmó con marcador sintético ausente de la petición.
- **Corrección:** persistir informe, revisión y fuentes; pasar su ID al chat y recuperarlo con autorización, o adjuntar el contexto explícito dentro de límites.
- **Aceptación:** la conversación puede citar el hallazgo concreto mostrado en el modal, incluso después de recargar; no lo reconstruye adivinando desde la URL.

### C05 — Conectar correctamente URL en chat y resultado de terminal

**P1 · E**

- [ ] **Problema:** pegar URL solo agrega una directiva textual. `audit <url>` desde terminal abre después un modal que no recibe el resultado obtenido.
- **Corrección:** decidir si la URL inicia una lectura o solo prepara una propuesta, y explicarlo. Compartir un mismo objeto/ID de auditoría entre terminal, modal y conversación.
- **Aceptación:** no se afirma lectura por detectar una URL; el modal de una auditoría terminada abre ese informe sin repetir llamadas ni quedar vacío.

### C06 — Respetar el proveedor elegido y mostrar el efectivo

**P1 · E · ingesta, modal y `llm.service.ts`**

- [ ] **Problema:** la auditoría GitHub no transmite proveedor/modelo del chat y usa el predeterminado del backend. Auditoría de código/documentación también deben revisarse por sus llamadas directas a Gemini.
- **Corrección:** contrato explícito de selección por tarea, catálogo validado y proveedor/modelo efectivos guardados en el resultado; explicar los cambios por fallback.
- **Aceptación:** el usuario sabe qué proveedor recibirá el contenido y cuál lo procesó. Modelo no disponible o falta de clave producen un error claro, no una suposición de disponibilidad.

### C07 — Retirar puntuaciones y garantías no acreditadas

**P1 · E · prompts de auditoría, métricas y README**

- [ ] **Problema:** Big-O/SOLID/seguridad/score vienen del modelo; el prompt de código exige una transición a «BLINDADA». La muestra GitHub no permite acreditar una auditoría profunda.
- **Corrección:** etiquetar estimaciones, distinguir inferencia de herramienta ejecutada y permitir «no evaluable». Eliminar resultados positivos obligatorios del prompt. Citar archivo/línea/revisión donde sea posible.
- **Aceptación:** sin código o ejecución suficiente, se expresa el límite. Ninguna respuesta convierte una puntuación generada en certificación de seguridad o rendimiento.

## D. Seguridad de aplicación y exposición

Fuentes: [app.ts](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/app.ts), [Mermaid](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/common/MermaidViewer.vue), [herramientas](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/tools.service.ts).

### D01 — Proteger endpoints antes de compartirlos

**P0 condicionado a exposición · E/R**

- [ ] **Problema:** en las rutas revisadas no hay autenticación, autorización por recurso ni límites de consumo equivalentes. El endpoint GitHub usa un token opcional del servidor.
- **Corrección:** definir modo local/compartido, autenticar y autorizar cada proyecto/recurso, limitar consumo y concurrencia y revisar permisos de tokens. Un token privado no debe convertirse en acceso compartido implícito para cualquier llamante.
- **Aceptación:** usuario sin permiso no lee informes/repositorios ajenos ni consume proveedores. Probar con datos sintéticos y credenciales de prueba. No se comprobó que el despliegue público carezca de protecciones externas.

### D02 — Validar entradas y tratar archivos como datos no confiables

**P1 · E/R**

- [ ] **Problema:** algunas rutas hacen comprobaciones mínimas; tipos TypeScript no validan cuerpos HTTP. Documentos/repositorios pueden contener instrucciones y secretos.
- **Corrección:** esquemas de runtime para cuerpos, herramientas, modelos y modos; límites de contenido y mensajes; separar instrucciones del sistema de datos leídos. Revisar redacción de secretos antes de enviar al proveedor.
- **Aceptación:** entradas malformadas o demasiado grandes fallan con 4xx controlado. Instrucciones dentro de README/archivos no autorizan acciones ni acceso adicional.

### D03 — Endurecer renderizado y comunicación entre ventanas

**P1 · E/R**

- [ ] **Problema:** Mermaid usa `securityLevel: loose`; Markdown y SVG generados deben tratarse como contenido no confiable.
- **Corrección:** política de renderizado restrictiva, saneamiento del SVG y revisión de enlaces, HTML, configuraciones inyectadas y exportación. Auditar límites de diagramas y carreras de renderizado.
- **Aceptación:** diagramas maliciosos o excesivos no ejecutan código ni bloquean la UI; errores sintácticos son visibles sin romper el chat. No se afirma explotación demostrada.

### D04 — Revisar CORS, logs y configuración de despliegue

**P1 · E/R**

- [ ] **Problema:** el blueprint configura CORS abierto y el servicio de herramientas registra argumentos. Hay URLs/rutas de entorno fijadas en código y configuración.
- **Corrección:** restringir orígenes según despliegue, recordar que CORS no es autenticación, redactar logs, centralizar URLs/rutas y documentar variables. Revisar secretos en artefactos y logs sin exponerlos durante la comprobación.
- **Aceptación:** despliegue local y remoto usan configuración explícita; logs no contienen claves ni contenidos sensibles completos. No activar registros de argumentos para diagnosticar indiscriminadamente.

## E. Persistencia, recuperación y estados reales

Fuentes: [db.ts](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/config/db.ts), [Render](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/render.yaml), [chat store](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/stores/chat.store.ts).

### E01 — No cambiar de base ante cualquier error SQL

**P1 · E · `config/db.ts`**

- [ ] **Problema:** cualquier error capturado de PostgreSQL puede cambiar globalmente a SQLite. Una consulta incorrecta no debería provocar cambio de fuente de verdad.
- **Corrección:** elegir motor explícitamente; distinguir indisponibilidad, restricciones y errores de consulta. Si se ofrece fallback, diseñar consistencia/recuperación y hacerlo visible, sin asumir sincronización inexistente.
- **Aceptación:** error SQL no cambia motor; desconexión no crea dos historiales silenciosos. No se ha demostrado pérdida de datos, pero esta ruta necesita pruebas.

### E02 — Comprobar durabilidad y restauración

**P1 · E/R · despliegue y base de datos**

- [ ] **Problema:** el blueprint revisado no declara disco persistente para SQLite. La durabilidad del despliegue real no fue acreditada.
- **Corrección:** verificar almacenamiento persistente, migraciones, respaldos y restauración. No basta con tener un archivo SQLite dentro de un contenedor.
- **Aceptación:** reiniciar/recrear el servicio conserva datos según la configuración; restaurar una copia en un entorno separado recupera estructura y contenido, sin sobrescribir producción para probar.

### E03 — Corregir ONLINE y salud del sistema

**P1 · O/E · HUD, health y terminal**

- [ ] **Problema:** ONLINE aparece fijo incluso con peticiones bloqueadas; health no acredita cada dependencia.
- **Corrección:** distinguir frontend disponible, backend accesible, base lista y proveedor configurado/disponible. No realizar llamadas de pago en cada comprobación de salud.
- **Aceptación:** estados desconectado/degradado/desconocido son reproducibles; configurar una clave no se presenta como inferencia verificada.

### E04 — Revisar streaming, reintentos y persistencia de turnos

**P1 · R · chat/API/repositorios**

- [ ] **Pendiente de comprobar:** cancelación real, cierre de streams, reconexión, duplicación por fallback SSE→POST, orden concurrente y persistencia parcial. No se declara que todos estos fallos existan.
- **Trabajo:** diseñar ID idempotente de turno, estados parcial/confirmado/error/cancelado y transacciones adecuadas; probar fallo antes/después de guardar y desconexión del cliente.
- **Aceptación:** reintentar no duplica mensajes ni costes evitables; respuesta parcial no se presenta como confirmada; cancelación libera recursos y conserva el estado recuperable.

## F. Interfaz, accesibilidad y comportamiento cotidiano

Fuentes: [AppShell](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/layout/AppShell.vue), [ChatInput](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/chat/ChatInput.vue), [ChatConsole](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/chat/ChatConsole.vue).

### F01 — Resolver recortes y entrada estrecha en móvil

**P1 · O**

- [ ] **Problema:** a 390 × 844 el selector llega hasta x=474 y más controles quedan fuera; la entrada tiene unos 66 px de ancho. `overflow: hidden` disimula el problema.
- **Corrección:** agrupar adjuntos/acciones secundarias en menú, adaptar cabecera, conservar entrada persistente y espacio suficiente para texto; hacer accesibles los modos ocultos en móvil.
- **Aceptación:** controles visibles y operables a 390 px, con teclado móvil y ampliación de texto. No basta con comprobar ausencia de scroll horizontal.

### F02 — Resolver módulos y navegación desconectados

**P1 · E**

- [ ] **Problema:** AppShell no monta los módulos DocShield/CodeSword/Architect aunque el store deriva contenido hacia sus buffers/pestañas.
- **Corrección:** conectar una navegación accesible y los resultados correspondientes, o retirar código/afirmaciones de módulos que ya no formen parte del producto. Mantener ocultos los controles internos de poses para el uso cotidiano.
- **Aceptación:** generar un artefacto abre su destino real; ninguna acción cambia un estado de pestaña que el usuario no puede ver. La ficha técnica, ZIP, preview y GitHub ya conectados deben conservarse.

### F03 — Adjuntar sin destruir el borrador y comunicar límites

**P1 · O/E/R**

- [ ] **Problema:** seleccionar código reemplaza el texto existente y corta a 10 000 caracteres sin avisar. README anuncia arrastre que no se encontró implementado.
- **Corrección:** adjunto separado y removible, límite antes de leer, vista previa y aviso de recorte. Implementar arrastre o corregir la documentación; mantener redacción y permisos de archivos.
- **Aceptación:** un borrador no se pierde; el usuario sabe qué contenido se enviará. Archivo inválido/grande produce mensaje claro, sin envío automático.

### F04 — Definir exportación y alcance del historial

**P2 · O/E/R**

- [ ] **Problema:** exportar funciona, pero usa el store cargado y no acredita todo el historial persistido ni el estado confirmado de cada mensaje.
- **Corrección:** ofrecer «lo cargado» o «conversación completa» de manera explícita; incluir proveedor, revisión, fechas y estados pertinentes; revisar redacción de datos sensibles.
- **Aceptación:** exportación larga/paginada no omite contenido silenciosamente ni etiqueta fragmentos fallidos como respuestas completas.

### F05 — Accesibilidad, contraste, animación y lectura

**P2 · R**

- [ ] **Revisión pendiente:** foco y cierre de modales, Escape, etiquetas de iconos, lector de pantalla, tamaños de texto, contraste, teclado, scroll durante streaming y movimiento reducido.
- **Mejora:** mantener identidad visual con menos ruido; avatar/efectos opcionales y pausables, sin bloquear escritura o lectura. No añadir permanentemente todas las funciones a la cabecera.
- **Aceptación:** recorrido completo por teclado; foco vuelve al control de origen; el streaming no arrastra la lectura anterior; animaciones respetan preferencias y se detienen cuando no son visibles.

### F06 — Revisar poses y protocolo Bio

**P2 · E/R**

- [ ] **Problema/límite:** 16 estados declarados se agrupan en menos variantes visuales; hidratación/estamina se calculan por fórmulas, no sensores. Hooks nocturnos usan esas estimaciones.
- **Corrección:** validar correspondencia estado/expresión, transiciones y fallback gráfico. Presentar Bio como recordatorios o gamificación opcional; no como medición corporal ni motivo automático para impedir trabajar.
- **Aceptación:** cada estado relevante tiene respuesta comprensible; no se afirma fatiga medida. Usuario puede pausar/desactivar avisos y movimiento sin perder funciones de ingeniería.

## G. Arquitectura, contratos y alcance del asistente

### G01 — Ajustar arquitectura y afirmaciones sobre DDD

**P2 · E/R**

- [ ] **Problema:** carpetas horizontales de controladores/servicios/repositorios no demuestran hexagonal estricta; el prompt y las demos no acreditan reglas de dominio.
- **Corrección:** definir límites del negocio, casos de uso y puertos/adaptadores donde aporten valor; separar UI de servicios como voz, actualmente acoplada al store. Evitar una reescritura global sin beneficio comprobable.
- **Aceptación:** una regla como «no confirmar pedido vacío» se prueba fuera de HTTP/UI/SQL y se integra después. Los imports y contratos respetan los límites definidos.

### G02 — Distinguir modos, herramientas y autonomía

**P1 · E/R**

- [ ] **Problema:** los modos cambian instrucciones, no crean agentes independientes. La terminal web controla acciones internas; no es una shell general. README contiene afirmaciones más amplias que la evidencia.
- **Corrección:** describir capacidades reales, diferenciar proponer/ejecutar/verificar y exigir resultados explícitos antes de afirmar acceso a archivos, memoria o servicios externos. No conceder permisos adicionales por elegir modo rápido.
- **Aceptación:** el asistente explica en español qué recibió, qué infirió, qué ejecutó y qué no pudo comprobar. No inventa acceso a correo/calendario/domótica ni éxito de pruebas.

### G03 — Verificar CLI/MCP y memoria antes de ampliarlos

**P2/P3 · E/R**

- [ ] **Pendiente:** CLI/MCP existen, pero no se ejecutaron en esta revisión. La existencia de tablas de embeddings tampoco demuestra RAG operativo.
- **Trabajo:** contratos compartidos con la API, autorización por proyecto, rutas configurables, cancelación y errores; comprobar lecturas/escrituras del CLI y permisos de MCP. Si se ofrece RAG, implementar y probar indexación, recuperación, citas y actualización.
- **Aceptación:** ningún canal elude controles. Memoria recupera una fuente concreta y deja de citarla después de invalidarla; de lo contrario, documentar que solo existe historial, no RAG comprobado.

## H. Pruebas, rendimiento, release y documentación

### H01 — Añadir CI determinista y separar Sentinel

**P1 · O/E/R**

- [ ] **Problema:** no apareció suite nueva equivalente en el diff; la consulta de runs devolvió vacío. Sentinel pide una revisión al modelo, lo que no acredita compilación ni pruebas.
- **Corrección:** CI sin claves de producción para tipos, build, unidades, integración y recorridos críticos. Sentinel opcional, con permisos mínimos y errores visibles; revisar forks, contenido de PR y consumo antes de publicar comentarios.
- **Aceptación:** un fallo real hace fallar el check correspondiente. Un comentario «aprobado» del modelo no cambia el resultado de las pruebas. No confundir «sin runs consultados» con «jamás hubo pruebas manuales».

### H02 — Incorporar regresiones de esta revisión

**P1 · C/R**

- [ ] **Trabajo:** convertir los casos reproducidos en pruebas mantenidas: precio 17/999, tokens de diseño, Options API, segmentos de voz, provisional, puntuación, frame temprano, error/limpieza, cobertura GitHub y traspaso de informe.
- **Aceptación:** cada prueba falla con el comportamiento defectuoso y pasa con la corrección; comprueba un resultado observable, no detalles internos sin valor. Añadir UI móvil y aislamiento de preview.

### H03 — Medir y optimizar con una línea base

**P2 · O/R**

- [ ] **Hallazgo:** build principal cercano a 1526 kB minificado / 411 kB gzip; advertencia de chunks grandes. Esto no demuestra por sí solo lentitud.
- **Trabajo:** medir carga, tareas largas, memoria, avatar y conversación extensa en hardware/red definidos; evaluar carga diferida de Mermaid, preview y vistas secundarias, límites de logs e historial.
- **Aceptación:** comparar antes/después con el mismo escenario; sin pérdidas de funciones o accesibilidad por reducir tamaño.

### H04 — Unificar versiones y actualizar promesas

**P2 · O/E**

- [ ] **Problema:** release/package.json 3.0.0 conviven con título 2.8, health 2.9 y otros textos/lockfiles antiguos. Se anuncian garantías como «100% funcional», auditoría profunda y arquitectura estricta sin validación suficiente.
- **Corrección:** fuente de versión coherente y documentación por estado real; actualizar README, changelog, ficha, comandos, exportadores y guía de despliegue. No tratar un bump de versión como terminación de una función.
- **Aceptación:** instalación limpia coincide con la versión anunciada; cada capacidad tiene ejemplo reproducible, límites y comprobación asociada.

## Orden recomendado de ejecución

| Lote | Tareas | Resultado esperado |
| --- | --- | --- |
| 1. Contención y honestidad | A03–A05, D01–D04, A01, C01/C07, E03, G02 | No ejecutar/exponer sin controles ni presentar demos/inferencias como resultados reales |
| 2. Funciones que hoy se rompen | A02, B01–B07, C04–C06, F02/F03 | Conversación y herramientas conservan intención, contenido y resultados |
| 3. Datos y reproducibilidad | A06, C02/C03, E01–E04 | Revisiones coherentes, límites, persistencia y recuperación comprobables |
| 4. Experiencia de uso | F01, F04–F06 | Pantalla móvil usable, navegación y controles accesibles |
| 5. Consolidación | G01/G03, H03/H04 | Arquitectura y documentación ajustadas a capacidades reales |
| Transversal desde el inicio | H01/H02 | Cada arreglo deja una regresión automatizada pertinente |

Dentro del primer lote, la prioridad P0 aplica si existe exposición o ejecución de contenido no confiable. No presupone que se haya comprobado una explotación o acceso indebido en el despliegue real.

## Criterio para dar una tarea por cerrada

1. Identificar el commit donde se corrige y los archivos afectados.
2. Registrar qué comportamiento cambió y por qué.
3. Adjuntar la comprobación pertinente y su resultado real.
4. Distinguir pruebas simuladas, lectura estática y pruebas físicas/externas.
5. Actualizar la documentación y las limitaciones que sigan presentes.

No cerrar por «compila», «el modelo dice que funciona» o «se ve bien» si el problema es de datos, seguridad, voz o reglas de negocio. Conservar especialmente la diferencia entre **generado**, **ejecutado**, **probado** y **aplicado**.

## Evidencias disponibles

- [Informe comparativo que origina esta lista](/D:/ares-bot/INFORME-COMPARATIVO-Y-PLAN-ARES.md).
- [Resultados de probes controlados](/D:/ares-bot/.local-setup/review-v3-probes.json).
- [Recorrido UI y peticiones interceptadas](/D:/ares-bot/.local-setup/review-v3-browser.json).
- [Lectura pública real de GitHub, sin LLM](/D:/ares-bot/.local-setup/review-v3-github-read.json).

Las evidencias locales no fueron publicadas. Si este documento se comparte, esas rutas requerirán adjuntar los resultados o trasladarlos a un lugar autorizado. No incluir claves, historiales privados o capturas sensibles al preparar esos adjuntos.
