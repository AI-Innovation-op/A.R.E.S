export type ModuleId = 'documentation' | 'audit' | 'architecture';
export const modules = {
  documentation: {
    title: 'Escudo Documental', eyebrow: 'AEGIS / DOCUMENTACIÓN',
    description: 'Convierte el contexto de tu proyecto en documentación que protege su futuro.',
    label: 'Contexto, requisitos o código del proyecto',
    placeholder: 'Describe tu proyecto, sus dependencias, cómo se ejecuta y qué debe documentarse…',
    action: 'Forjar documento', pose: 15,
    formats: ['README.md', 'ADR', 'RFC', 'OpenAPI 3.1', 'Docstrings', 'Nota de conversación'],
  },
  audit: {
    title: 'Espada Binaria', eyebrow: 'BINARY / AUDITORÍA',
    description: 'Revisa tu código, identifica riesgos y encuentra un camino claro para refactorizar.',
    label: 'Código y contexto a revisar',
    placeholder: 'Pega el código e indica el lenguaje, el comportamiento esperado y el problema observado…',
    action: 'Analizar código', pose: 11,
    formats: ['Auditoría SOLID', 'Seguridad', 'Complejidad Big-O', 'Refactorización'],
  },
  architecture: {
    title: 'Oráculo de Arquitectura', eyebrow: 'ORACLE / SISTEMAS',
    description: 'DDD con límites de dominio claros, casos de uso y adaptadores: decisiones explícitas antes de crear carpetas.',
    label: 'Requisitos y restricciones del sistema',
    placeholder: '¿Qué estás construyendo? Incluye usuarios, stack, escala esperada y restricciones…',
    action: 'Diseñar arquitectura', pose: 7,
    formats: ['DDD + Hexagonal', 'Contextos delimitados', 'Modelo de dominio', 'Clean + Hexagonal', 'Arquitectura modular', 'Modelo de datos', 'Decisión ADR'],
  },
} as const;

export function modulePrompt(id: ModuleId, format: string, context: string): string {
  const guidance=id==='architecture'?'Usa DDD + Hexagonal como punto de partida. Identifica lenguaje ubicuo, contextos delimitados, agregados e invariantes con ejemplos del negocio; distingue hipótesis de hechos. Separa dominio, aplicación y adaptadores; los DTO/ORM no deben dictar el dominio. Justifica relaciones entre contextos, transacciones y decisiones ADR. No conviertas cada carpeta en un servicio ni añadas patrones sin necesidad. Propón primero límites y responsabilidades, después carpetas.':id==='audit'&&format==='Refactorización'?'Devuelve una única versión completa del archivo refactorizado en un bloque de código con su lenguaje, sin omitir líneas con puntos suspensivos. Explica los cambios y límites fuera del bloque. Es una propuesta no aplicada.':'';
  return `Solicitud del módulo ${modules[id].title}.\nTipo de entrega: ${format}.\nEntrega un borrador en Markdown (OpenAPI 3.1 en YAML cuando corresponda), sin indicador de pose. Explica supuestos y limitaciones. No afirmes haber ejecutado ni medido el código. No inventes detalles ausentes del contexto.\n${guidance}\n\nContexto aportado por el usuario:\n${context}`;
}
