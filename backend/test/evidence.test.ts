import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEvidence,
  evidenceLabels,
} from "../../packages/contracts/index.js";
test("evidencia: propuesta y generación no se promueven a probado/aplicado sin comprobantes", () => {
  assert.equal(createEvidence("proposal", ["order.ts"]).status, "proposal");
  assert.equal(evidenceLabels.generated, "Generado por IA");
  for (const status of [
    "read",
    "compiled",
    "executed",
    "tested",
    "applied",
    "published",
  ] as const)
    assert.throws(() => createEvidence(status, ["order.ts"]));
  assert.throws(() =>
    createEvidence(
      "tested",
      ["order.ts"],
      [{ kind: "test", id: "test", exitCode: 1, passed: 1 }],
    ),
  );
  const confirmed = createEvidence(
    "tested",
    ["order.ts"],
    [{ kind: "test", id: "local-test", exitCode: 0, passed: 6 }],
    ["Solo el adaptador en memoria."],
  );
  assert.equal(confirmed.status, "tested");
  assert.equal(confirmed.limitations.length, 1);
});
