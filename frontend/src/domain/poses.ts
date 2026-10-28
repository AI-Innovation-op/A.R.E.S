export const poses = [
  {
    id: 1,
    code: "IDLE",
    name: "Centinela Documental",
    eyes: "| |",
    shield: "DOC",
    action: "stand",
  },
  {
    id: 2,
    code: "ERROR",
    name: "Alerta de Excepción",
    eyes: "X X",
    shield: "CODE",
    action: "stand",
  },
  {
    id: 3,
    code: "FOCUS",
    name: "Compilación Profunda",
    eyes: "> <",
    shield: "CREST",
    action: "stand",
  },
  {
    id: 4,
    code: "HAPPY",
    name: "Build Exitoso",
    eyes: "> ◡ <",
    shield: "CREST",
    action: "stand",
  },
  {
    id: 5,
    code: "SPRINT_1",
    name: "Patrulla CI/CD",
    eyes: "| |",
    shield: "NONE",
    action: "run",
  },
  {
    id: 6,
    code: "SPRINT",
    name: "Sprint de Emergencia",
    eyes: "> <",
    shield: "NONE",
    action: "run",
  },
  {
    id: 7,
    code: "SPRINT_HAPPY",
    name: "Velocidad Full-Stack",
    eyes: "> ◡ <",
    shield: "NONE",
    action: "run",
  },
  {
    id: 8,
    code: "SPRINT_DETERMINED",
    name: "Caza de Latencia",
    eyes: "> _ <",
    shield: "NONE",
    action: "run",
  },
  {
    id: 9,
    code: "COMBAT_READY",
    name: "Postura Anti-Deuda",
    eyes: "\\ /",
    shield: "CODE",
    action: "sword-low",
  },
  {
    id: 10,
    code: "COMBAT_CHARGE",
    name: "Carga de Refactor",
    eyes: "\\ /",
    shield: "CREST",
    action: "sword-high",
  },
  {
    id: 11,
    code: "SLASH",
    name: "Corte Anime Binario",
    eyes: "> <",
    shield: "CREST",
    action: "slash",
  },
  {
    id: 12,
    code: "COMBAT_GUARD",
    name: "Guardia Post-Corte",
    eyes: "> _ <",
    shield: "CREST",
    action: "sword-guard",
  },
  {
    id: 13,
    code: "WALL_CREST",
    name: "Firewall Espartano",
    eyes: "| |",
    shield: "CREST",
    action: "shield",
  },
  {
    id: 14,
    code: "WALL_FOCUS",
    name: "Blindaje de Producción",
    eyes: "> <",
    shield: "CREST",
    action: "shield",
  },
  {
    id: 15,
    code: "SHIELD",
    name: "Santuario Documental",
    eyes: "^ ^",
    shield: "DOC",
    action: "shield",
  },
  {
    id: 16,
    code: "VICTORY",
    name: "Auditoría Perfecta",
    eyes: "▣ ▣",
    shield: "CODE",
    action: "shield",
  },
] as const;

export type Pose = (typeof poses)[number];
export type Stance =
  "IDLE" | "SLASH" | "SHIELD" | "SPRINT" | "ERROR" | "VICTORY";
const stancePose: Record<Stance, number> = {
  IDLE: 1,
  SLASH: 11,
  SHIELD: 15,
  SPRINT: 6,
  ERROR: 2,
  VICTORY: 16,
};
export function getPose(id: number): Pose {
  return poses.find((pose) => pose.id === id) ?? poses[0];
}
export function getStancePose(stance: Stance) {
  return getPose(stancePose[stance]);
}

