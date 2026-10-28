# A.R.E.S.: informe comparativo y plan de evolución

**Nota de vigencia:** este documento conserva la revisión histórica de beta v3.0. La comparación posterior de beta v3.9, nuestra base publicada y nuestra implementación actual está en [COMPARACION-TRES-VERSIONES.md](COMPARACION-TRES-VERSIONES.md). No extrapolar los hallazgos antiguos a commits nuevos sin comprobarlos.

**Actualizado:** 27 de octubre de 2026, Lima. Segunda revisión.

**Alcance:** análisis, observación de interfaces y comprobaciones acotadas. No se modificó código de aplicación.

**Estado del plan:** propuesta pendiente. La revisión no implementa ninguna de las mejoras propuestas.

## 1. Dictamen actualizado

**La beta avanzó de forma real. Mantendría nuestra versión como base definitiva y elevaría la prioridad de integrar repositorios remotos, artefactos y voz en una experiencia más sencilla.**

La beta publicada como v3.0.0 incorpora dictado, visualización de audio, lectura de repositorios GitHub, adjuntos de código, tres modos de trabajo y exportación de conversaciones. Ya no es correcto describir su micrófono como desactivado ni su relación con GitHub únicamente como CLI y revisión de PR.

Sin embargo, el crecimiento visible supera todavía la profundidad de algunas funciones. El hallazgo principal es que ciertas vistas previas **sustituyen los archivos recibidos por aplicaciones de demostración predefinidas**. Otro es que la auditoría GitHub obtiene una muestra pequeña de documentos y manifiestos, pero su interfaz puede presentar el total de rutas encontradas como archivos analizados. Esto afecta directamente al requisito del usuario: distinguir una propuesta, una simulación y una acción realizada.

Nuestra versión conserva ventajas en trabajo verificable sobre código, memoria con fuentes, revisión y recuperación de cambios, ejecución aislada, control de acceso y CI. Su deuda principal sigue siendo la experiencia cotidiana: demasiados controles antes del chat y resultados distribuidos entre secciones. No recomiendo copiar la beta completa ni considerar el número «3.0» como evidencia de autonomía, corrección DDD o preparación para producción.

## 2. Versiones, alcance y comprobaciones

