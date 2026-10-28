# Beta ARES 4.0 y nuestra siguiente entrega

Revisión del 27 de octubre de 2026. Referencia fija hasta nuevo aviso de Kevin: [`614bee1fc69102e191177a73e565f5259799e151`](https://github.com/AI-Innovation-op/ARES/tree/614bee1fc69102e191177a73e565f5259799e151). Nuestra publicación sigue siendo otro repositorio, `AI-Innovation-op/A.R.E.S`; las fuentes locales continúan en versión 1.0.0 antes de revisar el push.

## Qué cambió realmente

La [comparación con 3.9](https://github.com/AI-Innovation-op/ARES/compare/5588570a66786d380eefb5ddbadd71c8235ff1d5...614bee1fc69102e191177a73e565f5259799e151) devuelve dos commits y dieciocho archivos cambiados. La CLI declara `@ares-ecosystem/cli` 4.0.0, binario `ares`, REPL existente, instaladores actualizados y un nuevo asistente `wizard.ts` de 321 líneas. Añade empaquetado JSZip, selección de stack/equipo/destino y preguntas para Git/push. También incorpora un workflow de Pages, una suite de regresión y cambios de versión/documentación.

La captura enviada por Kevin muestra una terminal real conectada y la respuesta a `help`. Es evidencia de ese recorrido; no prueba por sí sola la ejecución de cada orden. El encabezado del catálogo aún menciona 3.9: es una etiqueta desactualizada dentro de la release 4.0.

Los servicios centrales de preview, benchmark, pipeline, router y swarm no cambian en esos dos commits. Los ensayos anteriores documentados en [COMPARACION-TRES-VERSIONES.md](COMPARACION-TRES-VERSIONES.md) siguen vinculados al código y commit que se ejecutaron. Las capturas antiguas se conservan con su etiqueta 3.9; no se presentan como una nueva ejecución de 4.0.

## Hallazgos nuevos de revisión de código

Estos puntos son análisis estático, no una explotación ni ejecución del instalador o wizard:

| Lugar | Hallazgo y corrección necesaria en la beta |
| --- | --- |
| `cli/src/wizard.ts`, entrada | Lee el portapapeles antes de preguntar si se utilizará. Conviene pedir la elección antes de acceder y mostrar el contenido elegido antes de enviarlo. Lee PDF como UTF-8: eso no acredita extraer su texto. |
| `wizard.ts`, escritura | Usa `path.join(destino, a.ruta)` y `writeFileSync` con rutas recibidas del servidor, sin comprobar contención ni rechazar sobrescritura. Validar rutas, enlaces, colisiones y destino; preparar una revisión antes de escribir. |
| `wizard.ts`, Git | Interpola rama, archivos, autor, mensaje y remoto en `execSync`. Las comillas no sustituyen argumentos sin shell. Usar spawn/execFile con argumentos validados, `--` cuando corresponda y comprobación de cada resultado. |
| `wizard.ts`, comprobantes | Captura fallos de commit y aun así anuncia el total planificado como creado y firmado. `--author` establece atribución, no firma criptográfica. Informar SHA/estado de cada commit realmente creado; comprobar firmas si se anuncian. |
| `test-regression-v4.0.mjs` | Verifica respuestas y catálogos, pero no demuestra que benchmark ejecute Stryker/k6, que cuatro agentes hagan trabajo independiente ni que exista CI remoto aprobado. Las órdenes CLI contienen rutas absolutas `D:/ares-ecosystem`. |
| Suite, salida de proceso | Cuando alguna prueba falla solo imprime verificación parcial; `main().catch(console.error)` tampoco establece salida distinta de cero. Debe propagar un exit code de fallo para que CI pueda detectarlo. |

La suite se leyó, no se ejecutó contra el backend privado del usuario. No se abrió su portapapeles, ejecutó Git remoto ni instaló globalmente la beta. Estos cambios de CLI no acreditan resolver los límites centrales encontrados antes.

## Lo incorporado a nuestra versión

La terminal propia ya es un proceso interactivo: `npm run terminal` o `ares-terminal.cmd`. Verifica la identidad de nuestra API, comparte permisos/roles y muestra streaming real. Tiene modo manual y reglas automáticas optativas; documentación va a Gemini, código/auditoría/arquitectura a OpenRouter. La elección de modelo sigue siendo configuración del backend; no se presume disponibilidad por el nombre del modelo.

Permite elegir proyecto, guardar/recuperar conversaciones, leer un archivo habilitado, enviarlo explícitamente a auditoría y analizar imports DDD. La ejecución prepara comando/aislamiento/huella antes de pedir `confirm`; usa el ejecutor existente, Docker por defecto. No ofrece shell arbitrario. Compila un JSON elegido y exporta la misma versión con SHA-256 a un ZIP nuevo; nunca sustituye silenciosamente esas fuentes por una demo.

No se incorporaron el wizard beta ni su escritura/Git automático. La web conserva revisión de diffs, aplicación y publicación. No añadimos cifras de benchmark ni una etiqueta multiagente para representar trabajo que no se ejecutó. La separación entre propuesta, compilación, ejecución y resultado confirmado sigue siendo parte de la interfaz.

## Evidencia y revisión pendiente

La regresión y la integración de la terminal se detallan en [REVISION-PREVIA-AL-PUSH.md](REVISION-PREVIA-AL-PUSH.md). El proceso REPL se comprobó con API HTTP, PostgreSQL temporal, tres pruebas reales de Pedidos dentro de Docker, auditoría con fuente elegida, compilador y ZIP. En esa integración el modelo se simula; una llamada sintética independiente confirmó Gemini por streaming sin archivos privados ni historial persistente. No se ejecutó esta suite contra la beta.

Revisar ahora la terminal y la consola con Kevin. Después decidir push y comprobar CI remoto. El micrófono/altavoz físicos y la calidad de las respuestas necesitan aceptación humana; Google Search conserva su último 429 de cuota. No se hizo push ni despliegue en esta continuación.
