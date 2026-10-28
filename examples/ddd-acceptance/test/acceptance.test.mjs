import { test } from "node:test";
import assert from "node:assert/strict";
import { Order } from "../src/orders/domain/order.mjs";
import { confirmOrder } from "../src/orders/application/confirm-order.mjs";
import { inMemoryUnitOfWork } from "../src/adapters/in-memory-uow.mjs";
const unit = (orders, stock) =>
  inMemoryUnitOfWork({
    orders: Object.fromEntries(
      orders.map((order) => [order.id, order.snapshot()]),
    ),
    stock,
    reservations: [],
  });
test("pedido vacío: rechaza confirmar sin cambiar el pedido ni reservar inventario", async () => {
  const uow = unit([new Order("one")], { book: 4 }),
    before = uow.snapshot();
  await assert.rejects(confirmOrder("one", uow), /vacío/);
  assert.deepEqual(uow.snapshot(), before);
});
test("confirmar reserva las unidades y conserva un pedido confirmado", async () => {
  const order = new Order("one");
  order.addLine("book", 2);
  const uow = unit([order], { book: 4 }),
    confirmed = await confirmOrder("one", uow);
  assert.equal(confirmed.status, "confirmed");
  assert.equal(uow.snapshot().stock.book, 2);
});
test("pedido confirmado: no admite agregar líneas ni modificarlo a través de un snapshot", () => {
  const order = new Order("one");
  order.addLine("book", 1);
  order.confirm();
  assert.throws(() => order.addLine("book", 1), /no admite/);
  const copy = order.snapshot();
  copy.lines[0].quantity = 999;
  assert.equal(order.snapshot().lines[0].quantity, 1);
});
test("stock insuficiente: se conserva todo el estado al fallar la reserva de varias líneas", async () => {
  const order = new Order("one");
  order.addLine("book", 2);
  order.addLine("lamp", 5);
  const uow = unit([order], { book: 4, lamp: 1 }),
    before = uow.snapshot();
  await assert.rejects(confirmOrder("one", uow), /Stock insuficiente/);
  assert.deepEqual(uow.snapshot(), before);
});
test("reintentar confirmar es idempotente y no descuenta inventario dos veces", async () => {
  const order = new Order("one");
  order.addLine("book", 2);
  const uow = unit([order], { book: 4 });
  await confirmOrder("one", uow);
  const before = uow.snapshot();
  await confirmOrder("one", uow);
  assert.deepEqual(uow.snapshot(), before);
});
test("dos pedidos concurrentes no pueden reservar la misma última unidad", async () => {
  const one = new Order("one"),
    two = new Order("two");
  one.addLine("book", 1);
  two.addLine("book", 1);
  const uow = unit([one, two], { book: 1 }),
    results = await Promise.allSettled([
      confirmOrder("one", uow),
      confirmOrder("two", uow),
    ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(uow.snapshot().stock.book, 0);
  assert.equal(uow.snapshot().reservations.length, 1);
});
