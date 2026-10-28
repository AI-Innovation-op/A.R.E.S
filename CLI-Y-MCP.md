# CLI y MCP de A.R.E.S.

La terminal interactiva, la CLI JSON y MCP usan la API existente y sus permisos, sin conexión directa a PostgreSQL ni claves de proveedor en el cliente. Las lecturas de código se limitan al proyecto y las carpetas conectadas desde la consola. La terminal admite además leer un JSON elegido explícitamente para compilar un prototipo y guardar su ZIP en un archivo nuevo. El cliente MCP puede recibir contenido del proyecto: configura el proyecto que quieras compartir con ese cliente.

## Terminal interactiva

Con el backend iniciado, abre otra terminal en la raíz:

```powershell
npm run terminal
```

En Windows también puedes abrir `ares-terminal.cmd`. Requiere Node en PATH; `ARES_NODE_BINARY` permite indicar su ruta. El iniciador compila los clientes si cambiaron las fuentes, usando las dependencias locales; no instala paquetes. Busca nuestra API entre 3000 y 3010, comenzando por 3001, y comprueba `service: ares-backend`. Así puede convivir con la beta en 3000 sin reemplazar su comando global `ares`. Para una instalación concreta: `npm run terminal -- --api http://127.0.0.1:3001 --origin http://127.0.0.1:5175`.

```text
help
status
mode auto
route Documenta las reglas de un pedido
Explica un agregado con un ejemplo pequeño
projects
project UUID-DEL-PROYECTO
conversations
read src/orders/domain/order.ts
ddd src/orders/domain/order.ts
audit src/orders/domain/order.ts
run test
confirm HUELLA-MOSTRADA-POR-RUN
runs
preview examples/terminal-preview/sources.json
zip ID-MOSTRADO .local-setup/mi-prototipo.zip
exit
```

Reemplaza UUID, rutas, huella e ID por los valores reales. `help` muestra las órdenes disponibles; no es un intérprete de shell. `run test` muestra comando, directorio, aislamiento y huella del manifiesto. Solo `confirm` con esa huella solicita ejecutarlo. El backend conserva sus controles de permisos, cambios de manifiesto y aislamiento; Docker es el ejecutor predeterminado. Un estado FAILED o salida distinta de cero se informa como fallo. Cancelar intenta detener únicamente la ejecución iniciada por esta terminal.

Sin proyecto, las preguntas usan contexto limitado en memoria y no crean conversaciones persistentes. `project UUID` activa el historial de ese proyecto; `resume UUID` recupera una conversación del mismo proyecto. `new`, `project off`, `clear` y `exit` no borran el historial del servidor. `memory on` habilita RAG explícito; empieza desactivado. No se adjuntan automáticamente archivos.

El modo inicial es programación. `mode auto` activa reglas locales: documentación/README/ficha → Gemini; código, arquitectura y auditoría → OpenRouter. `route` consulta la sugerencia, el modo efectivo y la configuración sin generar ni probar cuota. `mode docs`, `mode code`, `mode audit` o `mode architecture` fijan la elección manual. Al cambiar de proveedor, el contexto de conversación se envía al proveedor elegido; no hay failover silencioso. `audit ruta` fuerza auditoría e incorpora únicamente ese archivo leído por la API.

La respuesta llega por SSE y se confirma al recibir el evento final. `cancel` o Ctrl+C interrumpen la solicitud activa; el fragmento no se incorpora como turno confirmado. Si hay un turno pendiente, `retry` conserva requestId/revisión para recuperar sin duplicarlo. Los metadatos internos POSE se ocultan fuera de código/citas; la salida ajena se limpia de controles de terminal. El historial de órdenes de readline queda solo en memoria.

`preview` compila fuentes estructuradas reales; no genera una aplicación por IA ni ejecuta pruebas de negocio. Su enlace abre la vista aislada temporal del backend. `zip` exporta la misma versión, informa SHA-256 y rechaza sobrescribir el destino. El ejemplo público es sintético: un contador, sin autenticación ni pagos. La terminal no aplica parches ni hace commits, push o despliegues. Esos recorridos siguen disponibles con revisión en la web.

En modo compartido usa el archivo de sesión creado por `login`, descrito abajo: `npm run terminal -- --session-file .local-setup/cli-session.json`. El rol y el origen siguen sujetos al backend. Para otra ubicación del frontend hay que ajustar `--origin` y CORS.

## CLI JSON: preparación

Desde la raíz instala dependencias de backend y frontend, y compila el backend con `npm --prefix backend run build`. El backend debe estar iniciado. La URL predeterminada es `http://127.0.0.1:3001`, con origen `http://127.0.0.1:5175`; ajusta ambos a tu instalación. Esta etapa admite solo conexiones locales y rechaza redirecciones.

