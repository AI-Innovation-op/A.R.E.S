import type { Request, Response } from "express";
import type { GenerationOptions } from "../modules/chat/domain/chat.js";
import { HttpError } from "./http-error.js";
import { generationEvents } from "../../../packages/contracts/index.js";
export async function generationResponse<T>(
  req: Request,
  res: Response,
  generate: (options?: GenerationOptions) => Promise<T>,
) {
  if (!req.headers.accept?.includes("text/event-stream")) {
    res.json(await generate());
    return;
  }
  const controller = new AbortController();
  let completed = false;
  const deadline = setTimeout(() => {
    controller.abort();
    res.destroy();
  }, 180000);
  deadline.unref();
  const close = () => {
    if (!completed) controller.abort();
  };
  res.on("close", close);
  res
    .status(200)
    .set({
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    });
  res.flushHeaders();
  const write = async (event: string, value: unknown) => {
    controller.signal.throwIfAborted();
    if (!res.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`))
      await new Promise<void>((resolve, reject) => {
        const drain = () => {
            cleanup();
            resolve();
          },
          closed = () => {
            cleanup();
            reject(new Error("Flujo cerrado"));
          },
          cleanup = () => {
            res.off("drain", drain);
            res.off("close", closed);
          };
        res.once("drain", drain);
        res.once("close", closed);
      });
  };
  const timer = setInterval(() => {
    if (!res.destroyed) res.write(": keep-alive\n\n");
  }, 15000);
  timer.unref();
  try {
    const value = await generate({
      signal: controller.signal,
      onDelta: async (text) => {
        if (text) await write(generationEvents.delta, { text });
      },
    });
    controller.signal.throwIfAborted();
    await write(generationEvents.done, value);
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) {
      const controlled =
        error instanceof HttpError
          ? error
          : new HttpError(
              502,
              "STREAM_FAILED",
              "La respuesta se interrumpió. El texto incompleto no se confirmó.",
            );
      await write(generationEvents.error, {
        error: { code: controlled.code, message: controlled.message },
      }).catch(() => {});
    }
  } finally {
    completed = true;
    clearTimeout(deadline);
    clearInterval(timer);
    res.off("close", close);
    res.end();
  }
}
