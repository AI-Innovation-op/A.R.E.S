import { Router, json } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { HttpError } from "../../shared/http-error.js";
import type { PrototypeService } from "./prototype-service.js";
export function createPrototypeRouter(
  service: PrototypeService,
  origins: string[],
) {
  const router = Router(),
    id = z.string().regex(/^[a-f0-9]{64}$/);
  router.use(
    "/prototypes",
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      if (!req.headers.origin || !origins.includes(req.headers.origin))
        return next(
          new HttpError(
            403,
            "PROTOTYPE_ORIGIN",
            "Abre prototipos desde la consola autorizada.",
          ),
        );
      next();
    },
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "PROTOTYPE_RATE_LIMIT",
          message: "Espera antes de repetir la operación.",
        },
      },
    }),
  );
  router.post("/prototypes/build", json({ limit: "1mb" }), async (req, res) => {
    const controller = new AbortController(),
      close = () => controller.abort();
    res.once("close", close);
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    try {
      const artifact = await service.build(req.body, signal);
      if (!res.destroyed) res.json({ artifact });
    } catch (cause) {
      if (signal.aborted && !controller.signal.aborted)
        throw new HttpError(
          504,
          "PROTOTYPE_TIMEOUT",
          "La compilación agotó su tiempo. Reduce el conjunto y vuelve a intentar.",
        );
      if (!controller.signal.aborted) throw cause;
    } finally {
      res.off("close", close);
    }
  });
  router.post("/prototypes/:id/zip", (req, res) => {
    const parsed = id.safeParse(req.params.id);
    if (!parsed.success)
      throw new HttpError(
        400,
        "PROTOTYPE_ID",
        "Identificador de prototipo inválido.",
      );
    res
      .set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ares-prototipo-${parsed.data.slice(0, 12)}.zip"`,
      })
      .send(service.zip(parsed.data));
  });
  router.post("/prototypes/:id/discard", (req, res) => {
    const parsed = id.safeParse(req.params.id);
    if (!parsed.success)
      throw new HttpError(
        400,
        "PROTOTYPE_ID",
        "Identificador de prototipo inválido.",
      );
    service.discard(parsed.data);
    res.json({ discarded: true });
  });
  return router;
}
