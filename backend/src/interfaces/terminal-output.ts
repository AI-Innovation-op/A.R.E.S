// Mantiene el streaming de texto normal. Solo retiene prefijos cortos que
// podrían ser metadatos; no interpreta ni ejecuta el contenido del modelo.
export class TerminalOutput {
  private line = "";
  private pending = "";
  private candidate = true;
  private fence: string | undefined;
  constructor(private readonly write: (text: string) => void) {}
  private possible(value: string) {
    if (/^ {4}|^\t/.test(value)) return false;
    const text = value.trimStart().replace(/[ \t]+/g, " ");
    return ["[🛡️ POSE ", "[⚔️ POSE "].some(
      (marker) => marker.startsWith(text) || text.startsWith(marker),
    );
  }
  private metadata() {
    const match = /^ {0,3}\[(?:🛡️|⚔️)\s+POSE\s+(\d{1,2}):[^\r\n]*\|\s*OJOS:[^\r\n]*\|[^\r\n]+\][ \t]*$/u.exec(this.pending);
    return !!match && Number(match[1]) >= 1 && Number(match[1]) <= 16;
  }
  private endLine(newline: boolean) {
    const removed = this.candidate && this.metadata();
    if (this.candidate && !removed) this.write(this.pending);
    if (newline && !removed) this.write("\n");
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(this.line);
    if (marker) {
      if (!this.fence) {
        if (marker[1]![0] !== "`" || !marker[2]!.includes("`"))
          this.fence = marker[1];
      } else if (
        marker[1]![0] === this.fence[0] &&
        marker[1]!.length >= this.fence.length &&
        !marker[2]!.trim()
      ) this.fence = undefined;
    }
    this.line = "";
    this.pending = "";
    this.candidate = !this.fence;
  }
  push(text: string) {
    const pieces = text.split("\n");
    for (let index = 0; index < pieces.length; index++) {
      const piece = pieces[index]!;
      this.line += piece;
      if (this.candidate) {
        this.pending += piece;
        if (this.pending.length > 600 || !this.possible(this.pending)) {
          this.write(this.pending);
          this.pending = "";
          this.candidate = false;
        }
      } else this.write(piece);
      if (index < pieces.length - 1) this.endLine(true);
    }
  }
  finish() { this.endLine(false); }
}
