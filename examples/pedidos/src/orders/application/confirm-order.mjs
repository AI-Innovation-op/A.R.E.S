// El puerto repository se aporta desde fuera; el dominio no conoce la persistencia.
export async function confirmOrder(id, repository) {
  const order = await repository.find(id);
  if (!order) throw new Error('Pedido inexistente');
  order.confirm();
  await repository.save(id, order);
  return order;
}