| Referencia | Revisión fijada |
| --- | --- |
| Beta anterior | `7cc11efea5aaf4019b9acd89e5ca42a6ec39655e`, revisada el 26 de octubre |
| Beta actual | [ARES, commit 5aff5b5](https://github.com/AI-Innovation-op/ARES/tree/5aff5b54ccbef79489cbdc5919aa7287092f629a) |
| Release publicada | [v3.0.0](https://github.com/AI-Innovation-op/ARES/releases/tag/v3.0.0), existente, no borrador ni prerelease según la consulta |
| Nuestra implementación | [A.R.E.S., commit bd7c1e8](https://github.com/AI-Innovation-op/A.R.E.S/tree/bd7c1e83bfbce571e9ba895670a359f08a6ff55f) |
| Main de nuestro repositorio | `de0564eccd636f8e76450558026930b6287c4f85`, integración del PR 2 |

La actualización comprende **tres commits, 25 archivos modificados, 1973 inserciones y 179 eliminaciones**. Revisé el diff por áreas y los archivos relevantes que permanecieron iguales. La comparación de contenido de los archivos publicados presentes en nuestra carpeta local no detectó cambios respecto de la base anterior. Se mantiene la salvedad de cinco archivos del ejemplo sintético `examples/pedidos`, presentes en el checkout publicado y ausentes de la carpeta fuente local.

Distingo tres niveles de evidencia: **ejecución real** de una función/interfaz; **prueba controlada** con red, datos o eventos simulados; y **análisis estático** del código. Una prueba simulada de SpeechRecognition no acredita un micrófono físico.

| Comprobación de esta revisión | Resultado y límite |
| --- | --- |
| Tipos frontend beta | `vue-tsc --noEmit` aprobado |
| Compilación frontend beta | Vite aprobado; advertencia de chunks mayores de 500 kB. Archivo principal de aproximadamente 1526 kB minificado / 411 kB gzip; no es una medición de velocidad |
| Tipos backend beta | `tsc --noEmit` aprobado; backend no iniciado |
| Interfaz beta en Chrome | Observada a 1440 × 1000 y 390 × 844, sin errores JavaScript de página en el recorrido observado |
| Modos y exportación | Arquitecto llegó como `tacticalMode` a la petición interceptada; descarga Markdown comprobada |
| Modal GitHub → conversación | Informe sintético visible en modal, ausente de las peticiones de chat interceptadas |
| Lectura GitHub de la beta | Ejecutada sin token ni LLM: 111 rutas encontradas y cinco archivos descargados; detalle en §5.3 |
| Preview | Pruebas locales de generación HTML y sintaxis: sustitución por plantillas y fallo Vue descritos en §5.1–5.2 |
| Voz | Eventos y recursos de audio simulados; resultados en §5.5. Sin captura física |
| Nuestra consola | Observada otra vez en 5175; persiste la entrada fuera de la primera pantalla |
| CI beta | La consulta devolvió una lista vacía de ejecuciones; no demuestra ausencia de pruebas manuales históricas |
| CI nuestro | Se conserva la evidencia histórica del [run 40416713710 satisfactorio](https://github.com/AI-Innovation-op/A.R.E.S/actions/runs/40416713710): unidades/build Windows-Linux e integración PostgreSQL/Docker/navegador. No se repitió toda la suite |

Para observar la beta se utilizó únicamente su frontend en un puerto temporal, bloqueando las peticiones API. Solo el caso del modal recibió una respuesta sintética explícita. No se enviaron conversaciones a modelos, no se publicaron comentarios y no se tocaron datos ni claves de nuestra instalación.

No probé su despliegue Render, calidad de respuestas de IA, micrófono físico, CLI/MCP ni una auditoría de seguridad exhaustiva. Compilar correctamente no demuestra esas capacidades.

## 3. Qué cambia respecto del informe anterior

| Tema | Antes | Ahora | Evaluación |
| --- | --- | --- | --- |
| Voz entrante | Botón desactivado | Reconocimiento continuo en español y comandos de envío | Mejora real; necesita robustez de turnos y liberación de recursos |
| Audio visual | Sin visualizador de entrada | AudioContext/AnalyserNode y 16 barras | Buena retroalimentación; carrera de inicio reproducida de forma controlada |
| GitHub remoto | Sin modal de ingesta | Modal y endpoint `/api/audit/github` | Ampliación útil; cobertura parcial que debe explicarse |
| Adjuntar código | Principalmente imagen/texto | Selector que inserta hasta 10 000 caracteres | Útil; reemplaza el borrador y recorta sin explicación. No encontré la zona de arrastre anunciada |
| Modos | Acciones rápidas | Centinela, Blitzkrieg y Arquitecto | Directivas de prompt, no agentes o validadores distintos |
| Exportación | No destacada en la beta | Markdown desde cabecera y terminal | Descarga comprobada. Nuestra consola ya exportaba conversaciones |
| Preview DDD | Ensamblador heurístico | Plantillas café/auth y modificación del camino Vue general | Mayor impacto visual, pero pérdida de fidelidad en los casos sustituidos |
| Versionado | Versiones mezcladas | Release real y cuatro package.json en 3.0.0 | Persisten versiones antiguas en título, health, exportadores, CLI y lockfiles |
| Arquitectura/pruebas | Capas horizontales y Sentinel | Sin transformación estructural equivalente | No aparecieron nuevas suites deterministas ni ejecución autónoma distribuida |

Fuentes: [diff entre revisiones](https://github.com/AI-Innovation-op/ARES/compare/7cc11efea5aaf4019b9acd89e5ca42a6ec39655e...5aff5b54ccbef79489cbdc5919aa7287092f629a), [ChatInput](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/chat/ChatInput.vue), [ChatConsole](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/chat/ChatConsole.vue).

## 4. Comparación visual y experiencia

La beta conserva una distribución directa: avatar a la izquierda, conversación a la derecha y entrada al pie. GitHub Audit, modos y exportación hacen visibles sus capacidades, aunque añaden densidad a la barra del chat.

Nuestra versión mantiene una estética más sobria, tipografía legible, iconos consistentes y un avatar con armadura, volumen y proporciones más próximos a las referencias originales. El motor geométrico del avatar beta no cambió en esta actualización; el panel de audio no equivale a un rediseño del personaje.

La beta gana en acceso inmediato al chat. Nuestra versión gana, a mi juicio, en detalle del avatar y legibilidad, pero desperdicia espacio con los bloques de voz, conversación, historial y memoria. Esta es una valoración de diseño, no una medición universal de superioridad estética.

| Medida observada | Beta v3.0 | Nuestra consola |
| --- | --- | --- |
| Ventana escritorio | 1440 × 1000 | 1440 × 1000 |
| Inicio vertical de entrada | 926 px: visible | 1615 px: fuera de la primera pantalla |
| Ventana móvil | 390 × 844 | 390 × 844 |
| Inicio vertical de entrada | 778 px: visible | 1949 px: fuera de la primera pantalla |
| Campo móvil beta | **66 px de ancho**, entre tres botones y «Ejecutar» | El problema principal observado es su ubicación vertical |
| Cabecera móvil | Selector llega hasta x=474; terminal/voz/SFX quedan aún más a la derecha y recortados | Sin desbordamiento horizontal de página observado |
| Modos beta en móvil | Ocultos con `hidden md:flex`, sin selector equivalente visible en el chat | Deben ser accesibles desde un menú compacto |

Las medidas de nuestra consola corresponden a la conversación existente observada; cambian con el contenido. En la beta, `overflow: hidden` puede ocultar controles aunque la página no tenga scroll horizontal.

**Decisión:** conservar nuestro lenguaje visual, adoptar entrada persistente, compactar avatar en móvil y agrupar acciones secundarias. Evitar copiar literalmente la barra de la beta o añadir más paneles permanentes.

## 5. Hallazgos detallados

### 5.1. Prioridad alta: algunos previews no ejecutan los archivos entregados

El compilador busca `coffee`, `cafe`, `espresso`, `auth`, `jwt` o `token` en rutas/contenidos. Para café y autenticación llama a plantillas que reciben **solo el título**, no los archivos. El caso de HTML completo se procesa antes: no todas las vistas previas son sustituidas.

Probé dos entradas `src/domain/coffee.ts`, una con precio 17 y otra con 999 y marcadores distintos. **El HTML resultante fue idéntico y no contenía el marcador original.** También comprobé que un archivo de tokens de diseño puede activar la plantilla de autenticación.

Una tienda con carrito visible no demuestra que funcionen el carrito, repositorios o reglas del código generado. El ZIP y el preview pueden representar aplicaciones diferentes. Para DDD, una demostración visual no valida agregados ni invariantes.

La plantilla auth sí muestra «Live Demo» en el encabezado. Sin embargo, el botón anuncia «GENERAR TOKEN JWT FIRMADO» y luego «SESIÓN AUTENTICADA», mientras fabrica una firma con `btoa` de una cadena constante y no valida la contraseña. Debe identificarse como simulación de interfaz, no autenticación comprobada. [Selección de plantillas](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/preview-compiler.service.ts#L41), [firma ficticia](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/preview-compiler.service.ts#L659).

**Rescataría** las demos como ejemplos explícitos. **No copiaría** el reemplazo silencioso del programa cuya vista previa pidió el usuario.

### 5.2. Prioridad alta: Vue general y aislamiento siguen pendientes

El camino general extrae SFC y elimina imports/tipos con expresiones regulares. Quita `export default` antes de comprobar si existe y puede colocar un objeto de componente dentro de `setup()`. Un ejemplo mínimo Options API produjo JavaScript con **`Unexpected token '{'`** en la comprobación sintáctica local.

El nuevo `sintetizarVueGeneral` tampoco conserva el recorrido anterior de subcomponentes y scripts de dominio. Es una regresión estática respecto del ensamblador anterior, aunque aquel tampoco era un compilador general fiable. No queda acreditado soporte de proyectos DDD arbitrarios. [Camino general](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/preview-compiler.service.ts#L675).

El iframe mantiene `allow-scripts` y `allow-same-origin` sobre `srcdoc`, y los logs siguen sin verificar la ventana emisora. No ejecuté una explotación. La combinación no proporciona el aislamiento esperado para código no confiable, como advierte [MDN sobre sandbox](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox). [Visor](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/common/LivePreviewModal.vue#L160).

### 5.3. Prioridad alta: GitHub ofrece una revisión preliminar de una muestra

La ingesta existe y consulta GitHub. Su alcance es:

1. Metadatos y árbol de la rama predeterminada.
2. Primeros cinco archivos cuyo nombre coincide con manifiestos/documentos, en el orden recibido; sin priorización semántica.
3. Hasta 4000 caracteres por archivo para el modelo.
4. Primeras 60 rutas en el prompt; hasta 100 en la respuesta al frontend.
5. `totalArchivos` cuenta rutas encontradas, no contenidos leídos.

Ejecuté solo la lectura sobre la propia beta, sin token ni LLM. Encontró **111 archivos** y descargó:

| Archivo | Caracteres incorporados |
| --- | ---: |
| README.md | 4000 |
| backend/Dockerfile | 1152 |
| backend/package.json | 818 |
| backend/tsconfig.json | 509 |
| cli/package.json | 700 |

No leyó el contenido del servicio de voz, previews, controladores o dominio. Ni siquiera llegó al package.json del frontend en esa selección. Esa muestra permite orientar sobre configuración y estructura; no acredita una auditoría profunda de secretos, OWASP o complejidad de algoritmos.

La UI usa ese total como «archivos analizados». En una prueba controlada mostró «100 archivos analizados» con un informe sintético. Comprobé también que el servicio no comunica `truncated` cuando el árbol simulado lo marca. Usa una rama mutable sin fijar SHA para todas las lecturas. No encontré timeout/cancelación en sus `fetch`; el recorte de 4000 ocurre después de descargar el texto completo. [Ingesta](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/github-audit.service.ts#L128), [contador](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/audit/GithubAuditModal.vue#L169).

**Recomendación:** mostrar «111 rutas encontradas / 5 archivos leídos / límites del análisis» y enlazar conclusiones a fuentes. Un diagrama inferido y el score del modelo deben identificarse como tales.

### 5.4. Prioridad alta: se pierde el informe al discutirlo en el chat

«Discutir en Consola» envía una frase con la URL y solicita evaluar los puntos críticos. **No adjunta informe, manifiestos ni un identificador recuperable.** Lo comprobé con un marcador sintético: apareció en el modal, pero no en las peticiones de chat interceptadas.

Pegar una URL en el chat añade una instrucción sobre GitHub en el backend; no invoca allí el servicio de ingesta. Por tanto, pegar una URL, pulsar Audit y discutir un informe no aportan el mismo contexto.

La terminal puede ejecutar `audit <url>` y luego abrir un modal vacío: no transfiere el resultado a su estado. El modal tampoco envía el proveedor/modelo seleccionado en el chat; se usa el predeterminado del backend. [Traspaso](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/audit/GithubAuditModal.vue#L66), [chat](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/chat.service.ts), [terminal](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/hud/TacticalTerminal.vue).

**Para nuestro plan:** guardar y transmitir resultados con identidad, revisión y fuentes, evitando frases que presupongan que el asistente ya conoce un informe.

### 5.5. Prioridad alta: voz implementada, pero turnos frágiles

Reconocimiento `es-ES`, resultados provisionales, reinicio de escucha y comandos «ARES enviar» / «enviar orden» son avances reales. No equivalen al protocolo solicitado para nuestra consola: despertar con «ARES» y terminar con «okey».

Pruebas con eventos y recursos de audio **simulados**:

| Caso | Resultado del código ejecutado |
| --- | --- |
| Dos segmentos finales: «Revisa el dominio de pedidos» + «y genera un ADR» | La transcripción queda solo en «y genera un ADR» |
| «Analiza inventario, enviar orden.» | El punto final impide disparar esa variante de envío |
| Provisional «Analiza inventario ARES enviar» | Se envía «Analiza inventario» sin esperar resultado final |
| Frame del analizador anterior a `recognition.onstart` | Sale del bucle sin programar otro frame; las barras pueden no actualizarse |
| Error de red seguido de `onend` | Estado inactivo, pero el track independiente de audio no se detiene por esa ruta; stop explícito sí lo libera |

No son fallos físicamente observados en el micrófono de Kevin. Son rutas reproducidas que deben cubrirse antes de considerar fiable una conversación larga. Tampoco encontré coordinación equivalente a la actual entre TTS/escucha o parada al ocultar la pestaña. [Servicio de voz](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/services/voice.service.ts#L69).

Además, por análisis estático, `voice off` cuando ya está inactivo cae en el `else` que alterna la voz y puede iniciarla. Desactivar debe ser idempotente. No activé un micrófono físico para comprobarlo.

### 5.6. La ingesta amplía la deuda de control de acceso

Las rutas revisadas no incorporan autenticación, roles y consumo equivalentes a nuestra versión. El nuevo endpoint puede leer repositorios y llamar al proveedor. **Si** se configura `GITHUB_TOKEN` con permisos privados y se expone sin protección adicional, otros llamantes podrían solicitar análisis de repositorios accesibles por ese token. No intenté ese escenario; depende de los permisos y despliegue reales.

La URL se valida mediante una expresión que encuentra `github.com/owner/repo` dentro de un texto: conviene validar esquema y hostname completos. Las peticiones usan hosts fijos de GitHub; esto no demuestra SSRF arbitrario. [Endpoint](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/app.ts), [token opcional](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/services/github-audit.service.ts#L71).

Para nuestra versión: lectura pública acotada primero; privados solo con autorización por proyecto, redacción de secretos y control de lo enviado al modelo.

### 5.7. Modos, adjuntos y exportación: avances concretos, límites concretos

- Centinela/Blitzkrieg/Arquitecto cambian directivas de texto. Comprobé `tacticalMode: arquitecto` en la petición. No seleccionan por sí solos validadores, agentes independientes ni reglas de ejecución. Recomiendo intenciones claras «Revisar», «Prototipar», «Diseñar»; el modo rápido no debe saltarse controles.
- El adjunto lee el archivo completo y pega los primeros 10 000 caracteres. Reemplaza el borrador y no informa del recorte. No encontré arrastre ni redacción equivalente a nuestro explorador local.
- La exportación funciona sobre mensajes cargados en el store; no obtiene una instantánea independiente del historial ni prueba que todo lo exportado esté confirmado. Nuestra exportación ya existe: mejorar descubribilidad y alcance, no recrearla.
- Existe release 3.0.0, pero título HTML 2.8, health 2.9 y otros textos/lockfiles anteriores contradicen la sincronización total anunciada. La compilación pasó; esto es un problema de consistencia, no un fallo de build demostrado.

## 6. Hallazgos anteriores: estado actualizado

| Hallazgo del 26 de octubre | Estado en v3.0 |
| --- | --- |
| Dictado desactivado | **Superado:** sustituir por los avances y límites de §5.5 |
| Módulos escritos pero no montados | **Persiste:** AppShell no monta DocShield/CodeSword/Architect. Ficha, ZIP, preview y modal GitHub sí son accesibles |
| ONLINE fijo | **Persiste:** observado con API bloqueada |
| Aislamiento del preview | **Persiste:** mismos permisos y recepción de logs |
| Métricas extraídas del LLM | **Persiste y se amplía** con el informe GitHub; no son mediciones ejecutadas |
| Mermaid loose | **Persiste:** no sustituir el saneamiento actual por esta configuración |
| Conmutación PostgreSQL → SQLite ante cualquier error capturado | **Persiste:** puede dividir el estado; no probé pérdida de datos |
| Bio basado en fórmulas | **Persiste:** no representa medición corporal |
| Arquitectura horizontal | **Persiste:** no se transforma en hexagonal estricta al cambiar versión |
| CI determinista equivalente | **Pendiente:** Sentinel sin cambios, sin runs devueltos y sin suites nuevas en el diff |
| Móvil recortado | **Persiste:** además el nuevo adjunto deja la entrada muy estrecha |

Fuentes sin cambios relevantes: [AppShell](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/frontend/src/components/layout/AppShell.vue), [SQL](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/backend/src/config/db.ts), [Sentinel](https://github.com/AI-Innovation-op/ARES/blob/5aff5b54ccbef79489cbdc5919aa7287092f629a/.github/workflows/ares-sentinel.yml).

## 7. Comparación funcional y decisiones

| Área | Beta v3.0 | Nuestra versión y oportunidad |
| --- | --- | --- |
| Avatar | FSM y variantes agrupadas; panel de audio nuevo | Conservar avatar, poses automáticas, movimiento y pausa actuales |
| Voz/chat | SSE, TTS y nuevo dictado | Conservar turnos confirmados, cancelación y ARES/okey; simplificar controles |
| Multimodelo | Chat configurable; auditoría usa predeterminado backend | Mantener enrutamiento por tarea y mostrar proveedor efectivo |
| GitHub remoto | Lectura preliminar por URL | Incorporar lectura remota con fuentes; nuestras operaciones Git locales no sustituyen esto |
| Archivos | Adjunto de texto | Conservar raíces autorizadas, tamaños, hashes y redacción; facilitar el acceso |
| Memoria | Historial/tablas; sin nuevo flujo RAG en el diff | Conservar RAG con citas y exclusión de contenido obsoleto |
| Documentos | Generación y derivaciones parcialmente desconectadas | Conservar Biblioteca, revisiones y aprobación; acercarlas al chat |
| Diagramas/diff | Mermaid y comparador propio | Conservar Mermaid saneado y Monaco |
| Preview/ZIP | Plantillas y empaquetador | Incorporar equivalencia entre revisado, ejecutado y descargado |
| Modos | Variantes de instrucciones | Intenciones claras sin privilegios implícitos distintos |
| Exportación | Nueva descarga Markdown | Ya existe; mejorar visibilidad y metadatos |
| Cambios/ejecución | Herramientas y CLI | Conservar huellas, respaldo, restauración y Docker aislado |
| CLI/MCP | Paquetes existentes, no ejecutados aquí | Incorporar como adaptadores tras estabilizar contratos |
| Acceso/consumo | Sin equivalente acreditado en rutas revisadas | Conservar sesiones, roles y límites actuales |
| Verificación | Tipos/build pasan | Mantener CI determinista y ampliarlo a los nuevos flujos |

Nuestra arquitectura tampoco está terminada: `GitService` depende de `LocalFiles` concreto; el store central coordina múltiples responsabilidades; `App.vue` conecta navegación, voz y estados; parte del código está muy comprimido. Conservar la base no significa declararla perfecta. [GitService](https://github.com/AI-Innovation-op/A.R.E.S/blob/bd7c1e83bfbce571e9ba895670a359f08a6ff55f/backend/src/modules/git/git-service.ts), [store](https://github.com/AI-Innovation-op/A.R.E.S/blob/bd7c1e83bfbce571e9ba895670a359f08a6ff55f/frontend/src/stores/console.ts).

## 8. Plan actualizado, en orden

Se conserva el orden general anterior, añadiendo una definición inicial de evidencia y ampliando GitHub, fidelidad preview/ZIP y pruebas de voz. Las casillas siguientes registran el plan pendiente al emitir la comparación. **Actualización de nuestra implementación, 27 de octubre:** el cierre local y la evidencia por etapa están en [REVISION-PREVIA-AL-PUSH.md](REVISION-PREVIA-AL-PUSH.md); las verificaciones físicas finales y el primer CI remoto permanecen explícitos. Los hallazgos de la beta conservan la revisión histórica indicada en este informe.

### Etapa 0 — Definir qué acredita cada resultado

- [ ] Estados coherentes: propuesta, demostración, generado, ejecutado, probado, aplicado y publicado.
- [ ] Asociar cada artefacto a proyecto, revisión, fuentes, proveedor, límites y comprobaciones.
- [ ] Diferenciar ruta encontrada, archivo leído, fragmento enviado y prueba ejecutada.

**Aceptación:** ningún resultado figura como probado/aplicado sin evidencia. Una demo no adopta la identidad del código del usuario. Definirlo antes de ampliar ingesta y previews.

### Etapa 1 — Consola simplificada y responsive

- [ ] Entrada accesible e historial desplazable; evitar que voz/memoria expulsen el chat de la primera pantalla.
- [ ] Unificar voz y escucha, con configuración avanzada desplegable.
- [ ] Compactar proyecto, modelo, fuentes e historial con detalle bajo demanda.
- [ ] Mantener hamburguesa y separar uso cotidiano de administración.
- [ ] Conservar paleta/avatar; normalizar tipografía, foco, espaciado, errores y estados vacíos.
- [ ] En móvil: avatar compacto, adjuntos agrupados y selector de modo accesible.

**Aceptación:** escribir/enviar a 1440 × 1000 y 390 × 844, también con teclado móvil; sin controles recortados, texto ilegible o campo reducido a una franja. Verificar teclado, texto ampliado y movimiento reducido. Auto-scroll no interrumpe la lectura anterior.

### Etapa 2 — Espacio contextual y GitHub con evidencia

- [ ] Abrir documentos, diagramas, informes y diffs junto al mensaje de origen; reutilizar Biblioteca/Mermaid/Monaco.
- [ ] Persistir identidad y revisión: «Discutir» recupera el informe y sus fuentes reales.
- [ ] Añadir URL pública validada y fijar un commit para árbol y contenidos.
- [ ] Seleccionar archivos dentro de límites; mostrar exclusiones, recortes, errores y árboles incompletos.
- [ ] Incorporar timeout, cancelación, límites de descarga y tratamiento de secretos/contenido no confiable.
- [ ] Separar rutas encontradas y archivos leídos; etiquetar inferencias del modelo.
- [ ] Intenciones Revisar/Prototipar/Diseñar y proveedor efectivo visibles.
- [ ] Adjuntar sin reemplazar borradores y hacer visible la exportación existente.

**Aceptación:** repositorio de 100 rutas con cinco archivos elegidos → cobertura exacta y citas a esos archivos. Discutir conserva hallazgos. Una URL sola no acredita lectura. Probar 404, cuota GitHub, árbol truncado, timeout, cancelación y rama que cambia durante la lectura.

### Etapa 3 — Conversación por voz y presencia del avatar

- [ ] Conservar despertar ARES/cierre okey y transcripción editable.
- [ ] Acumular finales, separar provisionales y normalizar puntuación sin envío prematuro.
- [ ] Coordinar TTS/escucha; detener voz/respuesta desde un control visible.
- [ ] Liberar reconocimiento, tracks, AudioContext y animaciones en cancelación, error, pestaña oculta y salida.
- [ ] Visualizador opcional con inicio/parada sincronizados; activar/desactivar debe ser idempotente.
- [ ] Poses vinculadas a estados reales, transiciones suaves, pausa y movimiento reducido.
- [ ] Español claro, resumen breve y ejemplos técnicos. Notas opcionales como borrador y Bio desactivada por defecto.

**Aceptación:** casos controlados de frases divididas, punto final, provisionales, permisos y cancelación; después micrófono/altavoz físicos con el usuario. No presentar simulaciones como reconocimiento real. Orus solo se evalúa si existe una necesidad de calidad.

### Etapa 4 — ZIP y preview del mismo artefacto

- [ ] Archivos estructurados con rutas, revisión y huellas; validar escapes, duplicados, tamaños y secretos.
- [ ] Exportar exactamente lo revisado, con manifiesto e identidad compartida con el preview.
- [ ] Empezar por HTML/CSS/JS delimitado; añadir Vue/TypeScript con compilación real y dependencias controladas.
- [ ] Demos café/auth, si se quieren, en una galería explícita y separada del proyecto.
- [ ] Aislar origen/credenciales, restringir red/capacidades y validar mensajes de la ventana.
- [ ] Escritorio/tablet/móvil, logs acotados, recarga y detención; sin ejecutar fragmentos parciales automáticamente.

**Aceptación decisiva:** cambiar precio 17 → 999 o una regla visible modifica la ejecución correspondiente. ZIP y preview comparten huella de versión. Lo no soportado produce un límite claro, nunca una plantilla sustituta. Sin acceso al DOM/sesión/almacenamiento/red no autorizada de A.R.E.S.; una demo JWT no acredita autenticación.

### Etapa 5 — Arquitectura y DDD verificable

- [ ] Consolidar límites de conversación, conocimiento, trabajo sobre código y acceso/operaciones.
- [ ] Separar coordinación frontend y dependencias concretas backend mediante contratos útiles; formatear para revisión.
- [ ] Unificar contratos de artefactos, ingesta, eventos y ejecuciones.
- [ ] Guiar DDD desde lenguaje de negocio, contextos, agregados e invariantes antes de carpetas.
- [ ] Distinguir evaluación del modelo, análisis estático y pruebas ejecutadas.

**Caso de aceptación:** pedidos e inventario con regla «no confirmar un pedido vacío». Explicar con ejemplo, proponer ADR/diagrama, revisar cambios, ejecutar pruebas pertinentes y documentar evidencia. Un carrito demo y cuatro carpetas no satisfacen este caso.

### Etapa 6 — CLI, MCP y revisión de PR

- [ ] Adaptadores de los casos de uso actuales, con autorización y alcance por proyecto.
- [ ] Comenzar por lectura/propuestas; conservar revisión para escribir, ejecutar y publicar.
- [ ] Paleta de acciones con estados reales, distinguiendo acciones internas de procesos del sistema.
- [ ] Revisiones IA de PR opcionales con permisos mínimos, costes y tratamiento de contenido externo explícitos.

**Aceptación:** web/CLI/MCP no eluden controles y conservan fuentes/resultados. IA no sustituye CI. Configurar lectura no autoriza publicar comentarios.

### Etapa 7 — Validación y entrega consolidada

- [ ] Extender CI a ingesta, traspaso de contexto, voz simulada, aislamiento y equivalencia preview/ZIP.
- [ ] Recorridos escritorio/móvil y voz física, registrando qué fue real o simulado.
- [ ] Medir carga, consumo y fluidez con hardware definido; fijar objetivos desde esa línea base.
- [ ] Verificar recuperación, acceso, exportación sin secretos y continuidad del proyecto.
- [ ] Unificar versión/release/título/health/README/ficha/guía con capacidades acreditadas.
- [ ] Entrega reproducible y recuperación. Despliegue público como decisión aparte con acceso y persistencia comprobados.

**Aceptación:** CI satisfactorio y recorridos documentados; ninguna función se da por terminada por cambiar versión o prompt.

## 9. Alcance posterior y prioridad práctica

Domótica, correo, calendario, autonomía prolongada y ejecución distribuida requieren integraciones y límites propios. No propongo bloqueo por «fatiga» calculada, matriz manual de poses como pantalla cotidiana, microservicios por defecto ni cambio de base de datos por estética.

La primera implementación sigue siendo simplificar la consola, precedida por definir estados de evidencia. La novedad principal del plan es integrar lectura de GitHub y resultados persistentes antes de ampliar promesas de autonomía o preview.

## 10. Evidencia local

Estos archivos pertenecen a la revisión local y no fueron publicados:

- [Pruebas controladas de preview, voz e ingesta](/D:/ares-bot/.local-setup/review-v3-probes.json).
- [Recorrido de navegador y peticiones interceptadas](/D:/ares-bot/.local-setup/review-v3-browser.json).
- [Lectura real de metadatos y manifiestos públicos](/D:/ares-bot/.local-setup/review-v3-github-read.json).
- [Medidas actuales de nuestra consola](/D:/ares-bot/.local-setup/review-v3-current-layout.json).
- [Captura beta v3.0 escritorio](/D:/ares-bot/.local-setup/review-v3-desktop.png).
- [Captura móvil del recorrido controlado](/D:/ares-bot/.local-setup/review-v3-mobile.png). Su pose de error corresponde al bloqueo deliberado de la API, no a una caída real del proveedor.
- [Informe anterior conservado](/D:/ares-bot/.local-setup/INFORME-COMPARATIVO-Y-PLAN-ARES-2026-10-26.md).

Conclusiones fijadas a `5aff5b5`. Una actualización posterior exige revisar su diff y repetir las comprobaciones afectadas. Se actualizó documentación y se generó evidencia local; no se programaron mejoras ni se modificó código de las aplicaciones.
