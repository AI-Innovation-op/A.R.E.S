import { z } from 'zod';
import { HttpError } from '../shared/http-error.js';
import { writeProviderSettings } from './settings-file.js';

export interface OpenRouterSettings { apiKey: string; model: string }
export interface OpenRouterInput { apiKey?: string; model: string }
export const openRouterModelSchema = z.string().trim().regex(/^[A-Za-z0-9._~:/-]{1,160}$/);
export const openRouterKeySchema = z.string().trim().regex(/^sk-or-v1-[A-Za-z0-9_-]{20,200}$/);
export interface CatalogModel { id: string; name: string; contextLength: number; inputPerMillion: number | null; outputPerMillion: number | null; free: boolean }
const catalogSchema = z.object({ data: z.array(z.object({
  id: z.string(), name: z.string(), context_length: z.number().default(0),
  architecture: z.object({ output_modalities: z.array(z.string()).optional() }).optional(),
  pricing: z.object({ prompt: z.coerce.number(), completion: z.coerce.number() }),
})) });
let cache: { models: CatalogModel[]; expires: number } | undefined;
export async function listOpenRouterModels(): Promise<CatalogModel[]> {
  if (cache && cache.expires > Date.now()) return cache.models;
  let response: Response;
  try { response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, 'OPENROUTER_CATALOG_UNAVAILABLE', 'No se pudo obtener el catálogo de OpenRouter. Puedes introducir el identificador del modelo manualmente.'); }
  const parsed = catalogSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new HttpError(502, 'OPENROUTER_CATALOG_UNAVAILABLE', 'OpenRouter no devolvió un catálogo válido.');
  const models = parsed.data.data.filter(model => !model.architecture?.output_modalities || model.architecture.output_modalities.includes('text')).map(model => ({
    id: model.id, name: model.name, contextLength: model.context_length,
    inputPerMillion: model.pricing.prompt >= 0 ? model.pricing.prompt * 1000000 : null, outputPerMillion: model.pricing.completion >= 0 ? model.pricing.completion * 1000000 : null,
    free: model.pricing.prompt === 0 && model.pricing.completion === 0,
  })).sort((a, b) => Number(b.free) - Number(a.free) || a.name.localeCompare(b.name));
  cache = { models, expires: Date.now() + 600000 }; return models;
}

export async function validateOpenRouter(settings: OpenRouterSettings) {
  if (!openRouterKeySchema.safeParse(settings.apiKey).success || !openRouterModelSchema.safeParse(settings.model).success) throw new HttpError(400, 'INVALID_SETTINGS', 'Introduce una clave e identificador válidos de OpenRouter.');
  let response: Response;
  try { response = await fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${settings.apiKey}` }, signal: AbortSignal.timeout(15000) }); }
  catch { throw new HttpError(502, 'OPENROUTER_SETUP_UNAVAILABLE', 'No se pudo verificar la clave con OpenRouter.'); }
  if ([401, 403].includes(response.status)) throw new HttpError(400, 'INVALID_OPENROUTER_KEY', 'OpenRouter rechazó la clave o sus permisos.');
  if (!response.ok) throw new HttpError(502, 'OPENROUTER_SETUP_UNAVAILABLE', 'OpenRouter no pudo verificar la configuración.');
  const data: unknown = await response.json().catch(() => null);
  if (typeof data !== 'object' || data === null || !('data' in data)) throw new HttpError(502, 'OPENROUTER_SETUP_UNAVAILABLE', 'OpenRouter devolvió una verificación inválida.');
  if (!(await listOpenRouterModels()).some(model => model.id === settings.model)) throw new HttpError(400, 'OPENROUTER_MODEL_UNAVAILABLE', 'El modelo elegido no aparece en el catálogo de texto de OpenRouter.');
}
export async function saveOpenRouterSettings(path: URL, settings: OpenRouterSettings) {
  if (!openRouterKeySchema.safeParse(settings.apiKey).success || !openRouterModelSchema.safeParse(settings.model).success) throw new HttpError(400, 'INVALID_SETTINGS', 'Formato de clave o modelo inválido.');
  await writeProviderSettings(path, { OPENROUTER_API_KEY: settings.apiKey, OPENROUTER_MODEL: settings.model });
}