```powershell
node backend/dist/interfaces/cli.js projects
node backend/dist/interfaces/cli.js tools --project UUID-DEL-PROYECTO
node backend/dist/interfaces/cli.js artifacts_list --project UUID-DEL-PROYECTO
```

Los parámetros de una acción se reciben como JSON por stdin o por `--input archivo.json`:

```powershell
'{"path":"src/orders/domain/order.ts"}' | node backend/dist/interfaces/cli.js workspace_read --project UUID-DEL-PROYECTO
```

En modo compartido necesitas una invitación del rol apropiado. `login` canjea una invitación y guarda la cookie en un **archivo nuevo**, sin imprimirla. Pasa `{ "name": "tu nombre", "code": "código de invitación" }` por stdin, fuera del historial de comandos, y añade `--session-file .local-setup/cli-session.json`. No pongas el código en argumentos. Utiliza ese mismo archivo con `--session-file` en las acciones siguientes. La sesión queda vinculada al backend y origen elegidos; se revoca desde Acceso y consumo. No sobrescribe archivos existentes.

## MCP por stdio

Ejemplo de configuración para un cliente MCP. Sustituye rutas y UUID; no incluye ninguna clave de proveedor:

```json
{
  "mcpServers": {
    "ares-proyecto": {
      "command": "node",
      "args": ["D:/ares-bot/backend/dist/interfaces/mcp-main.js"],
      "env": {
        "ARES_API_URL": "http://127.0.0.1:3001",
        "ARES_ORIGIN": "http://127.0.0.1:5175",
        "ARES_PROJECT_ID": "UUID-DEL-PROYECTO"
      }
    }
  }
}
```

En modo compartido añade `ARES_SESSION_FILE` con la ruta absoluta del archivo creado por login. No se abre un servidor MCP por HTTP: el transporte es stdio y stdout queda reservado al protocolo.

## Acciones y autorización

Por defecto están disponibles `project_info`, `artifacts_list`, `artifact_read`, `conversations_list`, `conversation_read`, `workspace_files`, `workspace_read`, `workspace_runs`, `proposals_list`, `github_inspect`, `github_pr_inspect` y `github_read`. Las lecturas de documentos/conversaciones rechazan resultados de otro proyecto. Los límites, orígenes y roles del backend siguen vigentes; una sesión lectora no puede saltarlos mediante MCP.

Para habilitar `change_propose`, `github_analyze` y `architecture_check`, añade `--allow-proposals` en CLI o `ARES_ALLOW_PROPOSALS=1` en la configuración MCP. Los dos primeros envían el contenido elegido al proveedor configurado y consumen cuota. `architecture_check` es estático. Generar una propuesta no modifica el archivo. Puedes proporcionar requestId para reintentos idempotentes; conserva los identificadores que devuelve la API.

La CLI JSON y MCP no ofrecen comandos para aplicar, restaurar, ejecutar procesos, publicar comentarios, crear PR o hacer push. La terminal interactiva descrita arriba añade ejecución de scripts preparados y confirmados por huella. La aplicación web conserva la revisión de cambios y publicación. El contenido de archivos, documentos y PR se devuelve como datos no confiables: no autoriza instrucciones incluidas en ellos.

## Revisión de PR

`github_pr_inspect` recibe una URL pública `https://github.com/organización/repositorio/pull/número`. Fija el commit de cabecera, incluso si pertenece a un fork, e informa base, cabecera y lista de cambios (máximo cien). Después elige rutas y usa `github_read`. `github_analyze`, si lo habilitas, revisa esos archivos de cabecera con sus fuentes. **No es una comparación completa base/cabecera, no ejecuta CI y no publica comentarios.** El informe conserva ese límite.

También puedes pegar la URL del PR en **Leer GitHub** de la consola. No se utilizan tokens GitHub ni la sesión de GitHub CLI.

## Evidencia de implementación

Se probó la CLI y el SDK MCP oficial por stdio contra una API Express local de prueba: catálogo, proyecto, lectura de documento y fuentes, sin otra generación. Se verificaron límites de respuesta, origen, vinculación de sesión y ausencia de acciones de aplicación/publicación. Los clientes de escritorio externos requieren su propia comprobación de configuración.

La REPL se probó como proceso real: HTTP → PostgreSQL temporal → lectura con huella → análisis DDD → revisión de script → confirmación → tres pruebas reales en Docker → auditoría con archivo → compilación/ZIP → recuperación de conversación. Esa integración usa un proveedor IA simulado. Por separado, una pregunta sintética de documentación confirmó streaming real de Gemini sin adjuntar archivos ni crear historial persistente. Las pruebas de cancelación, reintentos, roles, modo automático y salida se ejecutan en la suite backend. No se atribuyen pruebas a servicios que no se llamaron.

El adaptador usa el [SDK MCP oficial](https://modelcontextprotocol.io/docs/develop/build-server); su API se contrastó con la versión instalada, no con ejemplos de versiones antiguas.
