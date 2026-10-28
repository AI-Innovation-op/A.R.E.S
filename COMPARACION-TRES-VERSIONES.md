# A.R.E.S.: comparación de las tres versiones

27 de octubre de 2026, Lima. Comparación solicitada por Kevin después de revisar la versión local. Se conservaron los repositorios de referencia; no hubo push, publicación de comentarios ni despliegue.

**Actualización posterior:** la beta 4.0 queda fijada a 614bee1. [REFERENCIA-BETA-V4.md](REFERENCIA-BETA-V4.md) detalla sus dieciocho archivos cambiados, el wizard y la suite nuevos, y nuestra terminal interactiva incorporada. Este informe conserva las capturas y ensayos históricos con su commit original, sin atribuirles una nueva ejecución de 4.0.

## Dictamen

Mantendría nuestra versión actual como base. La mejora más visible frente a nuestra consola anterior es poder escribir desde la primera pantalla y trabajar con resultados junto al chat. Frente a la beta, la ventaja principal es conservar la relación entre archivos, preview, cambios y pruebas ejecutadas.

La beta ofrece más paneles y algunas capacidades que no hemos incorporado, como selección automática con fallback entre proveedores, memoria vectorial local y un radar de topologías. No es correcto afirmar que nuestra versión gana en todas las funciones. Tampoco son equivalentes un panel con un resultado simulado y una ejecución real del proyecto.

## Qué se comparó

