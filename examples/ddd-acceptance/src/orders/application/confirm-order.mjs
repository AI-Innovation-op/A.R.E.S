// Puertos: uow.run({orders.find/save, inventory.reserve}). Ninguna dependencia ORM/HTTP.
export async function confirmOrder(orderId, unitOfWork) {
  return unitOfWork.run(async ({ orders, inventory }) => {
    const order = await orders.find(orderId);
    if (!order) throw new Error("Pedido no encontrado");
    if (order.status === "confirmed") return order.snapshot();
    order.assertConfirmable(); // Antes de pedir una reserva al otro contexto.
    await inventory.reserve(order.id, order.snapshot().lines);
    order.confirm();
    await orders.save(order);
    return order.snapshot();
  });
}
