import { writeProviderSettings } from './settings-file.js';
import { ApiError, GoogleGenAI } from '@google/genai';
import { HttpError } from '../shared/http-error.js';

export interface GeminiSettings { apiKey: string; model: string }
export interface ChatStatus { configured: boolean; model: string }

export async function validateGemini(settings: GeminiSettings) {
  const signal = AbortSignal.timeout(15000);
  try {
    const client = new GoogleGenAI({ apiKey: settings.apiKey });
    const model = await client.models.get({ model: settings.model, config: { abortSignal: signal } });
    if (model.supportedActions && !model.supportedActions.includes('generateContent')) {
      throw new HttpError(400, 'MODEL_UNAVAILABLE', 'Elige un modelo de texto que admita generateContent.');
    }
  } catch (error: unknown) {
    if (error instanceof HttpError) throw error;
    if (signal.aborted) throw new HttpError(504, 'SETUP_TIMEOUT', 'Google tardó demasiado en responder. Vuelve a intentarlo.');
    if (error instanceof ApiError && [400, 401, 403].includes(error.status)) {
      throw new HttpError(400, 'INVALID_GEMINI_KEY', 'Google rechazó la clave o sus permisos. Comprueba la clave de Gemini en AI Studio.');
    }
    if (error instanceof ApiError && error.status === 404) throw new HttpError(400, 'MODEL_UNAVAILABLE', 'Este modelo no está disponible para tu proyecto. Introduce el identificador de un modelo de texto disponible.');
    if (error instanceof ApiError && error.status === 429) throw new HttpError(429, 'SETUP_QUOTA', 'Google ha limitado las solicitudes de este proyecto. Inténtalo más tarde.');
    throw new HttpError(502, 'SETUP_UNAVAILABLE', 'No se pudo verificar la conexión con Google. La configuración anterior se conserva.');
  }
}

export async function saveGeminiSettings(path: URL, settings: GeminiSettings) {
  // Defensa adicional aunque el llamador ya valide la entrada HTTP.
  if (!/^[A-Za-z0-9._-]{20,200}$/.test(settings.apiKey) || !/^[A-Za-z0-9._/-]{1,100}$/.test(settings.model)) {
    throw new HttpError(400, 'INVALID_SETTINGS', 'Formato de clave o modelo inválido.');
  }
  await writeProviderSettings(path, { GEMINI_API_KEY: settings.apiKey, GEMINI_MODEL: settings.model });
}
