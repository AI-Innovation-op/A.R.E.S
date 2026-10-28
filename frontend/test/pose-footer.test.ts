import { describe, expect, it } from "vitest";
import { parsePose, visibleReply } from "../src/domain/poses";
import { spokenText } from "../src/domain/speech";

const marker = "[🛡️ POSE 15: Santuario | OJOS: [^ ^] | NÚCLEO: DOCS]";
describe("metadato final observado en Gemini real", () => {
  it("recupera la pose completa al final sin mostrarla ni leerla", () => {
    for (let id = 1; id <= 16; id++) {
      const content = `Propongo validar el pedido. Es una propuesta.\n\n${marker.replace("POSE 15", `POSE ${id}`)}`;
      expect(parsePose(content).pose?.id).toBe(id);
      expect(visibleReply(content)).toBe(
        "Propongo validar el pedido. Es una propuesta.",
      );
      expect(spokenText(content, false)).not.toContain("POSE");
    }
  });
  it("conserva ejemplos, citas, ids inválidos y bloques de código abiertos", () => {
    for (const content of [
      `Código\n[POSE 11: ejemplo]`,
      `Código\n> ${marker}`,
      `Código ${marker}`,
      `Código\n${marker.replace("15:", "17:")}`,
      `\`\`\`text\n${marker}`,
      `~~~text\n${marker}`,
      `~~~text\n\`\`\`\n${marker}`,
    ]) {
      expect(parsePose(content).pose).toBeNull();
      expect(parsePose(content).text).toBe(content);
    }
    expect(
      parsePose(`\`\`\`ts\nconst x = 1;\n\`\`\`\n${marker}`).pose?.id,
    ).toBe(15);
  });
  it("oculta el pie provisional solo fuera de código durante SSE", () => {
    expect(visibleReply("Texto.\n\n[🛡️ POSE 15: Santuario", true)).toBe(
      "Texto.",
    );
    expect(visibleReply("Texto.\n[🛡️ PO", true)).toBe("Texto.");
    expect(visibleReply("```text\n[🛡️ POSE 15: Santuario", true)).toContain(
      "POSE",
    );
    expect(visibleReply("```text\n[🛡️ PO", true)).toContain("[🛡️ PO");
  });
});
