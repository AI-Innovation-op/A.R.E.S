# A.R.E.S. — consola de ingeniería

Versión **1.0.0**, actualizada el 27 de octubre de 2026. La ficha maestra v2.6 define el producto; [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) registra lo implementado y sus límites. [CONTINUIDAD-LOCAL.md](CONTINUIDAD-LOCAL.md) registra esta evolución y la autorización de publicación. Consulta [GitHub Actions](https://github.com/AI-Innovation-op/A.R.E.S/actions/workflows/ci.yml) para el resultado remoto del commit que descargues. El despliegue público es una decisión posterior.

La [comparación de tres versiones](COMPARACION-TRES-VERSIONES.md) distingue beta v3.9, nuestra base publicada y esta implementación, con medidas de interfaz y pruebas controladas. El ejemplo sintético publicado `examples/pedidos` se conserva junto a los casos DDD posteriores.

La [revisión de la beta 4.0](REFERENCIA-BETA-V4.md) fija la nueva referencia y detalla sus cambios. Nuestra versión incorpora ahora una terminal interactiva propia; los números de versión pertenecen a proyectos distintos.

## Iniciar

Requiere Git, Node.js **24 LTS, mínimo 24.11**, y Docker iniciado para PostgreSQL y las comprobaciones aisladas. En Windows, utiliza Docker Desktop con contenedores Linux. GitHub CLI autenticado es opcional y solo se necesita para publicar ramas/PR desde la consola. Desde PowerShell o una terminal:

```powershell
git clone https://github.com/AI-Innovation-op/A.R.E.S.git
cd A.R.E.S
npm --prefix backend ci
npm --prefix frontend ci
npm run runner:prepare
npm run dev
```

Abre http://127.0.0.1:5175 y conserva la terminal abierta. El iniciador crea `backend/.env` desde la plantilla sin claves, prepara PostgreSQL, aplica migraciones e inicia el backend en el primer puerto propio/disponible entre 3000 y 3010. Configura el proxy de Vite y no detiene otras aplicaciones. `ARES_UI_PORT` cambia el puerto de interfaz; añade su origen a `CORS_ORIGINS`. PostgreSQL necesita el puerto local 5432 libre; si otra instalación ya lo utiliza, configura otro puerto en Compose y DATABASE_URL antes de arrancar.

Configura Gemini y OpenRouter desde **Conexiones IA**. En Node las claves se guardan en `backend/.env`, excluido del control de versiones y de las imágenes Docker; en Compose los ajustes editados se conservan en el volumen privado `ares_settings`. Son archivos locales de texto, no un almacén cifrado. El modelo de Gemini debe estar disponible en tu proyecto; OpenRouter muestra su catálogo y permite elegir un modelo gratuito. La disponibilidad y las cuotas dependen de cada proveedor. “Backend conectado” confirma conectividad, no saldo ni cuota.

Sin DATABASE_URL puede usarse chat de sesión con límites de consumo en memoria. Si hay una base configurada pero está caída, las operaciones con contador persistente se bloquean hasta recuperarla, para no perder los límites. `ARES_SKIP_DATABASE=1` omite la preparación automática de Docker.

Con la consola iniciada, abre otra terminal y ejecuta **`npm run terminal`**; en Windows también puedes abrir **`ares-terminal.cmd`**. Escribe `help`, `status` y `mode auto` para empezar. Incluye conversación progresiva, selección de proyecto e historial, lectura/auditoría, DDD estático, scripts revisados antes de confirmar su ejecución y preview/ZIP. Consulta [CLI-Y-MCP.md](CLI-Y-MCP.md) para comandos, acceso y límites. No reemplaza la instalación global de la beta.

## Capacidades

| Área | Uso |
| --- | --- |
| Consola y avatar | Chat con respuesta progresiva, Gemini para documentación y OpenRouter para programación; avatar voxel 3D con 16 poses, paseo, arrastre y alternativa 2D |
| Historial | Conversaciones por proyecto, paginación, exportación y reintentos sin duplicar turnos; las respuestas parciales no se confirman como mensajes completos |
| Biblioteca | Documentación, auditoría y arquitectura; edición con revisión, aprobación y eliminación; diagramas Mermaid locales saneados |
| Memoria | Documentos y hasta 50 archivos de código seleccionados por proyecto; embeddings Gemini de 768 dimensiones y citas persistentes; excluye archivos que cambiaron hasta reindexarlos |
| Repositorio | Carpetas habilitadas, exploración UTF-8, archivos hasta 64 KB, huellas SHA-256 y adjuntos explícitos al chat |
| Cambios | Propuesta individual o conjunto de hasta cinco archivos, incluidos nuevos en carpetas existentes; revisar diff, aplicar, restaurar y ejecutar check opcional |
| Git | Inicialización por botón, selección de archivos, commit local, ramas, remoto GitHub y publicación explícita de rama con PR borrador |
| Documentos y Git | Biblioteca → propuesta Markdown/YAML sin llamada IA → revisión y aplicación → commit seleccionado |
| Multimodal | PNG/JPEG/WebP hasta 4 MB, búsqueda Gemini con Google Search, dictado del navegador o grabación Gemini de hasta 30 segundos/2 MB, lectura en voz alta |
| Bio-Armadura | Opcional y desactivada por defecto: foco, pausas, agua, pausa/reanudación persistida y avisos autorizados; sin inferir fatiga ni recopilar cámara/teclado |
| Continuidad | Respaldos PostgreSQL, recuperación en base nueva, verificación de estructura/datos, retención y programación con el servidor abierto |
| Acceso y consumo | Invitaciones de un uso, sesiones de siete días, roles, revocación, renovación de sesión y límites diarios/concurrentes |
| Resultados | Documento, Mermaid, código, diff y origen junto al chat; guardar notas confirmadas y discutir sin perder fuentes ni reemplazar el borrador |
| GitHub público | Commit fijo, selección de archivos, exclusiones y cobertura; PR con cabecera fija, sin comparación completa de la base ni comentarios automáticos |
| Preview y ZIP | Fuentes estructuradas, compilación real HTML/CSS/JS/TS/Vue, vista aislada y exportación de fuentes/salida/manifiesto/licencias con huellas; versiones temporales |
| Paleta | Ctrl+K o botón de acciones; abre recorridos reales sin activar micrófono, generar propuestas ni lanzar procesos automáticamente |
| Terminal | REPL en español, SSE, modos manual/automático, historial por proyecto, lectura/auditoría, DDD, scripts preparados y confirmados por huella, preview/ZIP; sin push |
| CLI JSON y MCP | API con proyecto fijo y permisos existentes; lectura por defecto y propuestas/IA optativas, sin aplicar/ejecutar/publicar desde estos dos adaptadores |

La [guía desde cero](GUIA-DESDE-CERO.md) incluye los pasos de voz, GitHub y preview. [CLI-Y-MCP.md](CLI-Y-MCP.md) contiene la configuración de adaptadores. El caso [DDD Pedidos e Inventario](examples/ddd-acceptance/README.md) tiene reglas ejecutables y ADR, además de una comprobación que detecta quitar la invariante del pedido vacío (`npm run test:acceptance`). `npm run check:versions` comprueba metadatos; `npm run review:release` prepara un inventario local y busca coincidencias de credenciales antes de revisar una publicación.

Los archivos, documentos, páginas y salidas se tratan como datos no confiables, no como instrucciones del sistema. El modelo propone y analiza; los botones del usuario inician las escrituras, comprobaciones y publicaciones. El prompt unificado está en `backend/prompts/ares-system-prompt.md`.

## Datos y recuperación

`npm run db:up` prepara PostgreSQL 16 con pgvector. El maestro `database/schema.sql` se aplica solo a bases vacías; las migraciones de `database/migrations` se ejecutan en orden, con transacción, bloqueo y checksum. No edites una migración ya aplicada: añade otra. El SQL en la raíz se conserva como referencia y no se aplica.

El volumen de Compose terminado en `_ares_postgres` conserva los datos al detener Docker. El prefijo depende del nombre del proyecto de Compose o de la carpeta. No uses `docker compose down -v` si quieres conservarlos.

Desde **Respaldos** puedes crear y verificar copias. Los comandos de la raíz son:

```powershell
npm run backup:create
npm run backup:list
npm run backup:verify -- UUID
npm run backup:recover -- UUID
```

`recover` crea una base nueva: nunca reemplaza la activa. Revisa esa base y cambia DATABASE_URL manualmente si decides usarla. Cada copia consta de `.dump` y manifiesto `.json`, ambos necesarios. Se verifica SHA-256, restauración temporal y comparación de datos/estructura. Windows guarda en `.local-setup/backups`; Compose utiliza `ares_backups`. Conserva también una copia externa del disco. Los respaldos contienen datos del proyecto, incluidos registros de acceso, y necesitan almacenamiento privado; no incluyen `.env` ni las carpetas originales de código.

Configuración: `ARES_BACKUP_ENABLED`, `ARES_BACKUP_INTERVAL_HOURS` (24), `ARES_BACKUP_KEEP` (7), `ARES_BACKUP_DIR`, `ARES_PG_BIN`. La programación funciona únicamente con el backend abierto y recupera copias pendientes al arrancar.

## Repositorio y ejecución

Un administrador conecta carpetas dentro de `ARES_WORKSPACE_ROOTS` (rutas absolutas separadas por `;`). El modo local usa por defecto la raíz de A.R.E.S. Al compartir, la carpeta de instalación del servidor y sus antecesores quedan protegidos: usa una raíz externa para proyectos del equipo. Se excluyen credenciales, `.env`, enlaces físicos/simbólicos, dependencias y salidas generadas. La redacción de secretos conocidos es una defensa adicional; revisa los archivos antes de enviarlos a proveedores.

Los conjuntos admiten cinco archivos de hasta 64 KB y 128 KB de contexto total. Los nuevos necesitan una carpeta padre existente. El servidor calcula el diff y comprueba las huellas antes de escribir. La aplicación es archivo por archivo; una interrupción queda pendiente y permite completar o restaurar. Si hay ediciones posteriores, se conservan y se muestra un conflicto. No se describe como una transacción atómica del sistema de archivos.

`ARES_RUNNER_MODE=docker` es el valor predeterminado. Ejecuta una vez `npm run runner:prepare` para construir `ares-check-runner:1`. No hay sustitución automática por ejecución local si Docker falla.

Las comprobaciones copian únicamente archivos de texto permitidos a un directorio temporal (hasta 1000 archivos, 50 MB y 20 niveles; 5 MB por archivo dentro de la copia). Excluyen binarios, Git, `.env`, carpetas generadas y node_modules. Los secretos reconocidos se redactan y se informa cuántos archivos cambiaron. El resultado describe esa copia, que puede diferir del proyecto completo.

El contenedor de ejecución no tiene red ni carpetas del host montadas; usa usuario sin privilegios, raíz de solo lectura, 1 CPU, 1 GB y 128 procesos. El script dispone de 90 segundos y espacio temporal limitado. Su salida se recorta a 16000 caracteres. Las modificaciones quedan en la copia, no en el original. Docker reduce la exposición, pero no convierte esta instalación en un servicio público para ejecutar código de desconocidos.

Si hay dependencias, se exige package-lock.json v2/v3 con integridad y paquetes públicos de registry.npmjs.org. Una preparación separada recibe solo manifiesto y lockfile, tiene red para descargar dependencias y omite scripts de instalación. Se limita a tres minutos y almacena una caché por hash en volúmenes `ares_deps_*`; al ejecutar el proyecto esa caché es de solo lectura. Git/URLs privadas, paquetes locales, workspaces npm y paquetes que necesiten scripts de instalación no están soportados por este ejecutor. Las cachés permanecen en Docker hasta que el propietario las retire.

`ARES_RUNNER_MODE=local` es una alternativa explícita para proyectos de confianza: usa los permisos del backend y no aísla red/archivos. Se bloquea en modo compartido. En Windows, un Job Object controla todos los procesos descendientes, incluso si se cancela durante el arranque. Las comprobaciones, su comando y su resultado se conservan en PostgreSQL; el modelo solo recibe las que adjuntes.

## Git y publicación

La carpeta debe tener su propio `.git`; los worktrees enlazados y merge/rebase pendientes requieren Git externo. El commit utiliza un índice temporal, verifica la revisión anterior y conserva archivos preparados que no seleccionaste. Las credenciales y archivos no compatibles no pueden seleccionarse desde la consola.

Un administrador puede configurar un remoto HTTPS de GitHub. Para publicar necesita autenticación local mediante GitHub CLI y una rama de trabajo limpia. La consola exige revisar destino, rama, historial, base y descripción antes de enviar. Crea un PR borrador; no fusiona ni despliega. Se verificó también el servicio real de publicación con un ejemplo sintético: [PR borrador #1](https://github.com/AI-Innovation-op/A.R.E.S/pull/1). Tras autorización se creó el README inicial de main; el ejemplo se publicó en una rama separada, sin código privado de la aplicación.

## Compartir un espacio

**Acceso y consumo** mantiene el modo local por defecto; `HOST` debe ser loopback. Para activar acceso compartido, prepara un código de recuperación, guárdalo privadamente y confirma el botón de activación. La interfaz actual conserva una sesión administrativa. Esta acción no publica el servidor.

Las invitaciones contienen 256 bits aleatorios, se guardan como hash, caducan en 24 horas y admiten un uso. La sesión dura siete días, con cookie HttpOnly/SameSite=Strict y Secure bajo HTTPS. No se guardan tokens en localStorage. El administrador puede revocar accesos o generar **Renovar sesión** para una cuenta existente: conserva su identidad y preferencias. No puedes quitarte tu propio rol desde la sesión actual.

| Rol | Permisos |
| --- | --- |
| Administrador | Proveedores, accesos, consumo, respaldos, conexión de carpetas y publicación Git, además de edición |
| Editor | Proyectos, conversación, documentos, propuestas, memoria, commits/ramas y comprobaciones Docker |
| Lector | Consultar el espacio compartido y administrar sus propios recordatorios Bio |

Los proyectos, conversaciones y archivos pertenecen al espacio común; no hay proyectos privados por usuario. Los editores son personas de confianza con capacidad de modificar el código del equipo. Bio-Armadura pertenece a cada identidad. Las escrituras comprueban origen y permisos en el servidor, no solo en la interfaz.

Si pierdes acceso, ejecuta **en una terminal privada del servidor** `npm run access:recover` y usa el código de administrador que muestra. Fuera de localhost, el canje de invitaciones exige un origen HTTPS permitido en CORS_ORIGINS. Usa un proxy TLS de confianza; no expongas Vite como servidor público. La interfaz compilada puede servirse desde el propio backend con `ARES_SERVE_FRONTEND=true` y `backend/public`.

Compose construye interfaz y backend juntos, publica solo `127.0.0.1:3000` y fuerza modo compartido. No se ha desplegado públicamente:

```powershell
docker compose up --build -d
docker compose exec backend node dist/modules/access/recover-cli.js
```

Si el puerto 3000 está ocupado, cambia el mapeo de Compose y los orígenes autorizados. No detengas servicios ajenos. Configura las claves en el `.env` del host y recrea el contenedor para persistir cambios: `env_file` no monta un archivo editable en él. La imagen no recibe el socket Docker ni carpetas del host; su ejecutor Docker permanece indisponible. Para comprobar proyectos usa la instalación Node del host con Docker Desktop. No montes el socket como atajo de aislamiento.

Los límites predeterminados son 500 operaciones IA diarias del espacio, 200 por usuario, 2 MB de entrada total y dos simultáneas; se modifican en **Acceso y consumo**. Incluyen generaciones, embeddings y medios, también los fallidos. Reservas SQL serializadas evitan excederlos con llamadas concurrentes; el día cambia a las 00:00 UTC. Son límites de operaciones de A.R.E.S. y bytes de entrada, no dinero ni tokens facturados. No incluyen consultas de configuración/catálogo ni otros usos de la misma clave fuera de A.R.E.S. Los proveedores pueden aplicar cuotas adicionales.

## Validación y límites externos

```powershell
npm --prefix backend test
npm --prefix backend run test:db
npm --prefix frontend test
npm --prefix frontend run test:e2e
npm --prefix frontend run test:e2e:db
npm --prefix frontend run test:access
npm run test:isolation
npm --prefix backend run build
npm --prefix frontend run build
```

Las pruebas SQL usan exclusivamente `ares_test` local; las pruebas de proveedores usan respuestas sintéticas. Chrome usa puertos 5174/3101/3102 o 5176/3103 y no captura el micrófono real. `test:isolation` usa contenedores y una dependencia pública para comprobar límites reales de ejecución. Ejecuta los grupos Chrome uno tras otro.

Antes de ejecutar las pruebas SQL por primera vez, inicia PostgreSQL con `npm run dev` o crea `backend/.env` desde `.env.example` y ejecuta `npm run db:up`. Detén los servidores de pruebas de otra terminal para evitar colisiones. La cuenta de pruebas necesita permiso para crear la base `ares_test`. No dirijas las pruebas a un servidor de producción.

GitHub Actions instala las dependencias desde los lockfiles, ejecuta unitarias y compilaciones en Windows y Linux y comprueba PostgreSQL, Docker y Chrome en Linux. Usa proveedores simulados, sin claves de Gemini/OpenRouter. Las pruebas SQL se ejecutan en serie para que la verificación de respaldos no compita con escrituras de otros tests. Los recorridos Chrome también son secuenciales. Las acciones externas están fijadas a commits; no se despliega ni publica desde CI.

Las comprobaciones reales de proveedores confirmaron streaming Gemini/OpenRouter y análisis de una imagen sintética. Google Search respondió `GEMINI_QUOTA`: queda pendiente repetir esa comprobación cuando haya cuota. La voz requiere compatibilidad y permiso del navegador; el dictado del navegador puede usar servicios en línea y el alternativo envía audio a Gemini. Audio e imágenes no se guardan; el texto que insertes y envíes sí forma parte del historial.

Para repetir solo el transporte real con consultas sintéticas, después de compilar backend y arrancar la consola, ejecuta `node scripts/check-providers.mjs --live`. Usa cuota de Gemini y OpenRouter; no lee proyectos ni guarda conversaciones. Añade `--web` para probar Google Search. Sin `--live` muestra ayuda sin llamadas. Un resultado confirmado acredita streaming, contenido y proveedor esperado; no certifica la exactitud del texto. La evidencia local queda en `.local-setup/real-provider-validation.json`.

`npm run review:package`, después del build backend, revisa las fuentes y genera un ZIP en `.local-setup/delivery`. Incluye manifiesto y hashes; excluye entorno privado, sesiones, datos, respaldos, dependencias instaladas y builds. Comprueba de nuevo cada hash y el CRC/contenido del ZIP. Esta entrega admite fuentes UTF-8; rechaza binarios sin convertirlos. No modifica Git ni publica nada. Conserva el resultado JSON y revisa el ZIP antes de preparar el push.

## Voz en español y primera conversación

Consulta [GUIA-DESDE-CERO.md](GUIA-DESDE-CERO.md). La voz automática se activa desde la consola: lee hasta dos frases de cada respuesta nueva confirmada, con una voz española del navegador, selector y velocidad. El audio se puede detener o silenciar. No relee el historial al recargar ni recita el código o el indicador interno de pose. La matriz de demostración fue retirada de la navegación; las 16 poses se eligen automáticamente desde las respuestas y durante el streaming.

Prompt v1.9: español claro, decisiones con ejemplos y distinción entre propuesta, simulación y acción confirmada. Exige declarar supuestos y no inventar consecuencias de negocio. Admite ayuda cotidiana además de ingeniería. Las comprobaciones reales con Gemini y OpenRouter aclararon límites de acceso y respondieron a solicitudes personales; no se garantiza que un modelo nunca cometa errores. Se verificó síntesis nativa con Microsoft Pablo es-ES mediante eventos de inicio y finalización.

Se eliminaron las tres conversaciones de comprobación anteriores y sus seis mensajes. Las comprobaciones posteriores de modelos usaron el endpoint de sesión sin guardar historial. Se conserva el proyecto y su configuración. Las pruebas automatizadas persistentes usan exclusivamente la base de pruebas.

**Hablemos** permite activar explícitamente el micrófono, despertar con **ARES** y cerrar un turno con **okey**. Muestra la transcripción, admite revisión/cancelación y pausa la captura mientras reproduce su resumen. Se detiene al ocultar la pestaña; no escucha con la aplicación cerrada. Tras 90 segundos de un turno abierto pide revisión en lugar de enviar por silencio. El reconocimiento del navegador puede usar un servicio en línea. La comprobación con micrófono físico depende del usuario; las pruebas automáticas simulan reconocimiento y síntesis.

La casilla de documentación opcional guarda una **Nota de conversación** en Biblioteca mientras se lee la respuesta. El backend comprueba mensaje confirmado, proyecto, propietario y origen; repetir la operación no duplica la nota. No escribe archivos ni ejecuta herramientas. Los accesorios inteligentes todavía no están integrados.

Mermaid permite zoom, paneo por arrastre/teclado, ampliación y exportación del diagrama completo a SVG/PNG; mantiene el saneamiento y rechazo de enlaces activos. El avatar incluye lluvia procedural Matrix y arcos neón disparados por refactorización. Los efectos respetan pausa y movimiento reducido.

Se mantiene Web Speech como voz de esta etapa. Orus sería un proveedor opcional de audio y requeriría llamadas a Gemini TTS; no está integrado ni comprobado en esta instalación. [Documentación de Gemini TTS](https://ai.google.dev/gemini-api/docs/speech-generation).

## Navegación compacta, comparación y DDD

El menú lateral está oculto al iniciar. Ábrelo con ☰; selecciona una sección o ciérralo con Escape. Esas entradas son módulos de la consola, no carpetas creadas en el disco. El explorador de Repositorio muestra únicamente la carpeta que conectes.

En Espada Binaria selecciona Refactorización, pega el código original y describe el cambio. Si la respuesta incluye una única versión completa en un bloque de código, aparece el comparador Monaco Antes/Después. Es de solo lectura y conserva la base de esa generación aunque edites el formulario después. El comparador también muestra las propuestas guardadas de uno o varios archivos en Repositorio. Puedes alternar vista paralela/unificada, ampliar y saltar entre cambios. Los conjuntos muestran un archivo a la vez; el parche de texto sigue disponible. Revisar no aplica cambios: las escrituras necesitan su botón y las comprobaciones del servidor.

Monaco y su worker se sirven localmente y se cargan solo al abrir una comparación. El editor no ejecuta ni envía el código a un proveedor por mostrarlo. La generación de una propuesta sí utiliza OpenRouter y el contenido aportado.

Arquitectura comienza con DDD + Hexagonal y admite Contextos delimitados y Modelo de dominio. Solicita lenguaje ubicuo, agregados, invariantes y límites entre contextos antes de plantear carpetas. La migración 012 cambia el valor inicial para proyectos nuevos; los proyectos existentes conservan sus datos.

**Reglas de dependencia DDD** analiza localmente el AST de hasta 50 archivos JS/TS seleccionados, 64 KB por archivo y 512 KB en total. Comprueba sus huellas antes de leerlos y señala imports desde dominio a capas exteriores, dependencias técnicas del dominio, adaptadores concretos desde aplicación y acceso al dominio de otro contexto. Las capas/contextos se infieren de rutas; los alias son explícitos. Informa sintaxis no soportada, destinos sin capa y dependencias no resueltas. No ejecuta código, no lo envía a IA ni certifica reglas de negocio, dependencias transitivas o arquitectura completa.

`examples/ddd-orders` es un caso educativo con un defecto intencional. La prueba `backend/test/postgres/ddd-flow.test.ts` usa un proveedor simulado, PostgreSQL y Docker reales para recorrer documentación → propuesta → diff → aplicación → tres pruebas aprobadas → restauración. El archivo original del ejemplo se conserva.

## Licencia

MIT, copyright 2026 AI-Innovation-op. Consulta [LICENSE](LICENSE). Las dependencias conservan sus propias licencias. La publicación contiene código y documentación de la aplicación; las credenciales, conversaciones, respaldos y preparaciones locales no forman parte del repositorio.
