export const consoleActions = [
  {
    id: "chat",
    title: "Conversar con A.R.E.S.",
    description: "Abrir la consola y conservar el borrador.",
  },
  {
    id: "documentation",
    title: "Preparar documentación",
    description: "Abrir Escudo Documental para revisar contexto y formato.",
  },
  {
    id: "audit",
    title: "Revisar o refactorizar código",
    description:
      "Abrir Espada Binaria; generar una propuesta requiere otra acción.",
  },
  {
    id: "architecture",
    title: "Diseñar arquitectura DDD",
    description: "Abrir contexto de negocio, agregados e invariantes.",
  },
  {
    id: "library",
    title: "Consultar Biblioteca",
    description: "Abrir documentos y sus revisiones guardadas.",
  },
  {
    id: "workspace",
    title: "Explorar el repositorio conectado",
    description: "Abrir archivos, propuestas y comprobaciones del proyecto.",
  },
  {
    id: "prototypes",
    title: "Preparar preview y ZIP",
    description: "Revisar fuentes antes de compilar y abrir la vista.",
    write: true,
  },
  {
    id: "voice",
    title: "Opciones de voz",
    description:
      "Abrir controles de conversación; el micrófono se activa por separado.",
    write: true,
  },
  {
    id: "github",
    title: "Leer GitHub o un PR público",
    description:
      "Abrir selección de repositorio y archivos, sin iniciar análisis.",
    write: true,
  },
  {
    id: "bio",
    title: "Abrir Bio-Armadura",
    description: "Consultar preferencias de pausas, foco e hidratación.",
  },
  {
    id: "access",
    title: "Ver acceso y consumo",
    description: "Consultar sesión y límites de solicitudes.",
  },
] as const;
export type ConsoleAction = (typeof consoleActions)[number]["id"];
