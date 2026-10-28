# A.R.E.S. 1.0.0 — revisión local antes de publicar

27 de octubre de 2026. Implementación local del plan de `INFORME-COMPARATIVO-Y-PLAN-ARES.md`. **No se hizo push, commit, PR ni despliegue en esta continuación.** La publicación anterior del ejemplo sintético no contiene estos cambios.

**Actualización de autorización:** después de esta revisión, Kevin aprobó el resultado y solicitó el push. Las evidencias siguientes describen el estado previo a publicarlo; consulta [GitHub Actions](https://github.com/AI-Innovation-op/A.R.E.S/actions/workflows/ci.yml) para el resultado remoto del commit. La autorización de push no supone un despliegue público.

## Resultado para revisar

**Ampliación del 27 de octubre: beta 4.0 y terminal propia.** La revisión fijó `AI-Innovation-op/ARES` en 614bee1; cambian dos commits/dieciocho archivos respecto de 3.9. El [informe de esta actualización](REFERENCIA-BETA-V4.md) reconoce la REPL y el wizard nuevos y distingue sus límites de los servicios centrales que no cambiaron. Las capturas históricas conservan sus etiquetas originales.

Nuestra terminal interactiva ya usa la API existente: arranque con verificación de servicio, SSE, proveedor por tarea, cancelación, recuperación idempotente, historial por proyecto, archivo/auditoría, análisis DDD, ejecución revisada por huella y preview/ZIP. Pasaron **98 pruebas backend y compilación**. La prueba integrada adicional lanzó el proceso real y atravesó HTTP/PostgreSQL, tres pruebas Docker, compilador y descarga, con actor/directorio temporales y modelo simulado. Una pregunta sintética independiente confirmó el transporte real Gemini; no leyó archivos privados ni creó conversación persistente. Se ocultaron metadatos internos POSE tanto en streaming como al recuperar mensajes del modelo, conservando código y citas. Logs: `.local-setup/terminal-final-backend.log`, `terminal-final-build.log` y `terminal-final-postgres.log`.

La primera ejecución de la regresión se bloqueó por permisos del aislamiento (HTTP local/enlaces); se repitió fuera de ese aislamiento y pasó. Durante el desarrollo, la integración detectó una comparación incorrecta del estado de ejecución; se corrigió para exigir PASSED con exit code cero, y se volvió a comprobar. Los resultados anteriores no se presentan como aprobados. Las 86 pruebas frontend y 45 SQL anteriores conservan su fecha/alcance; la integración nueva añade un caso SQL/Docker, sin repetir toda la suite SQL ni modificar frontend.

Se amplió CI para comprobar también la ayuda del iniciador. Es configuración local pendiente de ejecución remota después del push. No se instaló ni reemplazó el comando global beta `ares`. Usa `npm run terminal` o `ares-terminal.cmd`; consulta [el manual](CLI-Y-MCP.md) antes de ejecutar scripts. La copia limpia y la imagen descritas más abajo corresponden al cierre previo a la REPL; no sustituyen sus pruebas nuevas.

El iniciador también se abrió contra nuestra API real 3001: sugerencia de documentación, compilación del ejemplo público y ZIP de siete entradas con SHA-256 coincidente. Se dejó una ventana interactiva disponible para Kevin. La entrega nueva revisa 345 archivos, sin ausencias respecto de la base ni coincidencias de credenciales; el paquete valida contenido, hashes y CRC. Ruta/huella actual en `.local-setup/package-review-result.json`. No se hizo otra instalación limpia de esta ampliación ni se reconstruyó su imagen: no atribuirles los resultados anteriores.

Kevin pidió comparar ambas referencias después de revisar la consola. [COMPARACION-TRES-VERSIONES.md](COMPARACION-TRES-VERSIONES.md) añade la beta v3.9 fijada a 5588570 y nuestra publicación bd7c1e8 frente a la versión actual. Se capturaron seis vistas con datos simulados y se verificaron cinco módulos beta sin red. El visor local de capturas está en http://127.0.0.1:5190/; no es un despliegue ni una función permanente de la consola.

Se conservaron los cinco archivos publicados de `examples/pedidos`, antes ausentes de la carpeta fuente; sus tres pruebas pasaron. El inventario ahora informa ausencias además de archivos nuevos/modificados: cero archivos de referencia ausentes y cero coincidencias de credenciales tras esta recuperación. Las fuentes runtime de A.R.E.S. no se modificaron para esta comparación; la evidencia anterior de suites sigue identificada como anterior.

La consola conserva diseño, avatar y navegación plegable. Permite abrir resultados junto al chat, discutirlos sin perder fuentes, leer una selección pública de GitHub, preparar prototipos con las mismas fuentes para vista/ZIP y acceder a casos de uso por CLI/MCP. IA, ejecución y publicación mantienen pasos explícitos.

La consolidación de arquitectura es incremental: contratos y adaptadores en los límites existentes. No se presenta como reescritura completa, certificación DDD o autonomía sobre todo el equipo.

## Aceptación del plan

| Etapa | Entregado y comprobado | Límite o verificación restante |
| --- | --- | --- |
| 0. Evidencia | Comprobantes para leído/compilado/ejecutado/probado/aplicado/publicado; proyecto, revisión y fuentes | Texto del modelo no equivale a recibos de herramientas |
| 1. Consola | Entrada visible, opciones plegadas, foco/Escape, móvil, pantalla corta y scroll respetuoso | Emular altura de teclado no prueba cada teclado físico |
| 2. Contexto/GitHub | Documento, Mermaid, Monaco diff y origen junto al mensaje; notas editadas persistentes; commit fijo, límites/exclusiones y cobertura | Solo repositorios públicos y archivos elegidos; encontrar rutas no acredita leerlas |
| 3. Voz/avatar | ARES/okey, finales/provisionales, transcripción editable, interrupción, TTS, medidor opcional y limpieza; poses y pausa de animación | Motores simulados en regresión; repetir micrófono/altavoz físicos |
| 4. Preview/ZIP | HTML/CSS/JS/TS/Vue compilados, huellas, aislamiento, anchos, logs y parada; 17→999 modifica ejecución; ZIP/vista con salida exacta | Vue controlado, sin npm arbitrario/SSR/preprocesadores; compilación no es prueba de negocio/type-check completo |
| 5. Arquitectura/DDD | Contratos de artefactos/ingesta/SSE/ejecuciones; puertos; Pedidos/Inventario, ADR/diagrama, invariante y seis pruebas | Transacción del ejemplo nuevo en memoria; no acredita saga distribuida o atomicidad SQL de otro producto |
| 6. CLI/MCP/PR | API y autorización existentes, lectura/propuestas en CLI JSON/MCP, paleta, PR de head fijo y REPL con historial/SSE/preview y scripts confirmados por huella | CLI JSON/MCP no aplican/ejecutan/publican; la REPL añade ejecución confirmada. PR no compara toda la base/diff ni sustituye CI |
| 7. Entrega | Compilaciones, suites locales, imagen, acceso/recuperación, versiones, línea base y CI ampliado | Primer CI remoto pendiente de publicación autorizada; despliegue público aparte |

La galería de demos era opcional y no se añadió. Se conserva Web Speech; Orus no se integró. No hay nuevas conexiones a accesorios, correo o calendario.

## Cambios para inspeccionar

- **Voz/presencia:** `frontend/src/domain/conversation.ts`, `stores/conversation.ts`, `stores/voice.ts`, `domain/microphone-meter.ts`, `components/MicrophoneLevel.vue` y `avatar/scene.ts`. Evitan pérdidas de fragmentos, reactivaciones tardías y recursos activos al detenerse.
- **Artefactos:** `backend/src/modules/prototypes/`, `frontend/src/components/PrototypeWorkbench.vue` y `services/prototypes.ts`. Validación de rutas/tamaños/secretos; compilador de archivos incluidos y Vue controlado; ejecución explícita.
- **Aislamiento:** `/prototype-view` temporal, CSP propia, sandbox opaco, sin cookies/dispositivos ni red externa. Mensajes validados por ventana, origen, revisión y forma. Quien tenga el token puede leer el HTML hasta su caducidad: no compartir ese enlace como si fuera una sesión privada.
- **Contexto exacto:** discutir añade las fuentes compiladas y sus huellas al borrador. Editar exige recompilar antes de abrir/exportar/discutir esa nueva versión.
- **Contratos/DDD:** `packages/contracts/`, `examples/ddd-acceptance/` y `scripts/check-ddd-acceptance.mjs`. Quitar la guarda de pedido vacío en una copia provoca el fallo esperado; el original se conserva.
- **Integraciones:** `backend/src/interfaces/`, `modules/github/`, `frontend/src/components/ActionPalette.vue` y `CLI-Y-MCP.md`. SDK MCP probado por stdio contra Express; sin instalar configuración en clientes de escritorio del usuario.
- **Entrega:** Dockerfile, Compose, `ARES_SETTINGS_FILE`, scripts y CI. Imagen como UID 1000 y volumen de configuración; sin socket Docker ni claves.

## Pruebas realizadas

### Comprobaciones adicionales solicitadas por Kevin

Se consultó npm audit en ambos proyectos: **cero vulnerabilidades conocidas** en la fecha de la comprobación. No es una garantía sobre fallos desconocidos.

Gemini y OpenRouter se comprobaron realmente por `/api/chat`, con consultas sintéticas, sin archivos privados ni historial. Con prompt v1.9 llegaron diez fragmentos Gemini y 164 OpenRouter; primer contenido a 2,5 s y 4,6 s respectivamente. Ambos contestaron en español y declararon no haber leído archivos ni ejecutado pruebas. Google Search volvió a devolver **429 GEMINI_QUOTA**; no se repitió para forzar cuota.

Estas respuestas también mostraron consecuencias de negocio no demostradas. Se añadió guía explícita de supuestos/invariantes al prompt, pero la prueba posterior no acredita exactitud semántica garantizada: el texto sigue siendo una propuesta que requiere revisión y reglas concretas del proyecto.

Gemini colocó además POSE al final de una respuesta. Se corrigió ese caso: un pie completo con emoji/OJOS se reconoce fuera de bloques de código, se retira de pantalla/TTS y actualiza el avatar. Los ejemplos, citas y marcadores inválidos se conservan. Tres pruebas nuevas y el recorrido Chrome correspondiente pasaron; la regresión focal de voz/avatar pasó seis casos.

Se añadió `review:package`: ZIP de fuentes verificadas, manifiesto, CRC y huellas, sin entorno privado ni datos. Se extrajo con la implementación ZIP de PowerShell y se verificaron independientemente los hashes de sus 326 fuentes. Desde esa copia se ejecutó `npm ci` en ambos proyectos: **81 pruebas backend, 86 frontend y ambas compilaciones aprobadas**. El backend compilado sirvió la interfaz y ejecutó preview 999 en Chrome, con entorno vacío, puerto temporal, sin base/claves y sin errores de página o desbordamiento móvil. La interfaz compilada se copió a backend/public solo para esa comprobación; Docker prepara esa ubicación durante su build y el desarrollo habitual usa Vite.

El primer intento frontend en la copia falló porque se había ubicado dentro de `.local-setup`, bloqueada por Vite. Se reubicó la copia en una carpeta temporal excluida de Git/Docker; se conservaron las restricciones de Vite. La instalación y ejecución limpias posteriores pasaron. No se sustituyó ni vació la base del usuario.

| Grupo | Resultado | Alcance |
| --- | ---: | --- |
| Backend | 81 aprobadas | HTTP, validadores, compilador, contratos, CLI/MCP y servicios; IA sintética |
| Frontend | 86 aprobadas | Componentes, dominio y estados; voz/dispositivos simulados, incluidos metadatos finales |
| PostgreSQL | 45 aprobadas | Persistencia, acceso, consumo, propuestas y recuperación |
| Aislamiento Docker | 2 aprobadas | Ejecución filtrada, red/claves, cancelación y original conservado |
| DDD | 6 aprobadas | Pedidos/Inventario/concurrencia; mutación sin guarda falla como se esperaba |
| Chrome general | 34 anteriores + nuevo caso aprobado | UI/API y pie POSE; seis recorridos focales voz/avatar repetidos tras la corrección |
| Chrome persistente | 13 aprobados | PostgreSQL y actores temporales, sin borrar datos del usuario |
| Chrome acceso | 1 aprobado | Roles, sesiones, renovación/revocación y rutas nuevas |
| Chrome producción | 4 aprobados | Build/headers reales, ZIP/vista, Vue, aislamiento y mediciones |
| Imagen de entrega | Aprobada | PostgreSQL temporal, sesión, Chrome, precio 999, ZIP/huella y ajustes sin root |
| Builds/versiones | Aprobadas | Backend/frontend, paquetes/locks, etiqueta UI y health 1.0.0 |

El primer intento backend en sandbox falló por restricciones de loopback, archivos y enlaces. Repetido con permisos del host pasó 81/81. La prueba inicial del contenedor intentó modo local en 0.0.0.0 y fue rechazada; la comprobación final utiliza modo compartido, sesión y base temporales. Se conserva la restricción de HOST local.

Transporte GitHub real: beta fijada a `93ce76b58c164c7bfff265c910cd7e2c4f6006f5`, 127 rutas y dos archivos leídos; PR #1 de A.R.E.S. con head `d061b9a1d4b21845ce1d5fb9aeef52d764e4538f` y cinco cambios. Sin llamadas IA ni publicación.

Chrome, WebGL, Monaco, Mermaid, compiladores, SQL y Docker fueron reales. Reconocimiento/TTS y proveedores IA se simularon en las suites; las llamadas reales adicionales se identifican arriba. La confirmación física anterior de ARES/okey se conserva como evidencia anterior; no acredita automáticamente los últimos ajustes.

## Rendimiento observado

Build de producción, Windows, Ryzen 7 7735HS, RTX 4060 Laptop, 16 CPU lógicas, 15 GiB de RAM total, Node 24.21, Chrome 155 y viewport 1440 × 1100/pixel ratio 1. Interfaz/avatar: **810 ms**. Tres muestras: mediana de compilación Vue **73 ms**, apertura **91 ms**, salida 73 097 bytes.

En tres segundos con avatar visible: heap JS **10,9 MiB**, tareas CPU **738 ms**, RAF medio **144 Hz**, p95 **7 ms**, cero intervalos mayores de 50 ms. RAF no equivale a presentaciones GPU; heap JS no mide RAM total de navegador/GPU/backend. Muestras locales, no SLA. Repetir bajo mismas condiciones e investigar regresiones de medianas superiores al 50 %; observar heap, CPU y p95.

Vite mantiene el aviso de módulos grandes de Monaco/Mermaid/Three cargados bajo demanda. Preview no ofrece aislamiento de procesos/CPU contra bucles infinitos del código abierto; aislar origen/red/permisos no constituye una VM. El HTML exportado se ejecuta fuera de estas protecciones al abrirlo por cuenta propia.

## Evidencia local y reproducción

Comprobación de consola real 5175: backend/PostgreSQL disponibles, WebGL y preview sintético 999 operativos, sin desbordamiento móvil ni errores de página; sin IA ni cambios al historial en ese recorrido. El inventario inicial revisó 321 archivos sin coincidencias de credenciales; los scripts y pruebas añadidos después se incluyen en el manifiesto regenerado de entrega. El análisis no sustituye la revisión humana.

Logs/capturas en `.local-setup/`, fuera de publicación. `.local-setup/revision-local/manifest.json` contiene SHA-256, archivos nuevos/modificados y búsqueda de claves configuradas/patrones sin imprimirlas. Reproducir con las dependencias del README, Chrome y PostgreSQL local de pruebas:

```powershell
npm run check:versions
npm run test:acceptance
npm run review:release
npm --prefix backend test
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend run test:db
npm run test:isolation
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:db
npm --prefix frontend run test:access
npm --prefix frontend run test:production
docker build -t ares-local-review:1.0.0 -f backend/Dockerfile .
node scripts/check-container.mjs
```

Preparar primero la imagen del ejecutor con `npm run runner:prepare`. Ejecutar suites Chrome en secuencia: comparten directorio de resultados. `check-container` crea/elimina solo sus contenedores/red etiquetados, sin claves ni datos reales. No usar pruebas para vaciar historial del usuario.

## Revisión con Kevin

1. Consola 5175: escribir y navegar en escritorio/móvil; abrir/discutir un resultado conservando contenido y borrador.
2. Activar conversación voluntariamente: ARES → saludo → «Explica un agregado con un ejemplo, okey». Interrumpir, corregir y desactivar; comprobar oído, permiso y voz española físicos.
3. Preview y ZIP: editar, compilar, abrir/exportar y discutir esas fuentes. Revisar el código antes de ejecutarlo.
4. GitHub/PR: revisar selección/cobertura y distinguir análisis IA de pruebas. Generar consume cuota y requiere elección explícita.
5. Terminal: `status`, `mode auto`, `route`, pregunta sintética, cancelación e historial del proyecto elegido. Ejecutar scripts solo tras revisar la preparación de `run` y confirmar su huella. Probar el ejemplo público de preview/ZIP sin IA.
6. Revisar manifiesto/diff y exclusiones. Después decidir push y comprobar el primer CI remoto antes de fusionar/desplegar.

Google Search mantiene su último 429 de cuota. Las llamadas reales adicionales usaron solo consultas sintéticas; no se conectaron dispositivos físicos. Publicar código no despliega el servicio: dominio/HTTPS/acceso/persistencia requieren una decisión separada.
