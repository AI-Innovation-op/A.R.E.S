import { startMcp } from "./mcp.js";
try {
  const server = startMcp();
  process.once("SIGTERM", () => {
    void server.close();
  });
  process.once("SIGINT", () => {
    void server.close();
  });
} catch {
  process.stderr.write(
    "No se pudo iniciar MCP. Configura backend local, origen, proyecto UUID y sesión cuando corresponda.\n",
  );
  process.exitCode = 1;
}