function fenced(prefix: string): boolean {
  let opening: string | undefined;
  for (const line of prefix.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!marker) continue;
    if (!opening) {
      if (marker[1]![0] === "`" && marker[2]!.includes("`")) continue;
      opening = marker[1];
    } else if (
      marker[1]![0] === opening[0] &&
      marker[1]!.length >= opening.length &&
      !marker[2]!.trim()
    )
      opening = undefined;
  }
  return !!opening;
}
export function parsePose(content: string): {
  pose: Pose | null;
  text: string;
} {
  const match = content.match(
    /^[\uFEFF \t\r\n]*\[[^\r\n]*?\bPOSE\s+(\d{1,2}):[^\r\n]*\][ \t]*(?:\r?\n|$)/u,
  );
  const id = Number(match?.[1]);
  if (match && id >= 1 && id <= 16)
    return { pose: getPose(id), text: content.slice(match[0].length) };
  // Algunos proveedores incumplen la posición de la cabecera. Aceptar solo
  // un pie completo y firmado, fuera de código; conservar citas/ejemplos normales.
  const footer =
    /\r?\n\[(?:🛡️|⚔️)\s+POSE\s+(\d{1,2}):[^\r\n]*\|\s*OJOS:[^\r\n]*\|[^\r\n]+\][ \t\r\n]*$/u.exec(
      content,
    );
  const footerId = Number(footer?.[1]);
  if (
    footer &&
    footerId >= 1 &&
    footerId <= 16 &&
    !fenced(content.slice(0, footer.index))
  )
    return {
      pose: getPose(footerId),
      text: content.slice(0, footer.index).trimEnd(),
    };
  return { pose: null, text: content };
}
export function visibleReply(content: string, partial = false): string {
  const parsed = parsePose(content);
  let text = parsed.pose ? parsed.text.trimStart() : content;
  if (
    partial &&
    !text.includes("\n") &&
    text.length < 600 &&
    /^\s*\[(?:🛡️|⚔️|POSE\b)/u.test(text)
  )
    return "";
  if (partial) {
    const lastLine = text.lastIndexOf("\n");
    if (
      lastLine >= 0 &&
      text.length - lastLine < 600 &&
      /^\[(?:🛡️|⚔️)\s+(?:P(?:O(?:S(?:E(?:\s|$))?)?)?)?$/u.test(
        text.slice(lastLine + 1),
      ) &&
      !fenced(text.slice(0, lastLine))
    )
      text = text.slice(0, lastLine).trimEnd();
    else if (
      lastLine >= 0 &&
      text.length - lastLine < 600 &&
      /^\[(?:🛡️|⚔️)\s+POSE\s+/u.test(text.slice(lastLine + 1)) &&
      !fenced(text.slice(0, lastLine))
    )
      text = text.slice(0, lastLine).trimEnd();
  }
  return text;
}

// Respaldo local cuando una respuesta breve o un entregable omite POSE n.
// Expresa la intención de la conversación; no implica ejecutar código ni auditar un repositorio.
export function conversationPose(text: string, completed = false): Pose {
  const value = text
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    /cansad|agotad|burnout|sin dormir|duelen los ojos|dolor de (cabeza|ojos|espalda)|desvel/.test(
      value,
    )
  )
    return getPose(14);
  if (
    /gracias|genial|excelente|funciono|pruebas pasan|tests en verde/.test(value)
  )
    return getPose(4);
  if (/inyecci|secreto|token|seguridad|owasp|vulnerabil/.test(value))
    return getPose(13);
  if (/readme|document|\badr\b|\brfc\b|openapi|swagger/.test(value))
    return getPose(15);
  if (/latencia|rendimiento|optimiz|consulta sql|\bn\+1\b|lento/.test(value))
    return getPose(8);
  if (/refactor/.test(value)) return getPose(completed ? 11 : 10);
  if (/bug|\berror\b|falla|crash|excepci/.test(value))
    return getPose(completed ? 12 : 9);
  if (/conflicto|debug|depura|explica|razona/.test(value)) return getPose(3);
  if (/arquitect|scaffold|crea|constru|proyecto nuevo/.test(value))
    return getPose(7);
  if (/busca|investiga/.test(value)) return getPose(6);
  return getPose(completed ? 1 : 3);
}
