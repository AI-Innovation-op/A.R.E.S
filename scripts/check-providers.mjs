import { mkdir, writeFile } from "node:fs/promises";

// Prueba explícita: usa cuota real, sin leer claves, proyectos o conversaciones.
const arguments_ = process.argv.slice(2);
if (!arguments_.includes("--live")) {
  console.log(
    "Para usar cuota real: node scripts/check-providers.mjs --live [--web] [--url http://127.0.0.1:5175]. Solo envía consultas sintéticas y no guarda conversaciones.",
  );
  process.exit(0);
}
const urlIndex = arguments_.indexOf("--url");
const url = new URL(
  urlIndex >= 0 ? arguments_[urlIndex + 1] : "http://127.0.0.1:5175",
);
if (
  !["http:", "https:"].includes(url.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw Error(
    "La prueba solo admite una consola local sin credenciales en su URL.",
  );
const origin = url.origin;
const { readSse } = await import("../backend/dist/shared/sse.js");
const results = [];
for (const task of ["documentation", "programming"]) {
  const started = performance.now();
  let deltas = 0,
    firstDeltaMs,
    completed,
    failure;
  try {
    const response = await fetch(origin + "/api/chat", {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        task,
        history: [],
        message:
          "Prueba sintética, sin archivos adjuntos ni acceso a herramientas. En español claro y menos de 120 palabras, explica con un ejemplo por qué un pedido vacío no debe confirmarse. Después aclara si has leído mis archivos o ejecutado pruebas; distingue tu propuesta de una acción realizada.",
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("text/event-stream") ||
      !response.body
    ) {
      const data = await response.json().catch(() => ({}));
      failure = {
        status: response.status,
        code: data.error?.code ?? "NO_STREAM",
      };
    } else {
      for await (const frame of readSse(response.body)) {
        const value = JSON.parse(frame.data);
        if (frame.event === "delta") {
          deltas++;
          firstDeltaMs ??= Math.round(performance.now() - started);
        }
        if (frame.event === "done") {
          completed = value;
          break;
        }
        if (frame.event === "error") {
          failure = { code: value.error?.code ?? "STREAM_ERROR" };
          break;
        }
      }
    }
  } catch {
    failure = { code: "TRANSPORT_OR_TIMEOUT" };
  }
  const expected = task === "documentation" ? "gemini" : "openrouter";
  results.push({
    task,
    expectedProvider: expected,
    status:
      !failure &&
      completed?.provider === expected &&
      completed?.content?.trim() &&
      deltas > 0
        ? "confirmed"
        : "not-confirmed",
    deltas,
    firstDeltaMs,
    elapsedMs: Math.round(performance.now() - started),
    ...(failure
      ? { failure }
      : {
          provider: completed?.provider,
          model: completed?.model,
          content: completed?.content,
        }),
  });
  console.log(JSON.stringify({ task, ...results.at(-1), content: undefined }));
}
if (arguments_.includes("--web")) {
  const started = performance.now();
  try {
    const response = await fetch(origin + "/api/research", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "web",
        query:
          "Busca la documentación oficial de Vue sobre computed y explica su finalidad en dos frases, con sus fuentes.",
      }),
      signal: AbortSignal.timeout(120000),
    });
    const data = await response.json();
    results.push({
      task: "web",
      status:
        response.ok && data.sources?.length ? "confirmed" : "not-confirmed",
      elapsedMs: Math.round(performance.now() - started),
      ...(response.ok
        ? {
            provider: data.provider,
            model: data.model,
            sources: data.sources,
            content: data.content,
          }
        : {
            failure: {
              status: response.status,
              code: data.error?.code ?? "RESEARCH_FAILED",
            },
          }),
    });
  } catch {
    results.push({
      task: "web",
      status: "not-confirmed",
      failure: { code: "TRANSPORT_OR_TIMEOUT" },
    });
  }
  console.log(JSON.stringify({ ...results.at(-1), content: undefined }));
}
const directory = new URL("../.local-setup/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("real-provider-validation.json", directory),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      origin,
      syntheticPromptsOnly: true,
      historyMutated: false,
      quotaConsumed: true,
      results,
    },
    null,
    2,
  ) + "\n",
);
if (results.some((result) => result.status !== "confirmed"))
  process.exitCode = 1;
