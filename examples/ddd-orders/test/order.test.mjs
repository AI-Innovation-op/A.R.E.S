import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Order } from '../src/orders/domain/order.mjs';
import { confirmOrder } from '../src/orders/application/confirm-order.mjs';
test('un pedido vacío no puede confirmarse', () => assert.throws(() => new Order().confirm(), /vacío/));
test('una línea debe tener cantidad positiva entera', () => assert.throws(() => new Order().addLine('libro', 0), /inválida/));
test('un pedido confirmado no permite añadir líneas', async () => {
  const order = new Order(); order.addLine('libro', 1);
  let saved = false;
  await confirmOrder('pedido-1', { find: async () => order, save: async () => { saved = true; } });
  assert.equal(saved, true);
  assert.throws(() => order.addLine('lámpara', 2), /confirmado/);
  assert.equal(order.lines.length, 1);
});
