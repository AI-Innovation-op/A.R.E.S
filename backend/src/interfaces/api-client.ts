import { readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSse } from "../shared/sse.js";
import { z } from "zod";
export function localAddress(input: string) {
  const url = new URL(input);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "El adaptador admite únicamente una URL local, sin credenciales ni rutas.",
    );
  return url.origin;
}
export interface AdapterSettings {
  api: string;
  origin: string;
  sessionFile?: string;
}
export class AresApiClient {
  readonly api: string;
  readonly origin: string;
  constructor(
    private readonly settings: AdapterSettings,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.api = localAddress(settings.api);
    this.origin = localAddress(settings.origin);
  }
  private async cookie() {
    if (!this.settings.sessionFile) return "";
    const info = await lstat(this.settings.sessionFile);
    if (!info.isFile() || info.size > 4096)
      throw new Error("Archivo de sesión inválido.");
    const data = JSON.parse(await readFile(this.settings.sessionFile, "utf8"));
    if (
      data.api !== this.api ||
      data.origin !== this.origin ||
      typeof data.cookie !== "string" ||
      !/^ares_session=[A-Za-z0-9_-]{43}$/.test(data.cookie)
    )
      throw new Error("La sesión no corresponde a este backend y origen.");
    return data.cookie;
  }
  async request<T>(
    route: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    if (
      !route.startsWith("/") ||
      route.startsWith("//") ||
      /[\r\n]/.test(route)
    )
      throw new Error("Ruta de API inválida.");
    const cookie = await this.cookie(),
      response = await this.fetcher(`${this.api}/api${route}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Origin: this.origin,
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.any([
          AbortSignal.timeout(120000),
          ...(signal ? [signal] : []),
        ]),
      });
    return this.json<T>(response);
  }
  private async bytes(response: Response, limit = 2097152): Promise<Buffer> {
    if (Number(response.headers.get("content-length")) > limit) {
      await response.body?.cancel();
      throw new Error(
        `La respuesta supera ${limit === 2097152 ? 2 : 4} MiB. Selecciona un resultado más pequeño.`,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Respuesta de API vacía.");
    const parts: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        bytes += result.value.length;
        if (bytes > limit)
          throw new Error(
            limit === 2097152
              ? "La respuesta supera 2 MiB."
              : "La respuesta supera 4 MiB.",
          );
        parts.push(result.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    return Buffer.concat(parts, bytes);
  }
  private async json<T>(response: Response): Promise<T> {
    const bytes = await this.bytes(response);
    let data: unknown;
    try {
      data = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new Error("El backend no confirmó una respuesta JSON.");
    }
    if (!response.ok) {
      const message = (data as { error?: { message?: unknown } })?.error
        ?.message;
      throw new Error(
        typeof message === "string"
          ? message.slice(0, 1000)
          : `La API rechazó la operación (${response.status}).`,
      );
    }
    return data as T;
  }
  async health(signal?: AbortSignal) {
    const response = await this.fetcher(this.api + "/health", {
      redirect: "error",
      signal: AbortSignal.any([
        AbortSignal.timeout(5000),
        ...(signal ? [signal] : []),
      ]),
    });
    const data = await this.json<{
      service?: string;
      version?: string;
      providers?: Record<string, { configured: boolean; model: string }>;
    }>(response);
    if (data.service !== "ares-backend")
      throw new Error(
        "Este puerto no corresponde al backend de nuestra versión de A.R.E.S. Revisa --api.",
      );
    return data;
  }
  async stream<T>(
    route: string,
    body: unknown,
    onDelta: (text: string) => void | Promise<void>,
    signal: AbortSignal,
  ): Promise<T> {
    if (
      !route.startsWith("/") ||
      route.startsWith("//") ||
      /[\r\n]/.test(route)
    )
      throw new Error("Ruta de API inválida.");
    const cookie = await this.cookie(),
      timeout = AbortSignal.any([AbortSignal.timeout(180000), signal]);
    const response = await this.fetcher(`${this.api}/api${route}`, {
      method: "POST",
      headers: {
        Origin: this.origin,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: timeout,
    });
    if (!response.ok) return this.json<T>(response);
    if (
      !response.body ||
      !response.headers.get("content-type")?.includes("text/event-stream")
    )
      throw new Error("El backend no confirmó un flujo SSE.");
    let length = 0;
    for await (const frame of readSse(response.body, timeout)) {
      let data: unknown;
      try {
        data = JSON.parse(frame.data);
      } catch {
        throw new Error("El servidor envió un fragmento SSE inválido.");
      }
      const record = z.record(z.string(), z.unknown()).safeParse(data);
      if (!record.success)
        throw new Error("El servidor envió un evento SSE incompatible.");
      const value = record.data;
      if (frame.event === "error")
        throw new Error(
          value.error &&
            typeof value.error === "object" &&
            "message" in value.error &&
            typeof value.error.message === "string"
            ? value.error.message.slice(0, 1000)
            : "La respuesta se interrumpió.",
        );
      if (frame.event === "delta") {
        if (typeof value.text !== "string")
          throw new Error("El servidor envió un fragmento SSE incompatible.");
        length += value.text.length;
        if (length > 64000)
          throw new Error("La respuesta supera el límite de texto.");
        await onDelta(value.text);
      }
      if (frame.event === "done") {
        if (
          typeof value.content !== "string" ||
          !value.content.trim() ||
          value.content.length > 64000
        )
          throw new Error(
            "El backend no confirmó contenido completo dentro del límite.",
          );
        return value as T;
      }
    }
    throw new Error(
      "El flujo terminó sin confirmar la respuesta. El texto parcial no se guarda como turno completo.",
    );
  }
  async binary(route: string, signal?: AbortSignal) {
    if (!/^\/prototypes\/[a-f0-9]{64}\/zip$/.test(route))
      throw new Error("Descarga no admitida.");
    const cookie = await this.cookie(),
      response = await this.fetcher(`${this.api}/api${route}`, {
        method: "POST",
        headers: { Origin: this.origin, ...(cookie ? { Cookie: cookie } : {}) },
        redirect: "error",
        signal: AbortSignal.any([
          AbortSignal.timeout(30000),
          ...(signal ? [signal] : []),
        ]),
      });
    if (!response.ok) {
      await this.json(response);
      throw new Error("No se pudo descargar el ZIP.");
    }
    if (!response.headers.get("content-type")?.includes("application/zip"))
      throw new Error("El servidor no confirmó un ZIP.");
    return this.bytes(response, 4194304);
  }
  async login(code: string, name: string, destination: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(code) || !name.trim() || name.length > 80)
      throw new Error(
        "Introduce nombre y código de invitación válidos por entrada estándar.",
      );
    const target = path.resolve(destination);
    try {
      await lstat(target);
      throw new Error(
        "El archivo de sesión ya existe; elige uno nuevo antes de canjear la invitación.",
      );
    } catch (cause) {
      if (!(
        cause &&
        typeof cause === "object" &&
        "code" in cause &&
        cause.code === "ENOENT"
      ))
        throw cause;
    }
    const response = await this.fetcher(`${this.api}/api/access/redeem`, {
      method: "POST",
      headers: { Origin: this.origin, "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        "No se pudo canjear la invitación. Comprueba permisos, código y origen en la consola.",
      );
    }
    const raw = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .find((value) => /^ares_session=[A-Za-z0-9_-]{43}$/.test(value ?? ""));
    await response.body?.cancel();
    if (!raw) throw new Error("El servidor no confirmó una sesión válida.");
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(
      target,
      JSON.stringify({ api: this.api, origin: this.origin, cookie: raw }) +
        "\n",
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
    return { authenticated: true, sessionFile: target };
  }
}
