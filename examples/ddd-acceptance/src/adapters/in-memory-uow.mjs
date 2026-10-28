import { Order } from "../orders/domain/order.mjs";
import { reserveStock } from "../inventory/domain/stock.mjs";

// Adaptador didáctico transaccional. No simula un servicio distribuido ni una base SQL.
export function inMemoryUnitOfWork(initial) {
  let state = structuredClone(initial),
    queue = Promise.resolve();
  return {
    snapshot: () => structuredClone(state),
    run(operation) {
      const pending = queue.then(async () => {
        const working = structuredClone(state);
        const result = await operation({
          orders: {
            find: async (id) =>
              working.orders[id] ? Order.restore(working.orders[id]) : null,
            save: async (order) => {
              working.orders[order.id] = order.snapshot();
            },
          },
          inventory: {
            // Traducción entre lenguajes: productId/cantidad → SKU/unidades.
            reserve: async (orderId, lines) =>
              reserveStock(
                working.stock,
                working.reservations,
                `order:${orderId}`,
                lines.map((line) => ({
                  sku: line.productId,
                  units: line.quantity,
                })),
              ),
          },
        });
        state = working;
        return result;
      });
      queue = pending.then(
        () => undefined,
        () => undefined,
      );
      return pending;
    },
  };
}