| Versión | Fuente fijada | Alcance de esta comprobación |
| --- | --- | --- |
| Beta actual | [ARES v3.9, 5588570](https://github.com/AI-Innovation-op/ARES/tree/5588570a66786d380eefb5ddbadd71c8235ff1d5) | Inventario público, diff, inspección priorizada, frontend en Chrome y cinco módulos con dependencias simuladas en Docker sin red |
| Nuestra anterior | [A.R.E.S., bd7c1e8](https://github.com/AI-Innovation-op/A.R.E.S/tree/bd7c1e83bfbce571e9ba895670a359f08a6ff55f) | Copia de su frontend en Chrome y código publicado; referencia original sin modificar |
| Nuestra actual | D:/ares-bot, versión coherente 1.0.0 | Frontend en Chrome, fuentes, pruebas y evidencia de entrega local detalladas en REVISION-PREVIA-AL-PUSH.md |

La beta avanzó desde `5aff5b5` (v3.0, informe anterior) mediante **nueve commits, 55 archivos cambiados, 12 414 inserciones y 159 eliminaciones**. El árbol fijado contiene 143 archivos. Se inspeccionaron las áreas de preview, voz, chat, router, swarm, benchmarks, CI/CD, memoria y automatización Git; esto no constituye una auditoría exhaustiva de sus 143 archivos ni de su despliegue remoto.

La comparación anterior sigue siendo histórica; no debe usarse como si hubiera evaluado v3.9. La etiqueta visual de nuestra versión anterior decía v1.0 aunque su paquete frontend era 0.2.0. Nuestra versión actual unifica los metadatos; los números de versión de ambos repositorios no son una escala común de calidad.

## Diferencias visibles comprobadas

Chrome, misma sesión de comparación, movimiento reducido, escritorio 1440 × 1000 y móvil 390 × 844. Las interfaces son las de cada fuente; **las APIs y datos se simularon** para no usar claves ni historial. No se enviaron órdenes a modelos ni se activó el micrófono. Ninguna de las tres interfaces produjo errores JavaScript de página en este recorrido.

| Medida inicial | Beta v3.9 | Nuestra anterior | Nuestra actual |
| --- | ---: | ---: | ---: |
| Entrada completamente visible, escritorio | Sí | No | Sí |
| Entrada completamente visible, móvil | Sí | No | Sí |
| Ancho de entrada, móvil | 65,6 px | 302 px, fuera de la primera pantalla | 320 px |
| Controles fuera del ancho móvil | 6 | 0 | 0 |
| Posición vertical de entrada, escritorio | 926 px | 1498 px | 859 px |
| Posición vertical de entrada, móvil | 778 px | 1869 px | 704 px |

Las posiciones describen esta captura inicial; no significan que la consola anterior no permita escribir después de desplazarse. No son pruebas de teclado físico ni una garantía para todos los dispositivos.

Nuestra anterior mostraba voz, conversación, historial, proyecto y memoria antes de llegar al campo. La actual agrupa esos controles bajo demanda y compacta el avatar en móvil. La beta tiene un lenguaje visual más cercano a un HUD de juego, con telemetría y más herramientas inmediatas; su cabecera y su fila de controles siguen recortándose en móvil. Elegir una estética es una preferencia; el recorte y las dimensiones sí son observaciones.

## Comparación funcional

| Área | Beta v3.9 | Nuestra anterior | Nuestra actual |
| --- | --- | --- | --- |
| Conversación | Modos, SSE, dictado y TTS | SSE, ARES/okey, transcripción, TTS y notas opcionales | Conserva lo anterior; acumula finales/provisionales, coordina cancelación, añade medidor opcional y limpieza comprobada |
| Avatar | 3D/2D y roles visuales | 16 poses automáticas y movimiento | Conserva identidad; estados reales de voz, pausa fuera de vista y metadatos POSE al final sin filtrarlos a la voz |
| Resultados | Mensajes enriquecidos y modales especializados | Biblioteca y módulos separados | Documento, Mermaid, código/diff y origen junto al mensaje; discutir conserva contenido, proyecto y borrador |
| GitHub | Auditoría pública; el lector anterior no cambió en estos nueve commits | Sin el nuevo lector contextual | Commit fijo, selección explícita, cobertura, huellas y fuentes; PR público limitado a archivos elegidos del head |
| Preview | HTML y sintetizadores de demos; se reprodujo sustitución de fuentes y un fallo Vue | Sin el nuevo workbench | Compilación real HTML/CSS/JS/TS/Vue con dependencias cerradas; edición 17→999 modifica la ejecución |
| ZIP | Extracción heurística y scaffolding adicional | Exportaciones de mensajes/documentos | Fuentes revisadas, salida, manifiesto y licencias de la misma versión; hashes y CRC verificados |
| DDD | Forge, radar, generadores y ejemplos | AST de dependencias y ciclo propuesta/diff/aplicar/restaurar | Conserva lo anterior; caso Pedidos/Inventario con puertos, ADR, seis pruebas y mutación de una invariante |
| Memoria | SQLite y vectores locales 128D por hashing de términos/trigramas | RAG PostgreSQL/pgvector 768D con Gemini | Conserva trazabilidad, citas y exclusión de código obsoleto; no añade embeddings offline |
| Modelos | Clasificación por reglas y fallback entre proveedores | Gemini para documentación y OpenRouter para código | Misma política explícita, con modelo efectivo visible, contador y límites; no añade fallback cruzado automático |
| Swarm | Roles coordinados mediante una llamada al modelo en el flujo examinado | Sin enjambre | Sin enjambre autónomo; las herramientas no se sustituyen por un supuesto consenso |
| CI/CD y rendimiento | Plantillas, simulador de pipeline y reportes k6/Stryker prefijados | CI, ejecución aislada, respaldos y mediciones de tareas | Conserva pruebas reales; añade producción, equivalencia ZIP/vista, contenedor de entrega y línea base local |
| CLI/MCP | CLI/REPL y servidor MCP propios | Sin los nuevos adaptadores de nuestra versión | API existente, proyecto fijo, fuentes y roles; lectura por defecto, propuestas optativas, sin aplicar/ejecutar/publicar desde esos adaptadores |
| Git y cambios | Automatización Git con procesos implementada; no se ejecutó en esta revisión | Diff, aplicación/restauración, commits y PR con revisión | Conserva controles y recuperación; publicación sigue siendo explícita |
| Entrega | UI 3.9, bienvenida 3.1 y lockfile frontend 2.6 en el commit fijado | Etiqueta UI y versión de paquete diferentes | Versiones 1.0.0 coherentes, configuración persistente en contenedor y ZIP limpio reproducible |

El análisis estático del lector y de la voz de la beta conserva los límites registrados en la revisión v3.0 porque esos archivos no cambiaron. No se repitió aquí un micrófono físico ni una auditoría completa de repositorio con su backend.

## Qué comprobaron los ensayos de la beta

Se transformó su TypeScript y se ejecutaron únicamente los módulos seleccionados en un contenedor de solo lectura, sin red ni claves. Las dependencias de IA y los temporizadores se sustituyeron por dobles controlados. **No se ejecutó su backend sobre la base del usuario ni se invocó Git remoto.**

1. **Preview de café:** dos fuentes distintas, con valores 17 y 999 y marcadores diferentes, produjeron el mismo HTML; el marcador del fuente no apareció. El selector devuelve una demo por palabras clave. Un ejemplo Vue con Options API generó JavaScript con `Unexpected token '{'`. Son casos concretos reproducidos, no una afirmación de que todo HTML falle. [Selector](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/frontend/src/services/preview-compiler.service.ts#L40).
2. **Benchmarks:** sin aportar archivos de un proyecto se obtuvieron cuatro E2E aprobados, MSI 83,3 %, 2450 solicitudes y p95 54,1 ms. El módulo construye esos valores; no ejecutó Stryker ni k6. Puede servir como demostración o generador de scripts, pero no acredita resistencia o rendimiento del proyecto. [Simulación E2E](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/benchmark.service.ts#L323), [carga prefijada](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/benchmark.service.ts#L445).
3. **Pipeline:** completó 14 actualizaciones y terminó en success con temporizadores controlados, sin desplegar nada. Sus funciones lo denominan simulación. La interfaz también contiene un mensaje de «rollback ejecutado» que debe mantenerse claramente separado de un rollback real. [Simulador](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/cicd.service.ts#L698).
4. **Fallback:** clasificar DDD sí seleccionó su categoría y modelo declarados. Al simular un fallo Gemini en una consulta con imagen, pasó a OpenRouter pero no conservó los bytes de imagen: el conversor solo construye texto. Al fallar todos los proveedores, la respuesta local devolvió proveedorUsado=gemini y modeloUsado=ares-local-sentinel. No se probaron modelos reales ni precios. [Conversión](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/ai-router.service.ts#L419), [respaldo local](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/ai-router.service.ts#L399).
5. **Consenso:** una única respuesta sintética sin veredicto produjo «APROBADO 100% PARA DESPLIEGUE». Es un valor por defecto, no revisión independiente ni evidencia de pruebas. La bienvenida también muestra un distintivo de consenso antes de iniciar una misión. [Valor por defecto](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/swarm.service.ts#L221).

La memoria vectorial local sí es una implementación de hashing/cosenos y aporta funcionamiento offline. No equivale automáticamente a un modelo semántico entrenado. Nuestra alternativa usa embeddings de Gemini y depende de disponibilidad/cuota para generarlos y consultar; no la presento como gratuita u offline. [Vectorización beta](https://github.com/AI-Innovation-op/ARES/blob/5588570a66786d380eefb5ddbadd71c8235ff1d5/backend/src/services/memory.service.ts#L162).

## Evidencia de nuestra evolución

- Nuestra base publicada tiene un [CI histórico satisfactorio](https://github.com/AI-Innovation-op/A.R.E.S/actions/runs/40416713710) asociado exactamente a bd7c1e8; se confirmó su estado completed/success.
- La versión local pasó 81 pruebas backend, 86 frontend, 45 SQL, dos de aislamiento Docker y seis del caso DDD, además de recorridos Chrome y entrega limpia. Los grupos y sus límites están en [REVISION-PREVIA-AL-PUSH.md](REVISION-PREVIA-AL-PUSH.md); no se repitió toda esa batería solo para tomar capturas.
- En esta comparación se recuperaron los cinco archivos publicados de `examples/pedidos` que faltaban en la carpeta fuente. Sus tres pruebas pasaron. Se amplió el inventario para mostrar también archivos ausentes respecto de la base: ahora informa cero ausentes. Esto evita que una entrega omita silenciosamente el ejemplo anterior.
- El CI de nuestra nueva versión sigue pendiente de push autorizado. La consulta de GitHub devolvió cero runs para el SHA beta fijado; eso no demuestra ausencia de pruebas manuales ni de otras revisiones.
- Gemini/OpenRouter fueron probados realmente en la continuación anterior con consultas sintéticas. En esta comparación no hubo llamadas reales. El contenido generado sigue necesitando revisión: no se certifica exactitud semántica.

## Qué queda y qué no se añadió

El plan local acordado está completado y revisable. Siguen pendientes la prueba física final de voz contigo, la cuota de Google Search y el primer CI remoto tras el push conjunto. Publicar el código no despliega el servicio.

Las funciones adicionales de la beta no se copiaron automáticamente. Un router con fallback debería conservar capacidad de imagen/búsqueda, atribución, elección de proveedor y límites de coste; una suite k6/Stryker debería ejecutar herramientas sobre archivos fijados; un enjambre debería aportar ejecuciones y revisiones independientes antes de anunciar consenso. Son ampliaciones separadas, no capacidades actuales de nuestra consola ni requisitos ya cumplidos por mostrar sus nombres.

No se añadió una pantalla permanente de comparación al producto: la consola conserva su navegación limpia. El visor local permite alternar escritorio/móvil y ampliar las seis capturas; es documentación de revisión, no una nueva función del asistente.

## Archivos de evidencia locales

Se excluyen de publicación: `.local-setup/comparison-three/ui-evidence.json`, sus seis capturas, `comparison-beta-controlled.json`, `comparison-swarm-controlled.json` y las copias temporales de inspección. El inventario de entrega y su ZIP se regeneran después de este informe. Los hashes de GitHub anteriores fijan las conclusiones; futuras actualizaciones de la beta requieren otra comparación.
