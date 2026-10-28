import type { ChatReply, Provider } from "../../chat/domain/chat.js";

export const formats = {
  documentation: [
    "README.md",
    "ADR",
    "RFC",
    "OpenAPI 3.1",
    "Docstrings",
    "Nota de conversación",
  ],
  audit: [
    "Auditoría SOLID",
    "Seguridad",
    "Complejidad Big-O",
    "Refactorización",
  ],
  architecture: [
    "DDD + Hexagonal",
    "Contextos delimitados",
    "Modelo de dominio",
    "Clean + Hexagonal",
    "Arquitectura modular",
    "Modelo de datos",
    "Decisión ADR",
  ],
} as const;
export type ModuleId = keyof typeof formats;
import type {
  Project,
  Artifact,
  ArtifactInput,
  ArtifactPage,
} from "../../../../../packages/contracts/index.js";
export type {
  Project,
  ArtifactSummary,
  Artifact,
  ArtifactInput,
  ArtifactPage,
} from "../../../../../packages/contracts/index.js";
export interface LibraryRepository {
  projects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  list(
    projectId: string,
    module?: ModuleId,
    before?: number,
  ): Promise<ArtifactPage>;
  read(id: string): Promise<Artifact>;
  prepare(input: ArtifactInput): Promise<Artifact | undefined>;
  commit(
    input: ArtifactInput,
    reply: ChatReply & { provider: Provider; model: string },
  ): Promise<Artifact>;
}

export function modulePrompt(input: ArtifactInput): string {
  const guidance =
    input.module === "architecture"
      ? "Usa DDD + Hexagonal como punto de partida. Identifica lenguaje ubicuo, contextos delimitados, agregados e invariantes con ejemplos del negocio; distingue hipótesis de hechos. Separa dominio, aplicación y adaptadores; los DTO/ORM no deben dictar el dominio. Justifica relaciones entre contextos, transacciones y decisiones ADR. No conviertas cada carpeta en un servicio ni añadas patrones sin necesidad. Propón primero límites y responsabilidades, después carpetas."
      : input.module === "audit" && input.format === "Refactorización"
        ? "Devuelve una única versión completa del archivo refactorizado en un bloque de código con su lenguaje, sin omitir líneas con puntos suspensivos. Explica los cambios y límites fuera del bloque. Es una propuesta no aplicada."
        : "";
  return `Solicitud del módulo ${input.module}.\nTipo de entrega: ${input.format}.\nTítulo: ${input.title}.\nEntrega un borrador en Markdown (OpenAPI 3.1 en YAML cuando corresponda), sin indicador de pose. Explica supuestos y limitaciones. No afirmes haber ejecutado ni medido el código. No inventes detalles ausentes del contexto.\n${guidance}\n\nContexto aportado por el usuario:\n${input.context}`;
}
export function documentType(input: ArtifactInput): string | undefined {
  if (input.module === "architecture" && input.format === "Decisión ADR")
    return "ADR";
  if (input.module !== "documentation") return undefined;
  return (
    {
      "README.md": "README",
      ADR: "ADR",
      RFC: "RFC",
      "OpenAPI 3.1": "OPENAPI",
      Docstrings: "DOCSTRINGS",
    } as Record<string, string>
  )[input.format];
}
