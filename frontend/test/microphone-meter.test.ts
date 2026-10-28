import { afterEach, expect, it, vi } from "vitest";
import { MicrophoneMeter } from "../src/domain/microphone-meter";
afterEach(() => vi.unstubAllGlobals());
it("medición local idempotente; detener libera track, nodo, contexto y animación", async () => {
  const stop = vi.fn(),
    disconnect = vi.fn(),
    close = vi.fn(async () => {}),
    level = vi.fn();
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((value) => {
      callback = value;
      return 7;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const context = {
    createAnalyser: () => ({
      fftSize: 256,
      getByteTimeDomainData: (samples: Uint8Array) => samples.fill(192),
    }),
    createMediaStreamSource: () => ({ connect: vi.fn(), disconnect }),
    resume: async () => {},
    close,
  } as unknown as AudioContext;
  const media = vi.fn(async () => stream),
    meter = new MicrophoneMeter(level, vi.fn(), media, () => context);
  await Promise.all([meter.start(), meter.start()]);
  expect(media).toHaveBeenCalledTimes(1);
  expect(level).toHaveBeenCalledWith(1);
  meter.stop();
  meter.stop();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  callback?.(0);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(level).toHaveBeenLastCalledWith(0);
});
it("un permiso que llega después de detener no deja una captura activa", async () => {
  const stop = vi.fn(),
    audio = vi.fn();
  let grant!: (stream: MediaStream) => void;
  const meter = new MicrophoneMeter(
    vi.fn(),
    vi.fn(),
    () =>
      new Promise((resolve) => {
        grant = resolve;
      }),
    audio,
  );
  const pending = meter.start();
  meter.stop();
  grant({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await pending;
  expect(stop).toHaveBeenCalledTimes(1);
  expect(audio).not.toHaveBeenCalled();
});
it("un error de audio también libera la captura y comunica el límite", async () => {
  const stop = vi.fn(),
    failure = vi.fn(),
    meter = new MicrophoneMeter(
      vi.fn(),
      failure,
      async () => ({ getTracks: () => [{ stop }] }) as unknown as MediaStream,
      () => {
        throw Error("Audio no disponible");
      },
    );
  await meter.start();
  expect(stop).toHaveBeenCalledTimes(1);
  expect(failure).toHaveBeenCalledTimes(1);
});
