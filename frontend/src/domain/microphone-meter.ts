export class MicrophoneMeter {
  private version = 0;
  private started = false;
  private stream?: MediaStream;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private frame?: number;
  constructor(
    private readonly level: (value: number) => void,
    private readonly failure: (message: string) => void,
    private readonly media: () => Promise<MediaStream> = () =>
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      }),
    private readonly audio: () => AudioContext = () => new AudioContext(),
  ) {}
  async start() {
    if (this.started) return;
    this.started = true;
    const version = ++this.version;
    try {
      const stream = await this.media();
      if (version !== this.version) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const context = this.audio();
      this.context = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      this.source = context.createMediaStreamSource(stream);
      this.source.connect(analyser);
      await context.resume();
      if (version !== this.version) return;
      const samples = new Uint8Array(analyser.fftSize);
      const sample = () => {
        if (version !== this.version) return;
        analyser.getByteTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) /
            samples.length,
        );
        this.level(Math.min(1, rms * 4));
        this.frame = requestAnimationFrame(sample);
      };
      sample();
    } catch {
      if (version === this.version) {
        this.stop();
        this.failure(
          "No se pudo abrir el medidor. El reconocimiento de voz conserva sus controles independientes.",
        );
      }
    }
  }
  stop() {
    this.version++;
    this.started = false;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.source?.disconnect();
    this.source = undefined;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.level(0);
  }
}
